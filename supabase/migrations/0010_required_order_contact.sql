-- Require contact details on every new order. Existing historical orders with
-- missing phone numbers remain readable and are not rewritten.
alter table orders
  add constraint orders_phone_required
  check (phone is not null and length(trim(phone)) >= 7)
  not valid;

alter table orders
  add constraint orders_email_not_blank
  check (length(trim(email)) > 0)
  not valid;