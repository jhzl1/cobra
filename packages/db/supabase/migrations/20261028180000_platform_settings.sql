/**
 * Settings that belong to the platform and apply to every company at once.
 *
 * The first ones are the two OpenRouter models, which until now were constants
 * in `packages/agent/src/models.ts`: trying another model meant a deploy of the
 * worker. The worker reads this table per job, the same way it reads
 * credentials, so a change applies from the next message on.
 *
 * No `tenant_id`, and on purpose: CLAUDE.md fixes the flow as identical for
 * every company, and a per-company value here would be exactly the kind of
 * branch that rule forbids. Like `user_roles`, this is the platform's.
 */

/**
 * The closed list of settings. A typo in a key is rejected by the database
 * instead of becoming a row nobody reads while the real setting keeps its old
 * value. Adding a setting is `alter type ... add value` plus its seed row.
 */
create type public.platform_setting_key as enum (
  -- OpenRouter id of the model that talks to the customer: tools, temperature 0.
  'agent_model',
  -- OpenRouter id of the receipt extractor: an image in, structured output out.
  'vision_model'
);

/**
 * One row per key, overwritten in place: only the current value is kept. Which
 * model ran a given turn is already recorded in `agent_runs.model`.
 *
 * `value` is jsonb because the settings to come are not all text — a window in
 * milliseconds is a number. What each key may hold is checked by its zod schema
 * in `@cobra/contracts` (`platformSettingSchemas`), on write by the API and on
 * read by the worker; the database only guarantees the key exists once.
 */
create table public.platform_settings (
  key        public.platform_setting_key primary key,
  value      jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is
  'Platform-wide settings, one row per key. Values are validated per key by @cobra/contracts.';

-- The models the n8n workflow runs today. Seeded because the worker fails the
-- job rather than guess a value for a missing key.
insert into public.platform_settings (key, value) values
  ('agent_model', to_jsonb('anthropic/claude-haiku-4.5'::text)),
  ('vision_model', to_jsonb('google/gemini-3.5-flash'::text));

alter table public.platform_settings enable row level security;

-- Reading and changing goes through the API, which checks who is asking and
-- validates each value. The policy only covers a read with an administrator's
-- own session.
create policy platform_settings_select_admin
  on public.platform_settings for select to authenticated
  using ((select public.is_platform_admin()));
