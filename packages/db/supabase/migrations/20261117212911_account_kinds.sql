/**
 * An account is one of two kinds: it operates the platform, or it works for one
 * company. Never both, and never neither.
 *
 * Until now creating a company made the administrator who created it a member,
 * so the same account was both, and revoking the role left an account that
 * could still sign in to see nothing. From here on:
 *
 *   - the database refuses an account that would be both;
 *   - an account belongs to one company at most;
 *   - an account left with neither is blocked in Supabase Auth, so it cannot
 *     sign in, and the API answers 401 to whatever token it still holds.
 */

-- Existing accounts that are both keep the role and leave their companies. An
-- administrator still reads every company through `can_access_tenant`; what
-- the membership added was answering customers in the company's name, which is
-- exactly what the platform is not meant to do. The membership row is all that
-- goes: conversations, messages and payments keep whoever touched them.
delete from public.tenant_members m
 using public.user_roles r
 where r.user_id = m.user_id
   and r.role = 'ADMIN'
   and r.revoked_at is null;

-- One company per account. The primary key already stops joining the same
-- company twice; this stops joining a second one.
create unique index tenant_members_one_company_per_account
  on public.tenant_members (user_id);

/**
 * The two triggers below are the rule itself. The API checks first and answers
 * with a message an administrator can act on; these are what hold when a
 * request, a script or a hand-written statement gets past it.
 *
 * `check_violation` so the API can tell this refusal from any other failure.
 */
create function public.reject_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.user_roles r
     where r.user_id = new.user_id
       and r.role = 'ADMIN'
       and r.revoked_at is null
  ) then
    raise exception 'A platform administrator cannot belong to a company'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger tenant_members_reject_admin
  before insert or update on public.tenant_members
  for each row execute function public.reject_admin_membership();

create function public.reject_member_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is null
     and new.user_id is not null
     and exists (select 1 from public.tenant_members m where m.user_id = new.user_id)
  then
    raise exception 'A company member cannot be a platform administrator'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger user_roles_reject_member
  before insert or update on public.user_roles
  for each row execute function public.reject_member_admin_grant();

-- Accounts already left with neither, such as an administrator revoked before
-- revoking blocked the account. A century is how Supabase Auth itself writes
-- "until further notice" (`ban_duration: '876000h'`); `infinity` is valid SQL
-- but not a timestamp its server can read back.
update auth.users u
   set banned_until = now() + interval '100 years'
 where (u.banned_until is null or u.banned_until < now())
   and not exists (
     select 1
       from public.user_roles r
      where r.user_id = u.id
        and r.role = 'ADMIN'
        and r.revoked_at is null
   )
   and not exists (select 1 from public.tenant_members m where m.user_id = u.id);

/**
 * What the API asks on every request: whether this account still has any
 * access, and whether it is still on a temporary password. One call, because
 * it runs in front of every endpoint.
 *
 * Read from the tables and not from the token, which lives up to an hour: an
 * account revoked a minute ago must stop working now, not when its token ends.
 */
create function public.account_access(target_user uuid)
returns table (has_access boolean, must_change_password boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
        from public.user_roles r
       where r.user_id = target_user
         and r.role = 'ADMIN'
         and r.revoked_at is null
    )
    or exists (select 1 from public.tenant_members m where m.user_id = target_user),
    exists (
      select 1
        from public.temporary_passwords tp
       where tp.user_id = target_user
         and tp.replaced_at is null
    )
$$;

revoke execute on function public.account_access(uuid) from public, anon, authenticated;
grant execute on function public.account_access(uuid) to service_role;

-- A blocked account has nothing to recover: a new password would not let it
-- sign in. Its request would only sit in the administrator's list.
create or replace function public.request_password_reset(requested_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.password_reset_requests (user_id)
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(requested_email))
     and (u.banned_until is null or u.banned_until <= now())
  on conflict (user_id) where resolved_at is null do nothing
$$;

-- The users list learns whether an account is blocked. The return type
-- changes, which `create or replace` cannot do, so it is dropped first.
drop function public.platform_users(integer, integer);

create function public.platform_users(page_size integer, page_offset integer)
returns table (
  user_id              uuid,
  email                text,
  created_at           timestamptz,
  last_sign_in_at      timestamptz,
  admin_grant_id       uuid,
  companies            jsonb,
  reset_requested_at   timestamptz,
  must_change_password boolean,
  is_blocked           boolean,
  total                bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    admin_grant.id,
    coalesce(memberships.companies, '[]'::jsonb),
    open_request.requested_at,
    exists (
      select 1
        from public.temporary_passwords tp
       where tp.user_id = u.id
         and tp.replaced_at is null
    ),
    coalesce(u.banned_until > now(), false),
    count(*) over ()
  from auth.users u
  left join public.user_roles admin_grant
    on admin_grant.user_id = u.id
   and admin_grant.role = 'ADMIN'
   and admin_grant.revoked_at is null
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('id', t.id, 'name', t.company_name)
             order by t.company_name
           ) as companies
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
     where m.user_id = u.id
  ) memberships on true
  left join public.password_reset_requests open_request
    on open_request.user_id = u.id
   and open_request.resolved_at is null
  order by open_request.requested_at asc nulls last, lower(u.email)
  limit page_size
  offset page_offset
$$;

revoke execute on function public.platform_users(integer, integer) from public, anon, authenticated;
grant execute on function public.platform_users(integer, integer) to service_role;
