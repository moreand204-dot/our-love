-- OUR LOVE — Phase 6: الأغاني والثيمات
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  artist text not null default '', description text not null default '',
  audio_path text, audio_url text, cover_path text,
  is_default boolean not null default false, sort_order int not null default 0,
  created_by uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now(),
  check (audio_path is not null or audio_url is not null),
  check (audio_url is null or audio_url ~ '^https://')
);
create unique index one_default_song on public.songs (is_default) where is_default;
alter table public.songs enable row level security;
create policy songs_read on public.songs for select using (is_member());
create policy songs_ins  on public.songs for insert with check (has_perm('songs') and created_by = auth.uid());
create policy songs_upd  on public.songs for update using (has_perm('songs')) with check (has_perm('songs'));
create policy songs_del  on public.songs for delete using (has_perm('songs'));

create or replace function public.set_default_song(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('songs') then raise exception 'forbidden'; end if;
  update songs set is_default = false where is_default;
  update songs set is_default = true where id = p;
end $$;

create or replace function public.apply_theme(p_name text, p_tokens jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('theme') then raise exception 'forbidden'; end if;
  update themes set is_active = false where is_active;
  insert into themes(name, tokens, is_active, created_by) values (left(p_name, 60), p_tokens, true, auth.uid());
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('songs','songs',false, 20971520, array['audio/mpeg','audio/mp4','audio/ogg','audio/webm','audio/wav'])
on conflict (id) do nothing;
create policy st_songs_read on storage.objects for select using (bucket_id = 'songs' and is_member());
create policy st_songs_ins on storage.objects for insert
  with check (bucket_id = 'songs' and has_perm('songs') and (storage.foldername(name))[1] = auth.uid()::text);
create policy st_songs_del on storage.objects for delete
  using (bucket_id = 'songs' and has_perm('songs'));
