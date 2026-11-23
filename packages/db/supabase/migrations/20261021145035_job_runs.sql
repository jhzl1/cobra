/**
 * Every attempt of every worker job, and conversations read-only for whoever
 * administers the platform without belonging to the company.
 *
 * `agent_runs` already traces a turn step by step, but only a turn, and only
 * when the turn ends on its own: an exception thrown after the run opens left it
 * in `running` with the error in the worker's log and nowhere else. A receipt
 * that could not be read, or a WhatsApp send that exhausted its retries, left
 * no row at all. This table is the one place that says what ran and how it
 * ended, for the four queues alike.
 */

create type public.job_run_status as enum ('running', 'done', 'error');

/**
 * One row per ATTEMPT, not per job.
 *
 * pg-boss retries a send up to five times; one row per job would keep only the
 * last result and hide that Meta failed four times before it went through.
 * Whether a failed attempt is still going to be retried is `attempt <
 * max_attempts`, so it is not stored.
 */
create table public.job_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  -- Empty only for an alert to the company's admin that no conversation raised.
  conversation_id uuid references public.conversations (id) on delete cascade,
  queue           text not null,
  job_id          uuid not null,
  attempt         int not null check (attempt >= 1),
  max_attempts    int not null check (max_attempts >= attempt),
  status          public.job_run_status not null default 'running',
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  -- pg-boss can hand the same attempt out twice when a worker dies mid-job and
  -- the job expires; the second write updates the first instead of adding one.
  unique (job_id, attempt)
);

create index job_runs_tenant_idx on public.job_runs (tenant_id, started_at desc);
create index job_runs_conversation_idx on public.job_runs (conversation_id, started_at desc);

-- The platform's error tray reads across every company, newest first.
create index job_runs_errors_idx
  on public.job_runs (started_at desc)
  where status = 'error';

alter table public.job_runs enable row level security;

create policy job_runs_select_members
  on public.job_runs for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

/**
 * Taking over or handing back a conversation is a member's act.
 *
 * `can_access_tenant` let the platform administrator write here too, because
 * that migration widened every policy at once. The administrator reads a
 * company's conversations to audit them; answering a customer in its name is
 * something only the company does.
 */
drop policy conversations_update_members on public.conversations;
create policy conversations_update_members
  on public.conversations for update to authenticated
  using ((select public.is_tenant_member(tenant_id)))
  with check ((select public.is_tenant_member(tenant_id)));
