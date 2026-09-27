# 部署指南（三选一，按 ease 排序）

站点已打包在本目录：`index.html` + `styles.css` + `app.js` + `README.md`，git 已提交完毕。
任何静态托管都能跑，无需构建。

---

## 方式 A：让我来部署（最快，约 1 分钟）

在对话里发我两条信息：

1. 你的 **GitHub 用户名**
2. 一个 **Personal Access Token**（在 https://github.com/settings/tokens → Generate new token (classic) → 勾选 `repo` 权限 → 生成后复制）

我会自动完成：创建公开仓库 → 推送 → 开启 GitHub Pages → 验证公网地址
（得到 `https://<用户名>.github.io/<仓库名>`，可被搜索引擎收录）。

> Token 用完可在 GitHub 上随时撤销；我只用它完成本次部署。

## 方式 B：自己在 GitHub 网页操作（约 3 分钟，不需要 Token）

1. 打开 https://github.com/new → 仓库名填 `madehub` → 选 **Public** → Create（不要勾选任何初始化选项）
2. 回到本目录执行（把 `<用户名>` 换成你的）：

   ```bash
   cd C:/Users/95233/.zcode/workspace/default/madehub-site
   git remote add origin https://github.com/<用户名>/madehub.git
   git push -u origin main
   ```

   （推送时弹出的登录窗口用浏览器授权即可；或要求密码时粘贴 Token）
3. 仓库页面 → Settings → Pages → Branch 选 `main` + `/(root)` → Save
4. 等 1–2 分钟，访问 `https://<用户名>.github.io/madehub/`

## 方式 C：Netlify Drop（全鼠标操作，需注册 Netlify）

1. 打开 https://app.netlify.com/drop 并登录
2. 把本目录整个文件夹拖进页面 → 立即得到 `https://随机名.netlify.app`
3. Site settings → Change site name 改成 `madehub-xxx` 固化地址

---

## 上线后建议

- **搜索引擎收录**：新站需要几天自然收录；想加快可在 Bing Webmaster Tools / Google Search Console 提交 `https://你的地址/sitemap.xml`（可后续让我生成）
- **国内访问**：GitHub Pages 国内直连速度不稳定；若主要面向国内用户，可后续托管到 Gitee Pages（需实名）或 Cloudflare Pages（免费、国内可达性更好）
- **自定义域名**：任一平台都支持绑定自己买的域名并自动配 HTTPS
