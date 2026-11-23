/**
 * Dry-run: a company whose agent runs against real traffic without anything
 * leaving towards the customer, the administrator's phone or Wisphub.
 *
 * It exists to train the agent while n8n still answers the same customers. Two
 * systems replying, or registering the same receipt twice in Wisphub, is the
 * cost of getting this wrong, so the default is on — for the companies that
 * already exist too. Turning it off is a deliberate act of the platform admin.
 */
alter table public.tenants
  add column dry_run boolean not null default true;

/**
 * `status` and `dry_run` are the platform's to decide, not the company's.
 *
 * `tenants_update_members` lets a member update their tenant's row, and a policy
 * filters rows, not columns: through PostgREST a member could lift their own
 * suspension or switch off dry-run. Column privileges close that, the same way
 * `tenant_credentials` hides `ciphertext`. The API writes the admin-only columns
 * with the secret key, which these grants do not reach.
 *
 * A column added later is not editable by members until it is granted here.
 * That is the safe direction to fail in.
 */
revoke update on public.tenants from authenticated;
grant update (company_name, support_phone, admin_phone) on public.tenants to authenticated;

/**
 * A reply that dry-run kept from going out.
 *
 * Not `sent`, which would lie to the operator, and not `failed`, which the error
 * tray reads as something to fix. Not `pending` either: nothing will ever send
 * it, and the pending index would carry it forever.
 */
alter type public.delivery_state add value 'dry_run';

/**
 * A payment that only happened in dry-run.
 *
 * A column rather than another `state`: the attempt still ends `confirmed` or
 * `failed` exactly as it would have in production — that is what is being
 * trained — and every existing read of `state` keeps meaning what it meant.
 * Without the mark, a simulated payment is indistinguishable from a real one
 * the day someone reconciles against Wisphub.
 */
alter table public.payment_attempts
  add column dry_run boolean not null default false;
