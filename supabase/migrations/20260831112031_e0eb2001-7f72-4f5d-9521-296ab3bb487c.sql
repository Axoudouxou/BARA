revoke execute on function public.conversation_role(uuid, uuid) from anon, authenticated;
revoke execute on function public.admin_can_read_conversation(uuid, uuid) from anon, authenticated;
revoke execute on function public.pair_has_booking(uuid, uuid, uuid) from anon, authenticated;
revoke execute on function public.ensure_conversation(uuid, uuid, uuid) from anon;
revoke execute on function public.mark_conversation_read(uuid) from anon;
revoke execute on function public.set_assignment_status(uuid, text) from anon;
revoke execute on function public.admin_read_dispute_conversation(uuid) from anon;
revoke execute on function public.teacher_recent_assignments(integer) from anon;