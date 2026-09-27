/* 造物集 MadeHub · 后端配置
   1) 到 https://supabase.com 用 GitHub 账号登录并创建项目（免费）
   2) 在 SQL Editor 运行 supabase-schema.sql
   3) Project Settings → API：复制 Project URL 和 anon public key 填到下面
   填好后刷新网站即接入真实数据库；留空则站点以“未连接数据库”模式运行。 */
window.MH_CONFIG = {
  SUPABASE_URL: "",        // 例如：https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: "",   // 例如：eyJhbGciOi...（anon public key，可公开）
  /* 支付模式：
     demo = 演示支付（真实订单入库，不发生真实扣款，适合上线初期）
     预留：接入易支付/虎皮椒/微信支付后改为对应值，订单状态机不变 */
  PAY_MODE: "demo",
  /* 平台手续费（与详情页/创作者中心展示一致） */
  FEE_RATE: 0.05,
};
