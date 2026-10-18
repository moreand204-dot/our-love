-- OUR LOVE — اختبارات الصلاحيات (RLS). شغّله في Supabase SQL Editor بعد 001..007 وبعد إنشاء الحسابين.
-- يعمل داخل transaction ويتراجع بالكامل في النهاية (لا يترك بيانات).
-- لو ظهر خطأ يبدأ بكلمة FAIL فالاختبار فشل. لو وصلت لسطر ALL PASSED فكلها نجحت.
begin;
select set_config('t.owner',   (select id::text from public.profiles where role = 'owner'),   true);
select set_config('t.partner', (select id::text from public.profiles where role = 'partner'), true);

-- ===== كـ Owner: بيانات الاختبار =====
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into public.posts(title, body, visibility) values ('t_private', 'x', 'private'), ('t_shared', 'x', 'shared');
insert into public.messages(client_id, body, kind) values (gen_random_uuid(), 'hello', 'text');
insert into public.surprise_messages(recipient_id, body, reveal_at) values (current_setting('t.partner')::uuid, 't_future', now() + interval '1 day');
insert into public.surprise_messages(recipient_id, body, reveal_at) values (current_setting('t.partner')::uuid, 't_past', now() - interval '1 minute');
reset role;

-- ===== كـ Partner =====
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.partner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  if exists (select 1 from public.posts where title = 't_private') then raise exception 'FAIL: partner sees owner private post'; end if;
  if not exists (select 1 from public.posts where title = 't_shared') then raise exception 'FAIL: partner cannot see shared post'; end if;
  update public.posts set title = 'hacked' where title = 't_shared'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner edited owners post'; end if;
  if exists (select 1 from public.surprise_messages where body = 't_future') then raise exception 'FAIL: surprise visible before reveal_at'; end if;
  if not exists (select 1 from public.surprise_messages where body = 't_past') then raise exception 'FAIL: due surprise not visible'; end if;
  begin update public.messages set body = 'tampered' where body = 'hello'; raise exception 'FAIL: message body edit allowed';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update public.profiles set can_edit_theme = true, role = 'owner' where id = current_setting('t.partner')::uuid; raise exception 'FAIL: partner escalated privileges';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.set_partner_permissions(true, true, true); raise exception 'FAIL: partner called owner-only function';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
reset role;

-- ===== الـ Owner يسحب صلاحية الأقسام، والـ Partner لا يستطيع إنشاء قسم =====
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_partner_permissions(false, false, false);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.partner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin insert into public.sections(slug, title, kind, created_by) values ('t-sec', 't', 'text', auth.uid()); raise exception 'FAIL: section created without permission';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin perform public.apply_theme('x', '{}'::jsonb); raise exception 'FAIL: theme applied without permission';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
reset role;

-- ===== شخص غريب (مستخدم غير معروف) لا يرى شيئًا =====
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL: stranger reads profiles'; end if;
  if (select count(*) from public.messages) <> 0 then raise exception 'FAIL: stranger reads messages'; end if;
  if (select count(*) from public.posts) <> 0 then raise exception 'FAIL: stranger reads posts'; end if;
  if (select count(*) from public.allowed_users) <> 0 then raise exception 'FAIL: stranger reads allowed_users'; end if;
end $$;
reset role;

-- ===== زائر بلا تسجيل دخول (anon) =====
set local role anon;
do $$ begin
  begin perform 1 from public.messages limit 1; if found then raise exception 'FAIL: anon reads messages'; end if;
  exception when insufficient_privilege then null; when others then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
reset role;

rollback;
select 'ALL PASSED' as result;  -- ملاحظة: بعد rollback يبقى هذا السطر للتأكيد فقط
