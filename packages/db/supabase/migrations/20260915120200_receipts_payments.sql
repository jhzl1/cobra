-- Receipts read off an image, and what was done with them in Wisphub.

create table public.receipts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  conversation_id     uuid not null references public.conversations (id) on delete cascade,
  message_id          uuid references public.messages (id) on delete set null,
  amount              numeric(14, 2),
  -- Every reference string the model read, as printed on the image.
  reference           text[] not null default '{}',
  -- The same strings trimmed, uppercased and stripped of leading zeros and
  -- separators. Gemini returns "123-456" and "123456" for the same receipt, so
  -- the comparison has to happen on a normalized form or the dedup never fires.
  reference_normalized text[] not null default '{}',
  -- What the receipt says, which is not what Wisphub is told: `fecha_pago` there
  -- is the moment of registration. This one drives the seven-day rule.
  paid_at             timestamptz,
  destination_method  text,
  destination_account text,
  payment_method_id   uuid references public.payment_methods (id) on delete set null,
  media_id            text,
  storage_path        text,
  confidence          numeric(4, 3),
  -- The model's whole answer, kept verbatim. When a receipt is rejected the
  -- operator needs to see what was read, not a summary of it.
  raw_extraction      jsonb,
  -- Null while the receipt is accepted. Otherwise the rule that rejected it,
  -- from `validation.ts` in @cobra/agent. Internal: never sent to the customer.
  alert_reason        text,
  wisphub_payment_id  text,
  created_at          timestamptz not null default now()
);

create index receipts_conversation_idx on public.receipts (conversation_id, created_at desc);
create index receipts_tenant_idx on public.receipts (tenant_id, created_at desc);

/**
 * The references already spent, one row per string.
 *
 * PLAN.md asks for `unique` over `reference_normalized`. A unique index on the
 * array column would only reject two receipts whose arrays are identical, and
 * the case that costs money is a receipt that shares *one* reference with an
 * earlier one — a customer resending the same transfer photographed differently.
 * One row per string is what makes that collide.
 *
 * It is also the seam PLAN.md names for the n8n cutover: seeding it is an insert
 * of one column out of `used_vouchers`, not a migration.
 */
create table public.used_references (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  reference  text not null,
  receipt_id uuid references public.receipts (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, reference)
);

create type public.payment_attempt_kind as enum ('invoice_payment', 'credit');

/**
 * `unknown` is the state this table exists for.
 *
 * The failure that costs money is not the double attempt, it is the timeout
 * after success: the POST reaches Wisphub, the response is lost, and nobody
 * knows whether the customer was charged. Two states cannot express that, so
 * there are four, and a reconciliation pass resolves `unknown` against
 * `GET /api/clientes/{id}/saldo`.
 */
create type public.payment_attempt_state as enum ('pending', 'confirmed', 'failed', 'unknown');

create table public.payment_attempts (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  conversation_id    uuid not null references public.conversations (id) on delete cascade,
  receipt_id         uuid references public.receipts (id) on delete set null,
  kind               public.payment_attempt_kind not null,
  -- The customer documents this attempt was made against.
  documents          text[] not null default '{}',
  amount             numeric(14, 2) not null,
  state              public.payment_attempt_state not null default 'pending',
  wisphub_response   jsonb,
  invoice_ids        bigint[] not null default '{}',
  failed_invoice_ids bigint[] not null default '{}',
  error              text,
  created_at         timestamptz not null default now(),
  settled_at         timestamptz
);

create index payment_attempts_conversation_idx
  on public.payment_attempts (conversation_id, created_at desc);

-- What the reconciliation pass scans.
create index payment_attempts_unsettled_idx
  on public.payment_attempts (tenant_id, created_at)
  where state in ('pending', 'unknown');

alter table public.receipts enable row level security;
alter table public.used_references enable row level security;
alter table public.payment_attempts enable row level security;

create policy receipts_select_members
  on public.receipts for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

create policy used_references_select_members
  on public.used_references for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

create policy payment_attempts_select_members
  on public.payment_attempts for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));
