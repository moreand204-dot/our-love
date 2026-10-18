-- OUR LOVE — Phase 3: سجل النشاط + إشعار الطرف الآخر (يعمل على الخادم)
create or replace function public.log_and_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); other uuid; kind text; who uuid;
begin
  kind := case tg_table_name when 'posts' then 'new_post' when 'sections' then 'new_section' end;
  if tg_table_name = 'posts' and new.visibility = 'private' then
    insert into activity_logs(actor_id, action, entity, entity_id) values (actor, 'insert', tg_table_name, new.id);
    return new;
  end if;
  insert into activity_logs(actor_id, action, entity, entity_id) values (actor, 'insert', tg_table_name, new.id);
  select id into other from profiles where id <> actor limit 1;
  if other is not null then
    insert into notifications(recipient_id, actor_id, type, ref_id, payload)
    values (other, actor, kind, new.id, jsonb_build_object('title', coalesce(new.title, '')));
  end if;
  return new;
end $$;
create trigger posts_log after insert on public.posts for each row execute function public.log_and_notify();
create trigger sections_log after insert on public.sections for each row execute function public.log_and_notify();

-- تحديث updated_at
create or replace function public.touch_updated() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated();
