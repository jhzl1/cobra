/**
 * What an operator did with a held receipt.
 *
 * A receipt the rules rejected used to end at the administrator's WhatsApp
 * alert: nothing in the panel listed it, and nothing recorded whether someone
 * registered the payment by hand or decided it was not one. The "Pendientes"
 * section reads these columns, and a receipt leaves it once it is resolved.
 *
 * `applying` exists because applying is not instant: the API queues it and the
 * worker talks to Wisphub. Without the state a second click queues a second
 * payment for the same receipt.
 */
alter table public.receipts
  add column resolution text
    check (resolution in ('applying', 'applied', 'dismissed')),
  add column resolved_by uuid references auth.users (id),
  add column resolved_at timestamptz,
  -- Why the last attempt to apply it failed, in words the operator can act on.
  add column resolution_error text;

-- What the section lists: held receipts of one tenant, newest first.
create index receipts_held_idx
  on public.receipts (tenant_id, created_at desc)
  where alert_reason is not null;
