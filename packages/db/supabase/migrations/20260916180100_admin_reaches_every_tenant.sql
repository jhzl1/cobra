/**
 * Every policy moves from `is_tenant_member` to `can_access_tenant`.
 *
 * The difference is one person: whoever administers the platform now reads the
 * same rows a member does, without being inserted into `tenant_members` — which
 * would have been the cheap way to do it and would have made "who belongs to
 * this company" a lie.
 *
 * Nothing else changes. Writing stays where it was, and inside a company there
 * is still exactly one role.
 */

-- Tenancy ---------------------------------------------------------------------

drop policy tenants_select_members on public.tenants;
create policy tenants_select_members
  on public.tenants for select to authenticated
  using ((select public.can_access_tenant(id)));

drop policy tenants_update_members on public.tenants;
create policy tenants_update_members
  on public.tenants for update to authenticated
  using ((select public.can_access_tenant(id)))
  with check ((select public.can_access_tenant(id)));

drop policy tenant_members_select_members on public.tenant_members;
create policy tenant_members_select_members
  on public.tenant_members for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

-- The column grant still hides `ciphertext`; this only widens which rows are
-- visible, and `last4` is all any of them shows.
drop policy tenant_credentials_select_members on public.tenant_credentials;
create policy tenant_credentials_select_members
  on public.tenant_credentials for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy whatsapp_numbers_select_members on public.whatsapp_numbers;
create policy whatsapp_numbers_select_members
  on public.whatsapp_numbers for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy payment_methods_select_members on public.payment_methods;
create policy payment_methods_select_members
  on public.payment_methods for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy payment_methods_write_members on public.payment_methods;
create policy payment_methods_write_members
  on public.payment_methods for all to authenticated
  using ((select public.can_access_tenant(tenant_id)))
  with check ((select public.can_access_tenant(tenant_id)));

-- Conversation ----------------------------------------------------------------

drop policy contacts_select_members on public.contacts;
create policy contacts_select_members
  on public.contacts for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy conversations_select_members on public.conversations;
create policy conversations_select_members
  on public.conversations for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy conversations_update_members on public.conversations;
create policy conversations_update_members
  on public.conversations for update to authenticated
  using ((select public.can_access_tenant(tenant_id)))
  with check ((select public.can_access_tenant(tenant_id)));

drop policy messages_select_members on public.messages;
create policy messages_select_members
  on public.messages for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

-- Receipts and payments --------------------------------------------------------

drop policy receipts_select_members on public.receipts;
create policy receipts_select_members
  on public.receipts for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy used_references_select_members on public.used_references;
create policy used_references_select_members
  on public.used_references for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy payment_attempts_select_members on public.payment_attempts;
create policy payment_attempts_select_members
  on public.payment_attempts for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

-- Trace -----------------------------------------------------------------------

drop policy agent_runs_select_members on public.agent_runs;
create policy agent_runs_select_members
  on public.agent_runs for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

drop policy agent_steps_select_members on public.agent_steps;
create policy agent_steps_select_members
  on public.agent_steps for select to authenticated
  using ((select public.can_access_tenant(tenant_id)));

-- Realtime and storage ---------------------------------------------------------

drop policy conversation_broadcast_read on realtime.messages;
create policy conversation_broadcast_read
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = split_part(realtime.topic(), ':', 2)
        and (select public.can_access_tenant(c.tenant_id))
    )
  );

drop policy receipts_read_members on storage.objects;
create policy receipts_read_members
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (select public.can_access_tenant((split_part(name, '/', 1))::uuid))
  );
