revoke execute on function public.create_booking_payment(uuid) from anon;
revoke execute on function public.mark_payment_paid(uuid, text) from anon;
revoke execute on function public.cancel_booking_payment(uuid, text) from anon;
revoke execute on function public.quote_booking_refund(uuid) from anon;
revoke execute on function public.cancel_booking(uuid, text) from anon;
revoke execute on function public.complete_booking(uuid) from anon;