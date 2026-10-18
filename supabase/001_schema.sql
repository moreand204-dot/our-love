-- OUR LOVE — Phase 1: schema + RLS + storage
-- شغّله كاملًا في Supabase > SQL Editor

create extension if not exists pgcrypto;

-- ========== الحسابان المسموح بهما فقط ==========
create table public.allowed_users (
  email text primary key check (email = lower(email)),
  role  text not null check (role in ('owner','partner'))
);
-- لا توجد سياسات = لا أحد يقرأها من الواجهة (service role فقط)
alter table public.allowed_users enable row level security;

-- ========== الملفات الشخصية ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null unique check (role in ('owner','partner')),
  display_name text not null default '',
  bio text not null default '',
  words_for_you text not null default '',        -- "كلماتي ليك"
  avatar_path text, cover_path text,
  show_last_seen boolean not null default true,
  last_seen_at timestamptz,
  can_manage_sections boolean not null default true,
  can_edit_theme boolean not null default true,
  can_manage_songs boolean not null default true,
  created_at timestamptz not null default now()
);

-- إنشاء الملف تلقائيًا فقط للبريدين المسموحين
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from allowed_users where email = lower(new.email);
  if r is null then raise exception 'email not allowed'; end if;
  insert into profiles(id, role, display_name)
  values (new.id, r, case r when 'owner' then 'بابا' else 'لوكه' end);
  return new;
end $$;
create trigger on_auth_user_created before insert on auth.users
  for each row execute function public.handle_new_user();

-- دوال الصلاحيات (تُنفَّذ على الخادم)
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid()) $$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role='owner') $$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case p
    when 'sections' then can_manage_sections
    when 'theme' then can_edit_theme
    when 'songs' then can_manage_songs end
    from profiles where id = auth.uid()), false) $$;

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select using (is_member());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- منع المستخدم من تعديل الدور والصلاحيات بنفسه
create or replace function public.lock_profile_perms() returns trigger
language plpgsql as $$
begin
  if new.role <> old.role
     or new.can_manage_sections <> old.can_manage_sections
     or new.can_edit_theme <> old.can_edit_theme
     or new.can_manage_songs <> old.can_manage_songs then
    if not (select is_owner()) then raise exception 'forbidden'; end if;
  end if;
  return new;
end $$;
create trigger profiles_lock before update on public.profiles
  for each row execute function public.lock_profile_perms();

-- ========== الأقسام الديناميكية ==========
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title text not null, description text not null default '',
  icon text not null default 'heart',
  kind text not null check (kind in ('text','photos','videos','memories','quotes','wishlist','events','links','songs','custom')),
  accent_color text not null default '#f472b6' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  card_style text not null default 'glass',
  cover_path text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  can_view  text not null default 'both' check (can_view  in ('both','owner','partner')),
  can_write text not null default 'both' check (can_write in ('both','owner','partner')),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create or replace function public.role_ok(v text) returns boolean
language sql stable security definer set search_path = public as $$
  select v = 'both' or v = (select role from profiles where id = auth.uid()) $$;
alter table public.sections enable row level security;
create policy sections_read on public.sections for select
  using (is_member() and (is_owner() or (is_visible and role_ok(can_view))));
create policy sections_write on public.sections for all
  using (has_perm('sections')) with check (has_perm('sections') and created_by = auth.uid());

-- ========== المنشورات ==========
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete set null,
  author_id uuid not null default auth.uid() references profiles(id),
  title text not null default '', body text not null default '',
  category text, card_color text check (card_color is null or card_color ~ '^#[0-9a-fA-F]{6}$'),
  cover_path text, is_pinned boolean not null default false,
  visibility text not null default 'shared' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.posts (section_id, created_at desc);
create index on public.posts (author_id, created_at desc);
create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  path text not null, caption text not null default '', sort_order int not null default 0
);
create table public.post_favorites (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid default auth.uid() references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
create or replace function public.can_see_post(p posts) returns boolean
language sql stable as $$ select is_member() and (p.visibility='shared' or p.author_id = auth.uid()) $$;
alter table public.posts enable row level security;
create policy posts_read on public.posts for select using (can_see_post(posts));
create policy posts_ins  on public.posts for insert with check (is_member() and author_id = auth.uid());
create policy posts_upd  on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_del  on public.posts for delete using (author_id = auth.uid());
alter table public.post_images enable row level security;
create policy pimg_read on public.post_images for select
  using (exists(select 1 from posts p where p.id = post_id and can_see_post(p)));
create policy pimg_write on public.post_images for all
  using (exists(select 1 from posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists(select 1 from posts p where p.id = post_id and p.author_id = auth.uid()));
alter table public.post_favorites enable row level security;
create policy fav_own on public.post_favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ========== الشات ==========
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,                          -- لمنع تكرار الإرسال عند إعادة المحاولة
  sender_id uuid not null default auth.uid() references profiles(id),
  body text check (char_length(body) <= 4000),
  kind text not null default 'text' check (kind in ('text','image','file','voice')),
  reply_to uuid references messages(id) on delete set null,
  delivered_at timestamptz, read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index on public.messages (created_at desc);
create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  path text not null, mime text not null, size_bytes int not null check (size_bytes <= 26214400),
  duration_ms int
);
alter table public.messages enable row level security;
create policy msg_read on public.messages for select using (is_member());
create policy msg_send on public.messages for insert with check (is_member() and sender_id = auth.uid());
-- المستقبِل فقط يحدّث التسليم/القراءة، والمرسل فقط يحذف (soft delete)
create policy msg_upd  on public.messages for update using (is_member());
create or replace function public.guard_message_update() returns trigger
language plpgsql as $$
begin
  if new.sender_id <> old.sender_id or new.body is distinct from old.body
     or new.kind <> old.kind or new.client_id <> old.client_id then
    raise exception 'immutable'; end if;
  if new.deleted_at is distinct from old.deleted_at and old.sender_id <> auth.uid() then
    raise exception 'only sender can delete'; end if;
  if (new.read_at is distinct from old.read_at or new.delivered_at is distinct from old.delivered_at)
     and old.sender_id = auth.uid() then
    raise exception 'only receiver can mark read'; end if;
  return new;
end $$;
create trigger msg_guard before update on public.messages
  for each row execute function public.guard_message_update();
alter table public.message_attachments enable row level security;
create policy att_read on public.message_attachments for select using (is_member());
create policy att_ins on public.message_attachments for insert
  with check (exists(select 1 from messages m where m.id = message_id and m.sender_id = auth.uid()));

-- ========== الإشعارات + سجل النشاط ==========
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id),
  type text not null, ref_id uuid, payload jsonb not null default '{}',
  read_at timestamptz, created_at timestamptz not null default now()
);
create index on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
create policy notif_read on public.notifications for select using (recipient_id = auth.uid());
create policy notif_upd  on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id), action text not null,
  entity text not null, entity_id uuid, created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;
create policy log_read on public.activity_logs for select using (is_member());
-- الإدخال يتم عبر triggers/دوال security definer فقط

-- ========== الرسائل المفاجئة (الوقت من الخادم) ==========
create table public.surprise_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references profiles(id),
  recipient_id uuid not null references profiles(id),
  body text not null, image_path text,
  reveal_at timestamptz not null default now(),
  opened_at timestamptz, created_at timestamptz not null default now()
);
alter table public.surprise_messages enable row level security;
create policy sup_read on public.surprise_messages for select
  using (sender_id = auth.uid() or (recipient_id = auth.uid() and reveal_at <= now()));
create policy sup_ins on public.surprise_messages for insert with check (sender_id = auth.uid() and recipient_id <> auth.uid());
create policy sup_del on public.surprise_messages for delete using (sender_id = auth.uid());

-- ========== الثيمات والإعدادات ==========
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null, tokens jsonb not null default '{}',
  is_active boolean not null default false,
  created_by uuid references profiles(id), created_at timestamptz not null default now()
);
create unique index one_active_theme on public.themes (is_active) where is_active;
alter table public.themes enable row level security;
create policy theme_read on public.themes for select using (is_member());
create policy theme_write on public.themes for all using (has_perm('theme')) with check (has_perm('theme'));

create table public.relationship_settings (
  id boolean primary key default true check (id),   -- صف واحد فقط
  started_on date, home_quote text not null default 'للوكه حبيبة قلب بابا، هنا مكان حكايتنا وكل حاجة حلوة بينا ♥',
  little_world_text text not null default 'مكان يجمع حكايتنا، ضحكتنا، ذكرياتنا، وكل الكلام اللي مش عارفين نقوله.'
);
insert into public.relationship_settings default values;
alter table public.relationship_settings enable row level security;
create policy rs_read on public.relationship_settings for select using (is_member());
create policy rs_write on public.relationship_settings for update using (is_member()) with check (is_member());

-- ========== Realtime ==========
alter publication supabase_realtime add table public.messages, public.notifications;

-- ========== Storage (خاص بالكامل) ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('media','media',false, 10485760, array['image/jpeg','image/png','image/webp']),
 ('chat','chat',false, 26214400, array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','application/pdf'])
on conflict (id) do nothing;
-- المسار: <user_id>/<filename> ؛ القراءة للحسابين فقط، والكتابة/الحذف لصاحب المجلد
create policy st_read on storage.objects for select
  using (bucket_id in ('media','chat') and is_member());
create policy st_ins on storage.objects for insert
  with check (bucket_id in ('media','chat') and is_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy st_del on storage.objects for delete
  using (bucket_id in ('media','chat') and (storage.foldername(name))[1] = auth.uid()::text);
