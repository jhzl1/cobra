-- A collection account can now be switched off or removed from the panel.
--
-- Switched off (`is_active = false`): the agent stops offering it, and a receipt
-- paid into it is held with its own reason so the operator knows the money went
-- to an account the company stopped using, not to a stranger's.
--
-- Removed (`archived_at`): the row stays. `receipts.payment_method_id` points
-- here, and deleting the row would set it to null on every receipt that was paid
-- into this account — the same reason `whatsapp_numbers` is retired with
-- `valid_to` instead of deleted.

alter table public.payment_methods
  add column is_active   boolean not null default true,
  add column archived_at timestamptz;

-- An archived account must not stop the company from registering the same one
-- again, so uniqueness only holds among the accounts still on the list.
alter table public.payment_methods
  drop constraint payment_methods_tenant_id_entity_name_payment_address_key;

create unique index payment_methods_live_account_key
  on public.payment_methods (tenant_id, entity_name, payment_address)
  where archived_at is null;
