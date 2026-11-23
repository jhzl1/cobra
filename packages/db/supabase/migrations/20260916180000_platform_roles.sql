/**
 * Who operates the platform, as opposed to who operates one company.
 *
 * Two different axes, and this file only adds the first:
 *
 *   - ADMIN: operates Cobra. Creates companies, grants and revokes this same
 *     role, and reaches any company.
 *   - a company's member: `tenant_members`. Reaches theirs and no other. Inside
 *     a company there is still no hierarchy — that is PLAN.md's decision and it
 *     does not change here.
 *
 * Until now there was no gate at all: anyone with a session could create a
 * company and became its member. The only thing holding that back was that
 * sign-up is closed.
 */

create type public.platform_role as enum ('ADMIN');

/**
 * One row per GRANT, not per person.
 *
 * Granted by email and before the first sign-in: the account may not exist yet.
 * The trigger below ties it when that person arrives.
 */
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  role       public.platform_role not null,

  -- Empty until the first sign-in.
  user_id    uuid references auth.users (id) on delete set null,

  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),

  /**
   * Revoking does NOT delete the row. Without it the evidence that someone could
   * once reach every company disappears, which is exactly what has to be
   * reconstructable afterwards.
   */
  revoked_at timestamptz
);

comment on table public.user_roles is
  'Platform authorisation, by email. Granted before the first sign-in; user_id is tied on arrival.';

-- The same role cannot be active twice, but it can be granted, revoked and
-- granted again.
create unique index user_roles_active_unique
  on public.user_roles (email, role)
  where revoked_at is null;

create index user_roles_user_id_idx on public.user_roles (user_id) where revoked_at is null;

-- An identity provider is free to hand back Name.Surname@…, and a case-sensitive
-- match would fail to find the grant without saying why.
create function public.user_roles_normalise()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger user_roles_normalise
  before insert or update on public.user_roles
  for each row execute function public.user_roles_normalise();

create function public.link_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_roles
     set user_id = new.id
   where email = lower(new.email)
     and user_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_user_roles();

/**
 * Whether the caller administers the platform.
 *
 * Reads the TABLE, not the token's claim, and that is the deliberate difference
 * from midgard: an access token lives up to an hour, so an administrator revoked
 * five minutes ago would still reach every company. The claim exists too, at the
 * bottom of this file, but only so the panel knows what to draw.
 */
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'ADMIN'
      and revoked_at is null
  )
$$;

revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

/**
 * Who reaches a company: its members, and whoever administers the platform.
 *
 * `is_tenant_member` keeps meaning exactly what it said — membership — and is
 * left alone on purpose: the two questions are different, and merging them makes
 * "is this person a member?" start answering yes for someone who is not.
 */
create function public.can_access_tenant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_tenant_member(target) or public.is_platform_admin()
$$;

revoke execute on function public.can_access_tenant(uuid) from public;
grant execute on function public.can_access_tenant(uuid) to authenticated;

alter table public.user_roles enable row level security;

-- Everyone sees their own grants; an administrator sees all of them. Granting
-- and revoking goes through the API, which checks who is asking.
create policy user_roles_select_own_or_admin
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

/**
 * The hook that stamps the roles into the token.
 *
 * Supabase runs it right before issuing the JWT, and it has to be switched on
 * once by hand: Authentication → Hooks → Custom Access Token. Miss that step and
 * the panel simply does not show the platform section — no policy loosens,
 * because authorisation is decided by the functions above, reading the table.
 */
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims     jsonb;
  user_email text;
  roles_json jsonb;
begin
  select lower(u.email) into user_email
    from auth.users u
   where u.id = (event ->> 'user_id')::uuid;

  select coalesce(jsonb_agg(ur.role::text order by ur.role::text), '[]'::jsonb)
    into roles_json
    from public.user_roles ur
   where ur.email = user_email
     and ur.revoked_at is null;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{roles}', roles_json);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on table public.user_roles to supabase_auth_admin;

create policy user_roles_auth_admin_read
  on public.user_roles for select to supabase_auth_admin
  using (true);
