# Supabase 后端接入步骤（约 5 分钟）

后端使用 Supabase（免费额度足够上线初期）：真实 PostgreSQL 数据库 + 真实邮箱注册/登录 + 图片存储。

## 1. 创建项目（用 GitHub 账号一键登录）

1. 打开 https://supabase.com → 点 **Start your project** → **Sign in with GitHub**（用你现有的 GitHub 账号授权）
2. **New project**：
   - Name：`madehub`
   - Database Password：设置一个强密码（自己保存好，平台不改密码时用不到）
   - Region：选 **Singapore (Southeast)** 或 **Tokyo**（国内访问较快）
3. 点 Create new project，等待约 1 分钟初始化完成

## 2. 建表（复制粘贴即可）

1. 左侧菜单 → **SQL Editor** → **New query**
2. 打开本项目里的 **`supabase-schema.sql`**，全选复制，粘贴进去 → 点 **Run**
3. 显示 `Success. No rows returned` 即成功（建了 13 张表 + 存储桶 + 安全规则）

## 3. 关闭邮箱确认（注册后免验证直接登录）

左侧菜单 → **Authentication** → **Sign In / Up** → 找到 **Confirm email** → 关闭开关 → Save

## 4. 拿到两串密钥发给开发者

左侧菜单 → **Project Settings**（齿轮）→ **API**：

- **Project URL**：形如 `https://xxxxxxxx.supabase.co`
- **anon public** key：一长串 `eyJhbGciOi...`（Project API Keys 里的 `anon` `public` 那一条）

把这两串发给开发者（anon key 本身就是设计为可公开的，数据库安全由 RLS 规则保证；
**千万不要发 `service_role` key**）。

## 5. 开发者接手

收到 URL + anon key 后填入 `config.js` 并推送部署，线上站点即切换为真实数据库模式。

## 安全说明

- 数据库启用了 **RLS（行级安全）**：任何人可读已上线作品/公开资料；写入只允许本人；
  订单只有买家可建、买卖双方可见；通知只有本人可见
- 密码由 Supabase Auth 托管（业界标准 bcrypt 存储），站点代码接触不到明文
- 支付为「演示支付」：真实订单写入数据库但不发生真实扣款；创作者可在设置页上传收款码，
  买家按码转账后标记支付。接入真实微信/支付宝商户后可无缝替换支付网关
