/**
 * Accounts are created by an administrator, with a password nobody keeps.
 *
 * Until now an administrator granted the role to an email and the account did
 * not exist: sign-up is closed, so that person had no way in except Google.
 * Now the API creates the account with a temporary password, shows it once, and
 * the person has to replace it on their first sign-in. Forgetting a password
 * goes through the same door: the person asks, an administrator issues a new
 * temporary one.
 *
 * Neither table is read from the panel. Both are written and read by the API
 * with the secret key, so RLS is on and there is no policy: a session token
 * reaches nothing here.
 */

/**
 * One row per temporary password issued, not per person.
 *
 * The password itself is never stored, not even hashed: Supabase Auth holds the
 * hash, and this only records that the current one was set by someone else.
 * While a row has no `replaced_at`, the API refuses every request from that
 * account except replacing it — whoever issued it read it on screen.
 */
create table public.temporary_passwords (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  issued_by   uuid references auth.users (id),
  issued_at   timestamptz not null default now(),
  replaced_at timestamptz
);

comment on table public.temporary_passwords is
  'Passwords set by an administrator. Active while replaced_at is null; the password itself is never stored.';

create unique index temporary_passwords_active_unique
  on public.temporary_passwords (user_id)
  where replaced_at is null;

alter table public.temporary_passwords enable row level security;

/**
 * "Olvidé mi contraseña", waiting for an administrator.
 *
 * At most one open request per person: asking again while one is open changes
 * nothing, so a form that anyone can submit cannot grow this table.
 */
create table public.password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users (id)
);

comment on table public.password_reset_requests is
  'Password reset requests from the sign-in screen, resolved by an administrator issuing a temporary password.';

create unique index password_reset_requests_open_unique
  on public.password_reset_requests (user_id)
  where resolved_at is null;

alter table public.password_reset_requests enable row level security;

/**
 * Records a reset request for an email, if an account has it.
 *
 * In SQL because the answer to "does this email have an account?" lives in
 * `auth.users`, which the API cannot filter by email without paging through
 * every account. It returns nothing on purpose: the endpoint answers the same
 * whether the account exists or not, and a function that said which would make
 * that one line easy to get wrong.
 */
create function public.request_password_reset(requested_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.password_reset_requests (user_id)
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(requested_email))
  on conflict (user_id) where resolved_at is null do nothing
$$;

revoke execute on function public.request_password_reset(text) from public, anon, authenticated;
grant execute on function public.request_password_reset(text) to service_role;

/**
 * Every account on the platform, a page at a time, for the platform's users tab.
 *
 * Open reset requests first, oldest first: they are what an administrator opens
 * the tab for. `total` repeats on every row so one call answers both the page
 * and the page count.
 */
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
