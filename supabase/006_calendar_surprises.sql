-- OUR LOVE — Phase 7: التقويم والرسائل المفاجئة
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '',
  event_date date not null,
  color text not null default '#f472b6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  repeat text not null default 'none' check (repeat in ('none','yearly','monthly')),
  created_by uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);
create index on public.calendar_events (event_date);
alter table public.calendar_events enable row level security;
create policy cal_read on public.calendar_events for select using (is_member());
create policy cal_ins  on public.calendar_events for insert with check (is_member() and created_by = auth.uid());
create policy cal_upd  on public.calendar_events for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy cal_del  on public.calendar_events for delete using (created_by = auth.uid());

-- الرسائل المفاجئة: المستلم يفتحها ويحدّث opened_at فقط
alter table public.surprise_messages add column if not exists notified_at timestamptz;
create policy sup_open on public.surprise_messages for update
  using (recipient_id = auth.uid() and reveal_at <= now()) with check (recipient_id = auth.uid());
create or replace function public.guard_surprise_update() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and (new.body <> old.body or new.image_path is distinct from old.image_path
     or new.recipient_id <> old.recipient_id or new.sender_id <> old.sender_id or new.reveal_at <> old.reveal_at
     or new.notified_at is distinct from old.notified_at) then raise exception 'immutable'; end if;
  return new;
end $$;
create trigger surprise_guard before update on public.surprise_messages for each row execute function public.guard_surprise_update();

-- إشعار المستلم عند حلول الموعد (بساعة الخادم)
create or replace function public.release_surprises() returns void
language plpgsql security definer set search_path = public as $$
begin
  with due as (
    update surprise_messages set notified_at = now()
    where notified_at is null and reveal_at <= now() returning id, sender_id, recipient_id)
  insert into notifications(recipient_id, actor_id, type, ref_id)
  select recipient_id, sender_id, 'new_surprise', id from due;
end $$;
create or replace function public.release_after_insert() returns trigger language plpgsql as
$$ begin perform public.release_surprises(); return new; end $$;
create trigger surprise_release after insert on public.surprise_messages for each row execute function public.release_after_insert();

-- جدولة كل دقيقة (يتطلب تفعيل pg_cron: Database > Extensions)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('release-surprises', '* * * * *', 'select public.release_surprises()');
  else
    raise notice 'pg_cron غير مفعّل: الرسائل المؤجلة ستظهر في موعدها لكن الإشعار لن يصل تلقائيًا.';
  end if;
end $$;
