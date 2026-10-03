-- ============================================================
-- 造物集 MadeHub · 「纯免费分享版」数据库迁移
-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴全部 → Run
-- 内容：①废弃订单/收益体系 ②新增举报表与“满 5 人自动下架”
-- 可安全重复运行。
-- ============================================================

-- ---------- 1. 移除收费体系遗留 ----------
drop table if exists public.orders cascade;
drop function if exists public.my_earnings();
drop function if exists public.create_order(bigint, uuid, uuid, numeric, text);
alter table public.works drop column if exists price;
alter table public.profiles drop column if exists pay_qr;
alter table public.profiles drop column if exists balance;

-- ---------- 2. 举报表 ----------
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz default now(),
  unique (work_id, reporter)          -- 每人对同一作品只算一次
);
create index if not exists reports_work_idx on public.reports(work_id);
alter table public.reports enable row level security;
-- 举报内容涉及隐私，不开放直接查询；计数经下方安全函数获取
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert to authenticated
  with check (auth.uid() = reporter);

-- ---------- 3. 举报 RPC：记录举报 → 计数 → 满 5 自动下架并通知作者 ----------
create or replace function public.report_work(wid bigint, reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cnt int;
  wrec public.works;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if reason is null or length(btrim(reason)) < 2 then raise exception '举报理由过短'; end if;

  begin
    insert into public.reports (work_id, reporter, reason) values (wid, uid, btrim(reason));
  exception when unique_violation then
    cnt := (select count(*) from public.reports where work_id = wid);
    return jsonb_build_object('count', cnt, 'status', 'already');
  end;

  select count(*) into cnt from public.reports where work_id = wid;

  if cnt >= 5 then
    update public.works set status = 'rejected', updated_at = now() where id = wid
      returning * into wrec;
    if wrec.author is not null then
      insert into public.notifications (user_id, ico, tone, body, go_to, unread)
      values (
        wrec.author, '🚫', '--warn-bg',
        '你的作品《' || wrec.title || '》因被 ' || cnt || ' 人举报，已自动下架。如有异议请联系平台申诉。',
        '#/studio?tab=works', true
      );
    end if;
  end if;

  return jsonb_build_object('count', cnt, 'status', case when cnt >= 5 then 'rejected' else 'ok' end);
end $$;

-- ---------- 完成 ----------
-- 前端无需其他改动配置；刷新网站即生效。
