-- Tenancy: one row in `tenants` per ISP using Cobra. Everything else in the
-- schema carries `tenant_id`, and every policy below resolves membership through
-- `public.is_tenant_member`.
--
-- There are no roles. Every member of a tenant sees the same thing and can do the
-- same things, which is the decision taken in PLAN.md: a role model would be one
-- more thing to get wrong for zero product value today.

create type public.tenant_status as enum ('active', 'suspended');

create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  -- Appears inside the webhook URL, so it is lowercase, hyphenated and stable.
  slug          text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  -- What the agent calls the company when it writes to a customer. In n8n this
  -- lived inside the prompt; here it is data.
  company_name  text not null,
  -- The number the agent tells customers to call. Colombian E.164, no plus.
  support_phone text not null,
  -- Where escalations land. In n8n this was typed by hand into four nodes.
  admin_phone   text not null,
  status        public.tenant_status not null default 'active',
  created_at    timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members (user_id);

/**
 * Membership, as one function.
 *
 * `security definer` because the policies on `tenant_members` would otherwise
 * have to read `tenant_members` to decide whether you may read `tenant_members`,
 * which recurses. Written once so no policy can disagree with another.
 *
 * `(select auth.uid())` rather than the bare call: the scalar subquery is
 * evaluated once per statement instead of once per row.
 */
create function public.is_tenant_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_members
    where tenant_id = target
      and user_id = (select auth.uid())
  )
$$;

revoke execute on function public.is_tenant_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

create policy tenants_select_members
  on public.tenants for select to authenticated
  using ((select public.is_tenant_member(id)));

create policy tenants_update_members
  on public.tenants for update to authenticated
  using ((select public.is_tenant_member(id)))
  with check ((select public.is_tenant_member(id)));

create policy tenant_members_select_members
  on public.tenant_members for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

-- Creating a tenant is an onboarding operation and runs with the secret key, so
-- no insert policy is granted here on purpose.

/**
 * Third-party credentials, one row per provider per tenant.
 *
 * `ciphertext` is AES-256-GCM, encrypted in the application with a master key
 * that lives in Railway's environment. Postgres never sees the plaintext and the
 * panel never sees the ciphertext — the grant below hands `authenticated` four
 * columns and not that one.
 *
 * providers:
 *   meta       — WhatsApp Cloud API. `secret` is the permanent access token,
 *                `extra` carries waba_id and app_secret.
 *   openrouter — one API key, used for both the vision model and the agent.
 *   wisphub    — the API key that signs `Authorization: Api-Key ...`.
 */
create type public.credential_provider as enum ('meta', 'openrouter', 'wisphub');

create table public.tenant_credentials (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  provider   public.credential_provider not null,
  ciphertext text not null,
  -- The last four characters of the plaintext, so the panel can show which key is
  -- loaded without being able to read it.
  last4      text not null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

alter table public.tenant_credentials enable row level security;

-- Column privileges, not a policy: RLS filters rows, and what has to be hidden
-- here is a column. Without the revoke, a member selects `ciphertext` and the
-- encryption buys nothing.
revoke select on public.tenant_credentials from authenticated;
grant select (tenant_id, provider, last4, rotated_at, created_at)
  on public.tenant_credentials to authenticated;

create policy tenant_credentials_select_members
  on public.tenant_credentials for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

-- Writes go through the API, which encrypts first. No insert/update policy.

/**
 * The WhatsApp numbers a tenant receives on.
 *
 * `webhook_token` is the opaque high-entropy segment of the webhook URL and is
 * what authenticates an inbound POST when Meta's signature is unavailable.
 * `verify_token` is what Meta echoes during the GET handshake.
 *
 * Validity, and the partial unique index over it, exist for one scenario: a
 * number that leaves tenant A and is activated at tenant B. Without them the
 * lookup by `phone_number_id` reassigns A's history to B.
 */
create table public.whatsapp_numbers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  -- Meta's id for the number, echoed in `metadata.phone_number_id` of every event.
  phone_number_id text not null,
  display_number  text not null,
  verify_token    text not null,
  webhook_token   text not null unique,
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  created_at      timestamptz not null default now()
);

create unique index whatsapp_numbers_active_phone_idx
  on public.whatsapp_numbers (phone_number_id)
  where valid_to is null;

create index whatsapp_numbers_tenant_idx on public.whatsapp_numbers (tenant_id);

alter table public.whatsapp_numbers enable row level security;

-- Members read this one whole, tokens included: setting the number up in Meta
-- means copying both tokens out of the panel.
create policy whatsapp_numbers_select_members
  on public.whatsapp_numbers for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

/**
 * Where the tenant's customers pay.
 *
 * `payment_address` is matched against what the vision model reads off the
 * receipt, by suffix — a Nequi screenshot shows `***1234`, never the full number.
 * `entity_name` breaks the tie when two methods end alike.
 */
create table public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  -- The tenant's own segmentation (a town, a franchise). Free text, shown to
  -- nobody outside the panel.
  zone            text,
  entity_name     text not null,
  payment_address text not null,
  -- What Wisphub calls this payment method, sent as `forma_pago`.
  wisphub_id      text,
  description     text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, entity_name, payment_address)
);

create index payment_methods_tenant_idx on public.payment_methods (tenant_id);

alter table public.payment_methods enable row level security;

create policy payment_methods_select_members
  on public.payment_methods for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

create policy payment_methods_write_members
  on public.payment_methods for all to authenticated
  using ((select public.is_tenant_member(tenant_id)))
  with check ((select public.is_tenant_member(tenant_id)));
