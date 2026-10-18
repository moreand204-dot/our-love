-- OUR LOVE — Phase 8: إصلاحات وتحصين (شغّله بعد 001..006)

-- (1) إصلاح خطأ: الملف الشخصي كان يُنشأ BEFORE INSERT قبل وجود المستخدم فيفشل الـ FK.
--     الآن: فحص البريد قبل الإدراج، وإنشاء الملف بعده.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
create or replace function public.check_allowed_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from allowed_users where email = lower(new.email)) then
    raise exception 'email not allowed'; end if;
  return new;
end $$;
create trigger on_auth_user_check before insert on auth.users
  for each row execute function public.check_allowed_email();
create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from allowed_users where email = lower(new.email);
  insert into profiles(id, role, display_name)
  values (new.id, r, case r when 'owner' then 'بابا' else 'لوكه' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile_for_user();
-- لو أنشأت المستخدمين قبل هذا الإصلاح وبقوا بلا ملف:
insert into public.profiles(id, role, display_name)
select u.id, a.role, case a.role when 'owner' then 'بابا' else 'لوكه' end
from auth.users u join public.allowed_users a on a.email = lower(u.email)
where not exists (select 1 from public.profiles p where p.id = u.id);

-- (2) الخصوصية: المنشور الخاص لا يظهر حتى في سجل النشاط ولا يُنشئ إشعارًا
create or replace function public.log_and_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); other uuid; k text;
begin
  if tg_table_name = 'posts' and new.visibility = 'private' then return new; end if;
  k := case tg_table_name when 'posts' then 'new_post' else 'new_section' end;
  insert into activity_logs(actor_id, action, entity, entity_id) values (actor, 'insert', tg_table_name, new.id);
  select id into other from profiles where id <> actor limit 1;
  if other is not null then
    insert into notifications(recipient_id, actor_id, type, ref_id, payload)
    values (other, actor, k, new.id, jsonb_build_object('title', coalesce(new.title, '')));
  end if;
  return new;
end $$;

-- (3) الـ Owner يضبط صلاحيات الـ Partner عبر دالة محمية (وليس بتعديل مباشر)
create or replace function public.set_partner_permissions(p_sections boolean, p_theme boolean, p_songs boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  update profiles set can_manage_sections = p_sections, can_edit_theme = p_theme, can_manage_songs = p_songs where role = 'partner';
end $$;
