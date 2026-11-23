/**
 * Closing a turn: mark what it consumed and record what it answered, in one
 * statement.
 *
 * Two statements cannot both be true here. Insert the reply first and a crash
 * before the update leaves the messages unprocessed, so the turn runs again and
 * the customer is answered twice. Mark them first and a crash before the insert
 * leaves the customer with no answer at all. One function, one transaction, and
 * neither happens.
 *
 * `p_message_ids` is what this turn actually read. Whatever arrived while it was
 * running is deliberately left alone, so the next turn picks it up.
 */
create function public.finish_turn(
  p_tenant_id       uuid,
  p_conversation_id uuid,
  p_message_ids     uuid[],
  p_reply           text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_message_id uuid;
begin
  update public.messages
  set processed_at = now()
  where conversation_id = p_conversation_id
    and tenant_id = p_tenant_id
    and id = any (p_message_ids)
    and processed_at is null;

  if p_reply is null or length(btrim(p_reply)) = 0 then
    return null;
  end if;

  insert into public.messages (
    conversation_id, tenant_id, direction, author, type, body, delivery_state, processed_at
  )
  values (
    p_conversation_id, p_tenant_id, 'outbound', 'agent', 'text', p_reply, 'pending', now()
  )
  returning id into new_message_id;

  return new_message_id;
end
$$;

revoke execute on function public.finish_turn(uuid, uuid, uuid[], text) from public;
revoke execute on function public.finish_turn(uuid, uuid, uuid[], text) from authenticated;
