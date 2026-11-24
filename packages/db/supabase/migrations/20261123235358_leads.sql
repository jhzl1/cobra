/**
 * Demo requests sent from the landing page form.
 *
 * Until now the form stored nothing: whoever asked for a demo was lost unless
 * someone happened to be watching. The platform administrator reads them in
 * the panel and marks each one as contacted or discarded.
 *
 * No `tenant_id`, and on purpose: a lead is not a company yet, and the person
 * may never become one. Like `platform_settings`, this table is the
 * platform's, not a company's.
 *
 * The form is public, so the only defence against someone filling the table is
 * a limit of requests per connection and per hour. The API counts the rows of
 * the last hour for the same `ip_hash` before inserting. The count lives here
 * and not in the API's memory because the API restarts on every deploy, and a
 * counter that resets on deploy limits nothing.
 *
 * Only a hash of the IP is kept, never the address itself: it is used to count
 * and for nothing else, and the panel never shows it.
 */
create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  company        text not null,
  whatsapp       text not null,
  email          text not null,
  -- A range picked from a closed list, e.g. '201-800'; the list lives in
  -- `@cobra/contracts` (`customerCountSchema`).
  customer_count text not null,
  status         text not null default 'new'
    check (status in ('new', 'contacted', 'discarded')),
  -- sha256 of the client IP, hex.
  ip_hash        text not null,
  created_at     timestamptz not null default now()
);

comment on table public.leads is
  'Demo requests from the landing page form. Platform-wide, no tenant; ip_hash only counts requests per hour.';

-- What the panel lists: every lead, newest first. `id` breaks ties so a page
-- boundary never repeats or skips a row.
create index leads_created_at_idx
  on public.leads (created_at desc, id desc);

-- What the per-hour limit counts: one connection's requests since an hour ago.
create index leads_ip_hash_created_at_idx
  on public.leads (ip_hash, created_at);

alter table public.leads enable row level security;

-- Inserting and changing the status go through the API, which writes with the
-- secret key. The policy only covers a read with an administrator's own
-- session.
create policy leads_select_admin
  on public.leads for select to authenticated
  using ((select public.is_platform_admin()));
