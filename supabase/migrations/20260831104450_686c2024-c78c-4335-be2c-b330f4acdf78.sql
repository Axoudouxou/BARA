-- Trigger-only functions: not callable from the API at all
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_teacher_verification() FROM anon, authenticated;

-- Signed-in only RPCs: remove anonymous execution
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_payment(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mark_payment_paid(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_booking_payment(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.quote_booking_refund(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_booking(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_moderate_offer(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_teachers() FROM anon;