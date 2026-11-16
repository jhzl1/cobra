-- The customer's WhatsApp username, as Meta sends it in `contacts[].profile.username`.
--
-- A customer who adopted a username shares no phone number, and `person_id`
-- then holds a business-scoped id (`CO.1234567890123456`) that means nothing to
-- an operator. The username is what WhatsApp itself shows for them, so it is what
-- the panel shows and what the operator searches by.
--
-- Null for customers with a phone number, and for username customers who have
-- not written since this column existed. It can change: the webhook overwrites
-- it whenever Meta sends one.
alter table public.contacts
  add column username text;
