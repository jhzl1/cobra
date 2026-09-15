-- The conversation itself: who wrote, what they wrote, and who is answering.

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  /**
   * Meta's identifier for the person. Today that is the `wa_id` from
   * `contacts[0]`, which is a phone number. Meta is migrating identity to
   * usernames, and when the sender has one the webhook carries `user_id`
   * (`CO.1036773249265400`) and no `wa_id` at all — so this column is text and
   * holds whichever one arrived, never a parsed phone number.
   */
  person_id    text not null,
  -- Null when the sender only has a username. Never used as a key.
  phone        text,
  display_name text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, person_id)
);

create type public.conversation_status as enum ('bot', 'human', 'closed');

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  contact_id       uuid not null references public.contacts (id) on delete cascade,
  status           public.conversation_status not null default 'bot',
  -- The operator holding the conversation while `status = 'human'`.
  assigned_to      uuid references auth.users (id),
  /**
   * Where the agent's memory starts.
   *
   * n8n deleted the customer's conversation documents after a successful payment
   * (`Memory Cleaner v3`). Here nothing is deleted: this mark moves, the agent
   * loads only messages after it, and the panel keeps the whole history — which
   * is the thing the customer of Cobra is paying to see.
   */
  context_reset_at timestamptz,
  -- Last message *from the contact*. This is what Meta's 24-hour service window
  -- is measured from, so the panel can show the operator how long they have left.
  last_inbound_at  timestamptz,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- One open conversation per contact. A closed one can coexist with it.
create unique index conversations_one_open_per_contact_idx
  on public.conversations (tenant_id, contact_id)
  where status <> 'closed';

create index conversations_tenant_activity_idx
  on public.conversations (tenant_id, last_message_at desc nulls last);

create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_author as enum ('contact', 'agent', 'operator');
create type public.message_type as enum ('text', 'image');
create type public.delivery_state as enum ('pending', 'sent', 'failed');

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  direction        public.message_direction not null,
  author           public.message_author not null,
  type             public.message_type not null,
  body             text,
  -- Meta's media id, before the download. `storage_path` is where the bytes
  -- ended up; the image never goes in this table (n8n kept a base64 blob inside
  -- the Mongo document and it made every read expensive).
  media_id         text,
  storage_path     text,
  /**
   * Meta's message id, and the whole deduplication story.
   *
   * Meta delivers at-least-once and retries with backoff for up to seven days
   * when it does not get a 200. Without this constraint a redelivered receipt is
   * a second payment registered against Wisphub.
   *
   * Nullable because an outbound message has no wamid until Meta answers, and
   * Postgres treats nulls as distinct, so those rows do not collide.
   */
  wamid            text unique,
  delivery_state   public.delivery_state,
  delivery_error   text,
  delivery_attempts int not null default 0,
  -- When Meta says the message was created, from `messages[].timestamp`. The
  -- freshness filter measures against this, not against arrival.
  sent_at          timestamptz,
  received_at      timestamptz not null default now(),
  -- Null means the turn has not consumed it yet. The drain job selects on this.
  processed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, received_at);

-- The drain job's query: unprocessed inbound of one conversation, oldest first.
create index messages_unprocessed_idx
  on public.messages (conversation_id, received_at)
  where processed_at is null and direction = 'inbound';

create index messages_pending_delivery_idx
  on public.messages (tenant_id, delivery_state)
  where delivery_state = 'pending';

/**
 * Conversation activity, maintained by the database.
 *
 * In the API this would be a second statement that some path forgets, and the
 * 24-hour window the panel draws would be wrong on exactly the conversations
 * that took an unusual route.
 */
create function public.touch_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set last_message_at = greatest(coalesce(last_message_at, new.received_at), new.received_at),
      last_inbound_at = case
        when new.direction = 'inbound'
          then greatest(coalesce(last_inbound_at, new.received_at), new.received_at)
        else last_inbound_at
      end
  where id = new.conversation_id;

  return null;
end
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row
  execute function public.touch_conversation_activity();

alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy contacts_select_members
  on public.contacts for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

create policy conversations_select_members
  on public.conversations for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));

-- Handoff is the one write the panel does directly: taking a conversation and
-- giving it back. Sending a message is an API call, because it has to reach Meta.
create policy conversations_update_members
  on public.conversations for update to authenticated
  using ((select public.is_tenant_member(tenant_id)))
  with check ((select public.is_tenant_member(tenant_id)));

create policy messages_select_members
  on public.messages for select to authenticated
  using ((select public.is_tenant_member(tenant_id)));
