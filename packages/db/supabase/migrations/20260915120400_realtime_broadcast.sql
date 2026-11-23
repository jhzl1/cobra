/**
 * Live updates, over `broadcast` from the database and not over `postgres_changes`.
 *
 * `postgres_changes` runs an authorization check per row and per subscriber, and
 * the check here is a function that reads membership. One turn writes between ten
 * and thirty steps. That processing happens on a single thread per project,
 * shared with the message stream, so the timeline would degrade the live chat
 * beside it.
 *
 * With a private channel and `broadcast`, authorization is evaluated once on join
 * and cached for the life of the connection.
 *
 * Topic: `conversation:<uuid>`. The policy at the bottom is what makes it private.
 */

/**
 * One emitter for every table that feeds a conversation's channel.
 *
 * The whole call is wrapped: an exception raised inside an `after` trigger aborts
 * the business INSERT. A customer's message must not fail to be stored because
 * Realtime was briefly unhappy.
 */
create function public.broadcast_conversation_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conversation uuid := coalesce(
    (case when tg_op = 'DELETE' then null else new.conversation_id end),
    (case when tg_op = 'INSERT' then null else old.conversation_id end)
  );
begin
  if conversation is null then
    return null;
  end if;

  begin
    perform realtime.broadcast_changes(
      'conversation:' || conversation::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception
    when others then null;
  end;

  return null;
end
$$;

-- The conversation row itself has no `conversation_id` column, so it gets its own
-- emitter. This is what carries a handoff to every panel with that chat open.
create function public.broadcast_conversation_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    perform realtime.broadcast_changes(
      'conversation:' || coalesce(new.id, old.id)::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception
    when others then null;
  end;

  return null;
end
$$;

create trigger messages_broadcast
  after insert or update on public.messages
  for each row execute function public.broadcast_conversation_change();

create trigger agent_steps_broadcast
  after insert or update on public.agent_steps
  for each row execute function public.broadcast_conversation_change();

create trigger agent_runs_broadcast
  after insert or update on public.agent_runs
  for each row execute function public.broadcast_conversation_change();

create trigger conversations_broadcast
  after insert or update on public.conversations
  for each row execute function public.broadcast_conversation_row();

/**
 * Who may join a conversation's channel.
 *
 * The topic carries the conversation id, so membership is resolved by reading
 * that conversation's tenant. Evaluated once, when the client joins.
 */
create policy conversation_broadcast_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = split_part(realtime.topic(), ':', 2)
        and (select public.is_tenant_member(c.tenant_id))
    )
  );
