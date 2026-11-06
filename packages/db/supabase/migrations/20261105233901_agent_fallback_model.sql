/**
 * A second model for the conversation, tried when every provider of the first
 * one fails.
 *
 * On 2026-11-02..04 every turn that failed in development died the same way:
 * OpenRouter's only provider for the chosen model answered 429 three times in a
 * row and the customer got the fallback text. The same request sent to another
 * model would have answered.
 *
 * Only the conversation gets one. The receipt reader has not failed this way,
 * and adding its key later is one more enum value.
 *
 * No seed row: a missing row means "no fallback", which is the behaviour every
 * company had until now. It also keeps this migration to one statement —
 * Postgres refuses to use an enum value in the same transaction that adds it.
 */
alter type public.platform_setting_key add value 'agent_fallback_model';
