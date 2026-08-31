REVOKE ALL ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_offer(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_teachers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_teacher_verification() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_teacher_verification(uuid, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_offer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_teachers() TO authenticated;