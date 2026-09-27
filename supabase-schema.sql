-- ============================================================
-- 造物集 MadeHub · Supabase 数据库初始化脚本
-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴全部 → Run
-- 只需运行一次。重复运行会报"已存在"，可忽略。
-- ============================================================

-- ---------- 0. 用户资料表（配合 auth.users） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  bio text default '这位创作者很神秘，什么都没有写。',
  avatar jsonb default '{}'::jsonb,          -- {"type":"letter"} | {"type":"zodiac","v":"龙"} | {"type":"img","url":"..."}
  bg text default 'aurora',
  bg_img text default null,
  quote text default '创造，是最好的表达',
  verified boolean default false,
  level int default 1,
  pay_qr text default null,                  -- 创作者收款码图片 URL（演示支付用）
  balance numeric default 0,
  joined text default '',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);

-- 新用户注册时自动创建资料（昵称取 meta，冲突则加后缀）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base text; nick text; n int := 0;
begin
  base := coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'nickname', '')), ''), split_part(new.email, '@', 1), '用户');
  nick := base;
  while exists (select 1 from public.profiles where nickname = nick) loop
    n := n + 1; nick := base || n;
  end loop;
  insert into public.profiles (id, nickname, joined)
  values (new.id, nick, to_char(now(), 'YYYY-MM'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------- 1. 作品 ----------
create table if not exists public.works (
  id bigint generated always as identity primary key,
  author uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  descr text default '',
  type text default '其他',
  tags text[] default '{}',
  price numeric default 0 check (price >= 0),
  cover jsonb default '{}'::jsonb,           -- {"emoji":"🧩","g":0,"url":null}
  shots text[] default '{}',                 -- 图片 URL / dataURL 数组
  link_kind text default 'pan',              -- 'pan' 网盘 | 'url' 网址
  pan_brand text, pan_url text, pan_code text, pan_exp text default '长期有效',
  site_url text,                             -- 网址作品的链接
  status text default 'pending',             -- pending | online | off | rejected
  downloads bigint default 0,
  likes bigint default 0,
  views bigint default 0,
  ver text default 'v1.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists works_author_idx on public.works(author);
create index if not exists works_status_idx on public.works(status);
alter table public.works enable row level security;
drop policy if exists "works_public_read" on public.works;
create policy "works_public_read" on public.works for select using (status = 'online' or author = auth.uid());
drop policy if exists "works_author_write" on public.works;
create policy "works_author_write" on public.works for insert with check (auth.uid() = author);
drop policy if exists "works_author_update" on public.works;
create policy "works_author_update" on public.works for update using (auth.uid() = author);
drop policy if exists "works_author_delete" on public.works;
create policy "works_author_delete" on public.works for delete using (auth.uid() = author);

-- ---------- 2. 订单（担保交易：托管 → 确认收货 → 打款） ----------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  buyer uuid not null references public.profiles(id),
  seller uuid not null references public.profiles(id),
  amount numeric not null check (amount >= 0),
  fee numeric generated always as (round(amount * 0.05, 2)) stored,
  net numeric generated always as (round(amount * 0.95, 2)) stored,
  status text default 'paid',                -- paid 托管中 | confirmed 已完成 | refunded 已退款
  pay_method text default 'demo',            -- demo 演示支付 | wxpay | alipay（预留）
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  unique (work_id, buyer)
);
create index if not exists orders_buyer_idx on public.orders(buyer);
create index if not exists orders_seller_idx on public.orders(seller);
alter table public.orders enable row level security;
drop policy if exists "orders_party_read" on public.orders;
create policy "orders_party_read" on public.orders for select using (auth.uid() = buyer or auth.uid() = seller);
drop policy if exists "orders_buyer_insert" on public.orders;
create policy "orders_buyer_insert" on public.orders for insert with check (auth.uid() = buyer);
drop policy if exists "orders_buyer_confirm" on public.orders;
create policy "orders_buyer_confirm" on public.orders for update using (auth.uid() = buyer);

-- ---------- 3. 社区动态 ----------
create table if not exists public.feed_posts (
  id bigint generated always as identity primary key,
  author uuid not null references public.profiles(id) on delete cascade,
  topic text default '动态',
  body text not null,
  tags text[] default '{}',
  item_id bigint references public.works(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.feed_posts enable row level security;
drop policy if exists "feed_read" on public.feed_posts;
create policy "feed_read" on public.feed_posts for select using (true);
drop policy if exists "feed_insert" on public.feed_posts;
create policy "feed_insert" on public.feed_posts for insert with check (auth.uid() = author);
drop policy if exists "feed_delete" on public.feed_posts;
create policy "feed_delete" on public.feed_posts for delete using (auth.uid() = author);

create table if not exists public.post_likes (
  post_id bigint references public.feed_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "post_likes_read" on public.post_likes;
create policy "post_likes_read" on public.post_likes for select using (true);
drop policy if exists "post_likes_write" on public.post_likes;
create policy "post_likes_write" on public.post_likes for insert with check (auth.uid() = user_id);
drop policy if exists "post_likes_del" on public.post_likes;
create policy "post_likes_del" on public.post_likes for delete using (auth.uid() = user_id);

create table if not exists public.post_comments (
  id bigint generated always as identity primary key,
  post_id bigint references public.feed_posts(id) on delete cascade,
  author uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
alter table public.post_comments enable row level security;
drop policy if exists "post_cmt_read" on public.post_comments;
create policy "post_cmt_read" on public.post_comments for select using (true);
drop policy if exists "post_cmt_insert" on public.post_comments;
create policy "post_cmt_insert" on public.post_comments for insert with check (auth.uid() = author);

-- ---------- 4. 作品评论 ----------
create table if not exists public.work_comments (
  id bigint generated always as identity primary key,
  work_id bigint references public.works(id) on delete cascade,
  author uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
alter table public.work_comments enable row level security;
drop policy if exists "work_cmt_read" on public.work_comments;
create policy "work_cmt_read" on public.work_comments for select using (true);
drop policy if exists "work_cmt_insert" on public.work_comments;
create policy "work_cmt_insert" on public.work_comments for insert with check (auth.uid() = author);

-- ---------- 5. 评价 ----------
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  work_id bigint references public.works(id) on delete cascade,
  author uuid references public.profiles(id) on delete cascade,
  rating int default 5 check (rating between 1 and 5),
  body text not null,
  created_at timestamptz default now(),
  unique (work_id, author)
);
alter table public.reviews enable row level security;
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select using (true);
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews for insert with check (auth.uid() = author);

-- ---------- 6. 关注 ----------
create table if not exists public.follows (
  follower uuid references public.profiles(id) on delete cascade,
  followee uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower, followee)
);
alter table public.follows enable row level security;
drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows for select using (true);
drop policy if exists "follows_write" on public.follows;
create policy "follows_write" on public.follows for insert with check (auth.uid() = follower);
drop policy if exists "follows_del" on public.follows;
create policy "follows_del" on public.follows for delete using (auth.uid() = follower);

-- ---------- 7. 通知 ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  ico text default '🔔',
  tone text default '--accent-soft',
  body text not null,
  go_to text default '',
  unread boolean default true,
  created_at timestamptz default now()
);
create index if not exists notif_user_idx on public.notifications(user_id);
alter table public.notifications enable row level security;
drop policy if exists "notif_own_read" on public.notifications;
create policy "notif_own_read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notif_own_update" on public.notifications;
create policy "notif_own_update" on public.notifications for update using (auth.uid() = user_id);

-- ---------- 8. 私信 ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conv text not null,                        -- 会话键：两个用户 id 排序后用“|”连接
  sender uuid references public.profiles(id),
  receiver uuid references public.profiles(id),
  body text not null,
  created_at timestamptz default now()
);
create index if not exists messages_conv_idx on public.messages(conv);
alter table public.messages enable row level security;
drop policy if exists "messages_read" on public.messages;
create policy "messages_read" on public.messages for select using (auth.uid() = sender or auth.uid() = receiver);
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert with check (auth.uid() = sender);

-- ---------- 9. 计数类 RPC（security definer，绕过 RLS 做原子增减） ----------
create or replace function public.bump_work_likes(wid bigint, delta int)
returns int language sql security definer set search_path = public as $$
  update public.works set likes = greatest(0, likes + delta) where id = wid returning likes;
$$;

create or replace function public.bump_work_downloads(wid bigint)
returns void language sql security definer set search_path = public as $$
  update public.works set downloads = downloads + 1 where id = wid;
$$;

create or replace function public.bump_work_views(wid bigint)
returns void language sql security definer set search_path = public as $$
  update public.works set views = views + 1 where id = wid;
$$;

-- 点赞/取消赞动态（返回 {liked, count}）
create or replace function public.toggle_post_like(pid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cnt int; liked bool;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.post_likes where post_id = pid and user_id = uid) then
    delete from public.post_likes where post_id = pid and user_id = uid;
    liked := false;
  else
    insert into public.post_likes (post_id, user_id) values (pid, uid);
    liked := true;
  end if;
  select count(*) into cnt from public.post_likes where post_id = pid;
  return jsonb_build_object('liked', liked, 'count', cnt);
end $$;

-- 创作者收益汇总（仅本人可查）
create or replace function public.my_earnings()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', coalesce((select sum(net) from public.orders where seller = auth.uid() and status = 'confirmed'), 0),
    'month', coalesce((select sum(net) from public.orders where seller = auth.uid() and status = 'confirmed' and created_at > now() - interval '30 days'), 0),
    'escrow', coalesce((select sum(amount) from public.orders where seller = auth.uid() and status = 'paid'), 0)
  );
$$;

-- ---------- 10. 存储桶（封面 / 截图 / 头像等图片，公开读） ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_auth_write" on storage.objects;
create policy "media_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'media');

-- ---------- 完成 ----------
-- 提示：Supabase 控制台 → Authentication → Sign In/Up，
-- 建议关闭 "Confirm email"（邮箱确认），注册后即可直接登录。
