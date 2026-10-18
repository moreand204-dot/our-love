-- OUR LOVE — Phase 4: دعم الشات الفوري
alter publication supabase_realtime add table public.message_attachments;

create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(recipient_id, actor_id, type, ref_id)
  select id, new.sender_id,
    case new.kind when 'voice' then 'new_voice' when 'image' then 'new_image' else 'new_message' end, new.id
  from profiles where id <> new.sender_id;
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();
