-- What the agent did, step by step. This is what the timeline in the panel reads.

create type public.agent_run_trigger as enum ('inbound', 'manual_replay');
create type public.agent_run_status as enum ('running', 'done', 'error', 'skipped');

create table public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  trigger         public.agent_run_trigger not null default 'inbound',
  status          public.agent_run_status not null default 'running',
  model           text,
  input_tokens    int,
  output_tokens   int,
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index agent_runs_conversation_idx
  on public.agent_runs (conversation_id, started_at desc);

-- The failed-turn tray: a conversation whose last run died has to be visible,
-- which is the whole reason the timeline exists.
create index agent_runs_errors_idx
  on public.agent_runs (tenant_id, started_at desc)
  where status = 'error';

create type public.agent_step_kind as enum (
  'normalize', 'media', 'vision', 'validation', 'tool', 'llm', 'send'
);

create type public.agent_step_status as enum ('running', 'done', 'error', 'skipped');

create table public.agent_steps (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.agent_runs (id) on delete cascade,
  /**
   * Denormalized from the run.
   *
   * PLAN.md's sketch keys this table by `run_id` alone. Both columns are here
   * because the broadcast trigger needs the conversation to build its topic and
   * the RLS policy needs the tenant, and resolving either through `agent_runs`
   * costs a join on every one of the ten to thirty rows a single turn writes.
   */
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  seq             int not null,
  kind            public.agent_step_kind not null,
  name            text not null,
  status          public.agent_step_status not null default 'running',
  -- The model's id for this tool call. Both writes of a tool step share it: the
  -- one before `execute` runs and the one after it returns.
  tool_call_id    text,
  input           jsonb,
  output          jsonb,
  error           text,
  duration_ms     int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (run_id, seq)
);

create index agent_steps_run_idx on public.agent_steps (run_id, seq);
create index agent_steps_conversation_idx on public.agent_steps (conversation_id, created_at);

alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;

create policy agent_runs_select_members
  on public.agent_runs for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

create policy agent_steps_select_members
  on public.agent_steps for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));
