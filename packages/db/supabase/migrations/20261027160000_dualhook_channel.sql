/**
 * WhatsApp goes through Dualhook, not Meta directly (decision of 2026-10-27).
 *
 * Inbound: Dualhook's Webhook Override makes Meta deliver to a self-hosted n8n,
 * which forwards the identical body to `/wh/wa/:tenantSlug/:webhookToken`.
 * Outbound and media: Dualhook's Runtime API, with one `dh_live_` key per
 * connection and nothing beside it.
 */

/**
 * The provider is renamed rather than added: a tenant has exactly one WhatsApp
 * channel, and keeping `meta` around would let the setup checklist count a
 * credential the worker no longer reads.
 *
 * The Meta access tokens stored under it are useless to Dualhook — its Runtime
 * API answers 401 to them — so they are removed instead of left to read as
 * "connected" in the panel. The operator loads each company's Dualhook key
 * again in Configuración → Credenciales. Until then the worker refuses to act
 * for that company (MissingCredentialError) rather than sending with a dead
 * token. The app secret that rode in the same envelope goes with them: Meta now
 * signs with Dualhook's app secret, which no tenant has.
 */
delete from public.tenant_credentials where provider = 'meta';

alter type public.credential_provider rename value 'meta' to 'dualhook';

/**
 * Meta's GET handshake is answered by n8n, which owns the URL Dualhook points
 * Meta at. Nothing in Cobra compares a verify token any more. The webhook token
 * stays: it is the only thing that authenticates the forwarded POST.
 */
alter table public.whatsapp_numbers drop column verify_token;
