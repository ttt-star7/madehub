-- 评论回评功能：给作品评论和动态评论加 parent_id（嵌套回复）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴运行一次
alter table public.work_comments add column if not exists parent_id bigint references public.work_comments(id) on delete cascade;
alter table public.post_comments add column if not exists parent_id bigint references public.post_comments(id) on delete cascade;
