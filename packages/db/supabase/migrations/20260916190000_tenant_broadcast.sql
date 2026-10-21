/**
 * A channel per company, so the panel learns about a conversation it does not
 * have open.
 *
 * Until now the only topic was `conversation:<uuid>`, which the panel joins for
 * the chat it is showing. That is everything the open conversation needs and
 * nothing the inbox does: a message arriving in another chat reached nobody, and
 * an operator looking at the list saw it only after reloading.
 *
 * Topic: `tenant:<uuid>`.
 *
 * `agent_steps` deliberately does not feed it. One turn writes between ten and
 * thirty of them and every operator of the company is joined here — the timeline
 * belongs on the conversation's own channel, where exactly one screen is
 * listening.
 */
create function public.broadcast_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tenant uuid := coalesce(
    (case when tg_op = 'DELETE' then null else new.tenant_id end),
    (case when tg_op = 'INSERT' then null else old.tenant_id end)
  );
begin
  if tenant is null then
    return null;
  end if;

  -- Wrapped for the same reason the conversation emitter is: an exception raised
  -- inside an `after` trigger aborts the business INSERT, and a customer's
  -- message must not fail to be stored because Realtime was briefly unhappy.
  begin
    perform realtime.broadcast_changes(
      'tenant:' || tenant::text,
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

create trigger messages_tenant_broadcast
  after insert or update on public.messages
  for each row execute function public.broadcast_tenant_change();

create trigger conversations_tenant_broadcast
  after insert or update on public.conversations
  for each row execute function public.broadcast_tenant_change();

/**
 * What makes the channel private. A second policy beside
 * `conversation_broadcast_read`: for SELECT they are OR'd, so each topic is
 * judged by its own rule.
 *
 * `can_access_tenant` is the same function every table uses, so a member reaches
 * their company's channel and whoever administers the platform reaches any.
 */
create policy tenant_broadcast_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 1) = 'tenant'
    and (select public.can_access_tenant((split_part(realtime.topic(), ':', 2))::uuid))
  );
