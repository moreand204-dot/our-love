-- OUR LOVE — Phase 5: الألبومات والصور
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  created_by uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references albums(id) on delete set null,
  uploader_id uuid not null default auth.uid() references profiles(id),
  path text not null, title text not null default '', description text not null default '',
  taken_on date, created_at timestamptz not null default now()
);
create index on public.photos (album_id, created_at desc);
create index on public.photos (uploader_id);
alter table public.albums enable row level security;
alter table public.photos enable row level security;
create policy albums_read on public.albums for select using (is_member());
create policy albums_ins  on public.albums for insert with check (is_member() and created_by = auth.uid());
create policy albums_upd  on public.albums for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy albums_del  on public.albums for delete using (created_by = auth.uid());
create policy photos_read on public.photos for select using (is_member());
create policy photos_ins  on public.photos for insert with check (is_member() and uploader_id = auth.uid());
create policy photos_upd  on public.photos for update using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
create policy photos_del  on public.photos for delete using (uploader_id = auth.uid());

create or replace function public.notify_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_logs(actor_id, action, entity, entity_id) values (new.uploader_id, 'insert', 'photos', new.id);
  insert into notifications(recipient_id, actor_id, type, ref_id)
  select id, new.uploader_id, 'new_photo', new.id from profiles where id <> new.uploader_id;
  return new;
end $$;
create trigger photos_notify after insert on public.photos for each row execute function public.notify_photo();
