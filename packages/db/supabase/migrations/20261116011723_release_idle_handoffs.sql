/**
 * A conversation held by a person goes back to the agent once nobody has
 * written in it for a while.
 *
 * Nothing returned it before: a conversation an operator took and forgot stayed
 * silent for good, and the customer who came back a month later to pay the next
 * invoice got no answer. A held receipt now hands the conversation over on its
 * own, so the forgotten case stops being rare.
 */

-- When the conversation passed to a person. Kept by the trigger below, so the
-- panel's "Tomar el control" and the worker's handoff after a held receipt both
-- stamp it without either having to remember to.
alter table public.conversations add column human_since timestamptz;

-- The ones already held get the full grace period from today, instead of being
-- released the first night because nobody knew when they were taken.
update public.conversations set human_since = now() where status = 'human';

create function public.stamp_human_since()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'human' and old.status is distinct from 'human' then
    new.human_since := now();
  elsif new.status <> 'human' then
    new.human_since := null;
  end if;

  return new;
end;
$$;

create trigger conversations_stamp_human_since
  before update of status on public.conversations
  for each row execute function public.stamp_human_since();

/**
 * Gives back to the agent every conversation of one tenant held by a person for
 * longer than `p_idle` in which no operator wrote during `p_idle`.
 *
 * The operator's last message is what counts, not the customer's: a customer
 * writing into a held conversation that nobody answers is exactly the case this
 * exists for. Returns how many it released.
 */
create function public.release_idle_handoffs(p_tenant_id uuid, p_idle interval)
returns integer
language sql
set search_path = public, pg_temp
as $$
  with released as (
    update public.conversations c
    set status = 'bot', assigned_to = null
    where c.tenant_id = p_tenant_id
      and c.status = 'human'
      and c.human_since < now() - p_idle
      and not exists (
        select 1
        from public.messages m
        where m.tenant_id = p_tenant_id
          and m.conversation_id = c.id
          and m.author = 'operator'
          and m.received_at > now() - p_idle
      )
    returning 1
  )
  select count(*)::integer from released;
$$;

-- Only the worker calls this, with the service role.
revoke execute on function public.release_idle_handoffs(uuid, interval) from public;
revoke execute on function public.release_idle_handoffs(uuid, interval) from anon;
revoke execute on function public.release_idle_handoffs(uuid, interval) from authenticated;
