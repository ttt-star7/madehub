-- 开启私信实时推送（可选）：运行后对方发消息 1 秒内到达；
-- 不运行也没关系，客户端每 6 秒自动轮询兜底。
-- 用法：Supabase 控制台 → SQL Editor → 粘贴运行一次
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
