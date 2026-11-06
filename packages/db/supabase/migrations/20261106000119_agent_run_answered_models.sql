/**
 * Which model, and which OpenRouter provider, answered each model call of a turn.
 *
 * `agent_runs.model` is written before the first call, so it is the model that
 * was configured, not the one that answered. Since 2026-11-05 OpenRouter may
 * answer with another provider of that model, or with the fallback model of
 * `platform_settings.agent_fallback_model`, and nothing recorded which.
 *
 * Two arrays aligned by position, one element per model call: a turn makes up
 * to eight, and the fallback can come in at any of them. A provider is null when
 * OpenRouter did not say.
 *
 * Null on the run, not an empty array, for runs that never called a model and
 * for every run before this migration.
 */
alter table public.agent_runs
  add column answered_models    text[],
  add column answered_providers text[];

comment on column public.agent_runs.answered_models is
  'Model that answered each model call of the turn, in order. agent_runs.model is the configured one.';
comment on column public.agent_runs.answered_providers is
  'OpenRouter provider that served each model call, aligned with answered_models. Null when unknown.';
