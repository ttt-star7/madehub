-- 真实周期榜数据源：记录每次下载事件，日/周/月/年榜据此统计
-- 用法：Supabase 控制台 → SQL Editor → 粘贴运行一次
create table if not exists public.download_log (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists download_log_work_idx on public.download_log(work_id);
alter table public.download_log enable row level security;
drop policy if exists "dl_log_read" on public.download_log;
create policy "dl_log_read" on public.download_log for select using (true);

-- 升级下载计数 RPC：每次下载同时写入 download_log（周期榜数据源）
create or replace function public.bump_work_downloads(wid bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.download_log (work_id) values (wid);
  update public.works set downloads = downloads + 1 where id = wid;
$$;
