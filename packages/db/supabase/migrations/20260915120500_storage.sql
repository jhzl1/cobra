-- Receipt images. The bytes never go in a table: n8n kept `imgBase64` inside the
-- Mongo document and made every read of a conversation carry its attachments.
--
-- Private bucket. The panel reads through signed URLs minted by the API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/**
 * Path layout: `<tenant_id>/<conversation_id>/<message_id>.<ext>`.
 *
 * The first segment is the tenant, so membership is one `split_part` away and a
 * member of one tenant cannot name a path belonging to another.
 */
create policy receipts_read_members
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (select public.is_tenant_member((split_part(name, '/', 1))::uuid))
  );

-- Uploads are done by the worker with the secret key; no insert policy here.
