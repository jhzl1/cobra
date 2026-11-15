/**
 * Starts the agent's memory over for every conversation of one tenant that has
 * been silent for `p_idle`.
 *
 * A customer who wrote, left the conversation unanswered and came back four
 * days later was still answered with the memory of that earlier exchange. The
 * worker calls this every night; nothing is deleted, the mark moves the same
 * way it does after a payment.
 *
 * The mark lands on `last_message_at`, not on `now()`: the agent reads messages
 * strictly after it, so a message that arrives while this runs is never left
 * behind the mark. And because `messages` bumps `last_message_at` on the same
 * row, that message's insert and this update serialize on the row lock, and the
 * update re-checks the idle condition against the fresh value.
 *
 * `context_reset_at < last_message_at` keeps a conversation that was already
 * reset from being rewritten every night for as long as it stays silent.
 */
create function public.reset_stale_contexts(p_tenant_id uuid, p_idle interval)
returns integer
language sql
set search_path = public, pg_temp
as $$
  with reset as (
    update public.conversations
    set context_reset_at = last_message_at
    where tenant_id = p_tenant_id
      and last_message_at < now() - p_idle
      and (context_reset_at is null or context_reset_at < last_message_at)
    returning 1
  )
  select count(*)::integer from reset;
$$;

-- Only the worker calls this, with the service role.
revoke execute on function public.reset_stale_contexts(uuid, interval) from public;
revoke execute on function public.reset_stale_contexts(uuid, interval) from anon;
revoke execute on function public.reset_stale_contexts(uuid, interval) from authenticated;
