/* ============================================================
   造物集 MadeHub — 交互逻辑（纯前端演示，无依赖）
   ============================================================ */
"use strict";
window.addEventListener("error", (e) => { const d = document.createElement("div"); d.style.cssText = "position:fixed;top:0;left:0;z-index:9999;background:#fee;color:#900;padding:8px;font:12px monospace;max-width:100%;white-space:pre-wrap"; d.textContent = "ERR: " + e.message + " @line " + e.lineno; document.body.appendChild(d); });
try {

/* ---------- 渐变色板 ---------- */
const GRADS = [
  ["#6366F1", "#A855F7"], ["#F59E0B", "#EF4444"], ["#10B981", "#0EA5E9"],
  ["#EC4899", "#8B5CF6"], ["#06B6D4", "#3B82F6"], ["#84CC16", "#10B981"],
  ["#F97316", "#EC4899"], ["#8B5CF6", "#6366F1"], ["#14B8A6", "#84CC16"],
  ["#EF4444", "#F59E0B"], ["#0EA5E9", "#6366F1"], ["#D946EF", "#F97316"],
];
const PRESET_TAGS = ["skill","软件","插件","素材","模型","翻译","效率","办公","设计","编程","数据","写作","音频","视频","教育","图像","娱乐"];

/* ---------- 账号 / 社区 / 创作者中心数据（全部由 db.js 从数据库加载） ---------- */
let ME = null;            // 当前登录用户昵称；由 Supabase 会话驱动，未登录为 null
let MYUID = null;         // 当前登录用户 uuid
const ZODIAC = [
  ["鼠", "🐭", 0], ["牛", "🐮", 3], ["虎", "🐯", 9], ["兔", "🐰", 2], ["龙", "🐲", 3], ["蛇", "🐍", 6],
  ["马", "🐴", 8], ["羊", "🐑", 5], ["猴", "🐵", 10], ["鸡", "🐔", 1], ["狗", "🐶", 11], ["猪", "🐷", 4],
];
const USERS = {};        // nickname -> 资料对象（启动时从数据库填充）
let ITEMS = [];          // 已上线作品（数据库填充）
const OWNED = new Set(); // 当前登录用户已购买的作品 dbid
const MY = { items: [], purchased: [], txs: [], today: 0, month: 0, total: 0, balance: 0, chart: [0, 0, 0, 0, 0, 0, 0] };
let NOTIFS = [];         // 通知（登录后从数据库加载）
const FOLLOWING = new Set();
const FEED = [];         // 社区动态（数据库填充）
let CONVS = [];          // 私信会话（数据库填充）
const TOPICS = [
  { n: "教程", hot: 0 }, { n: "展示", hot: 0 }, { n: "避坑", hot: 0 },
  { n: "更新", hot: 0 }, { n: "求助", hot: 0 }, { n: "动态", hot: 0 },
];
function nickHash(s) { let h = 0; for (const ch of String(s)) h = (h + ch.charCodeAt(0)) % 9973; return h % 12; }
function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
  if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
  if (diff < 172800) return "昨天";
  return iso.slice(0, 10);
}

/* ---------- 工具 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const grad = (i) => GRADS[i % GRADS.length];
const fmtDl = (n) => n >= 10000 ? (n / 10000).toFixed(1) + "w" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600); };

/* ---------- 状态 ---------- */
const state = { q: "", tag: "", type: "全部", price: "全部", sort: "new" };

/* ---------- 卡片渲染 ---------- */
function statusChip(it) {
  return it.price === 0
    ? `<span class="mini-chip mini-chip-status-free">免费</span>`
    : `<span class="mini-chip mini-chip-status-paid">¥${it.price}</span>`;
}
function cardHTML(it, i = 0) {
  const [g1, g2] = grad(it.g);
  const coverInner = it.coverURL
    ? `<img class="cover-img" src="${it.coverURL}" alt="">`
    : `<span class="cover-emoji">${it.emoji}</span>`;
  return `
  <article class="card" data-id="${it.id}" style="--i:${i % 12}" tabindex="0" role="button" aria-label="${esc(it.title)}">
    <div class="card-cover" style="--g1:${g1};--g2:${g2}">
      ${coverInner}
      <span class="badge ${it.price === 0 ? "badge-free" : "badge-paid"}">${it.price === 0 ? "免费" : "¥" + it.price}</span>
      <div class="cover-actions"><button class="like-btn${it.liked ? " liked" : ""}" aria-label="收藏" data-like><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-10-9.3C.4 8 2.4 4.5 6 4.5c2.2 0 3.6 1.1 4.5 2.6l1.5 2.4 1.5-2.4c.9-1.5 2.3-2.6 4.5-2.6 3.6 0 5.6 3.5 4 7.2C19.5 16.3 12 21 12 21z"/></svg></button></div>
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(it.title)}</h3>
      <div class="card-tags">${statusChip(it)}${it.tags.map((t) => `<span class="mini-chip mini-chip-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join("")}</div>
      <div class="card-foot">
        <span class="author"><i style="--g1:${g1};--g2:${g2}">${esc(it.author[0])}</i><span>${esc(it.author)}</span></span>
        <span class="dl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>${fmtDl(it.downloads)}</span>
      </div>
    </div>
  </article>`;
}

function filtered() {
  let list = ITEMS.filter((it) => {
    if (state.type !== "全部" && it.type !== state.type) return false;
    if (state.price === "免费" && it.price !== 0) return false;
    if (state.price === "付费" && it.price === 0) return false;
    if (state.tag && !it.tags.includes(state.tag)) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      const hay = (it.title + it.tags.join("") + it.author + it.desc).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (state.sort === "new") list.sort((a, b) => b.id - a.id);
  if (state.sort === "hot") list.sort((a, b) => b.likes - a.likes);
  if (state.sort === "dl") list.sort((a, b) => b.downloads - a.downloads);
  return list;
}

function renderGrid() {
  const list = filtered();
  $("#grid").innerHTML = list.map((it, i) => cardHTML(it, i)).join("");
  $("#empty").hidden = list.length > 0;
  renderActiveFilters();
}

function renderActiveFilters() {
  let el = $("#activeFilters");
  if (!el) { el = document.createElement("div"); el.id = "activeFilters"; el.className = "chips"; el.style.margin = "0 0 18px"; $(".filter-bar").after(el); }
  const chips = [];
  if (state.tag) chips.push(`<button class="chip chip-free" data-clear="tag">${esc(state.tag)} ×</button>`);
  if (state.q) chips.push(`<button class="chip chip-free" data-clear="q">“${esc(state.q)}” ×</button>`);
  el.innerHTML = chips.join("");
  el.style.display = chips.length ? "flex" : "none";
}

/* ---------- 筛选栏 ---------- */
function buildFilterBar() {
  const types = ["全部", "skill", "软件", "插件", "素材", "模型", "其他"];
  $("#typeChips").innerHTML = types.map((t) => `<button class="chip${t === state.type ? " on" : ""}" data-type="${t}">${t}</button>`).join("");
  $("#priceChips").innerHTML = ["全部", "免费", "付费"].map((p) => {
    const cls = p === "免费" ? " chip-free" : p === "付费" ? " chip-paid" : "";
    return `<button class="chip${p === state.price ? " on" : ""}${cls}" data-price="${p}">${p}</button>`;
  }).join("");
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip,[data-clear]");
  if (!chip) return;
  if (chip.dataset.clear) { state[chip.dataset.clear] = ""; if (chip.dataset.clear === "q") $("#searchInput").value = ""; }
  else if (chip.dataset.type) state.type = chip.dataset.type;
  else if (chip.dataset.price && chip.closest("#priceChips,#searchPop")) state.price = chip.dataset.price;
  else if (chip.dataset.tag) { state.tag = state.tag === chip.dataset.tag ? "" : chip.dataset.tag; }
  buildFilterBar(); renderGrid();
});

/* 卡片：点标签 = 筛选；点收藏 = 收藏；其余 = 打开详情 */
$("#grid").addEventListener("click", (e) => {
  const like = e.target.closest("[data-like]");
  if (like) {
    e.stopPropagation();
    const it = ITEMS.find((x) => x.id === +like.closest(".card").dataset.id);
    it.liked = !it.liked; like.classList.toggle("liked", it.liked);
    toast(it.liked ? "❤️ 已加入收藏" : "已取消收藏");
    return;
  }
  const tagChip = e.target.closest(".mini-chip-tag");
  if (tagChip) { e.stopPropagation(); state.tag = tagChip.dataset.tag; buildFilterBar(); renderGrid(); window.scrollTo({ top: 220, behavior: "smooth" }); return; }
  const card = e.target.closest(".card");
  if (card) openDetail(ITEMS.find((x) => x.id === +card.dataset.id));
});
$("#grid").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.classList.contains("card")) openDetail(ITEMS.find((x) => x.id === +e.target.dataset.id)); });

/* ---------- 搜索 + 热门标签快选 ---------- */
$("#popTags").innerHTML = PRESET_TAGS.slice(0, 10).map((t) => `<button class="chip" data-tag="${t}">${t}</button>`).join("");
const searchEl = $("#search"), searchInput = $("#searchInput");
searchInput.addEventListener("focus", () => searchEl.classList.add("open"));
searchInput.addEventListener("input", () => { state.q = searchInput.value.trim(); if ($("#view-explore").hidden) location.hash = "#/"; renderGrid(); });
document.addEventListener("click", (e) => { if (!searchEl.contains(e.target)) searchEl.classList.remove("open"); });
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") { e.preventDefault(); searchInput.focus(); }
  if (e.key === "Escape") { closeAllModals(); searchEl.classList.remove("open"); notifPop.hidden = true; userPop.hidden = true; }
});
$("#sortSel").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
$("#clearFilter").addEventListener("click", () => { Object.assign(state, { q: "", tag: "", type: "全部", price: "全部" }); searchInput.value = ""; buildFilterBar(); renderGrid(); });

/* ---------- 弹窗通用（带退出动画） ---------- */
function openModal(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeAllModals() {
  $$(".modal").forEach((m) => {
    if (m.hidden) return;
    m.classList.add("closing");
    setTimeout(() => { if (m.classList.contains("closing")) { m.hidden = true; m.classList.remove("closing"); } }, 190);
  });
  if (typeof loginModal !== "undefined" && loginModal && !loginModal.hidden) resetLoginPanel();
  document.body.style.overflow = "";
}
$$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeAllModals(); }));

/* ---------- 详情弹窗 ---------- */
function shotHTML(it, i, main = false) {
  const [g1, g2] = grad(it.g + i);
  const caps = ["功能总览", "使用演示", "效果预览"];
  const shotImg = it.shots && it.shots[i];
  const bg = shotImg ? `;background-image:url(${shotImg});background-size:cover;background-position:center`
    : (main && i === 0 && it.coverURL ? `;background-image:url(${it.coverURL});background-size:cover;background-position:center` : "");
  const hasImg = !!bg;
  return `<div class="${main ? "shot" : "thumb"}${main ? " main" : ""}" style="--g1:${g1};--g2:${g2}${bg}" data-shot="${i}">
    ${main ? `<span class="dots"><i></i><i></i><i></i></span>` : ""}
    ${hasImg ? "" : `<span class="${main ? "shot-emoji" : ""}">${it.emoji}</span>`}
    ${main && !hasImg ? `<span class="shot-cap">${caps[i] || "细节展示"} · ${esc(it.title)}</span>` : ""}
  </div>`;
}
function starsHTML(v) { const f = Math.max(0, Math.min(5, Math.round(v))); return "★".repeat(f) + `<span class="off">${"★".repeat(5 - f)}</span>`; }
function cmtHTML(c) { const [g1, g2] = grad(c.a.length % GRADS.length); return `<div class="cmt" style="--g1:${g1};--g2:${g2}"><i data-goto-user="${esc(c.a)}" style="cursor:pointer">${esc(c.a[0])}</i><div class="c-bubble"><b data-goto-user="${esc(c.a)}" style="cursor:pointer">${esc(c.a)}</b><p>${esc(c.t)}</p><small>${c.time || "刚刚"}</small></div></div>`; }
function recordBuy(it, price) { if (!MY.purchased.some((b) => b.id === it.id)) MY.purchased.unshift({ id: it.id, time: new Date().toISOString().slice(0, 10), price }); }
function openPan(it) {
  const link = it.link;
  if (!link || !link.url) { toast("该作品暂无可用链接"); return; }
  if (!/^https?:\/\//i.test(link.url)) { toast("该作品的链接无效"); return; }
  if (link.code) navigator.clipboard?.writeText(link.code).catch(() => {});
  window.open(link.url, "_blank", "noopener");
  it.downloads++;
  if (DB.isOnline() && it.dbid) DB.bump(it.dbid, "dl");
  toast(link.code ? `已打开${link.pan}，提取码「${link.code}」已自动复制，粘贴即可` : `已打开${link.pan}分享页`);
}
function openSite(it) {
  const u = it.siteUrl || "";
  if (!validSiteUrl(u)) { toast("该作品的网址无效，请联系创作者"); return; }
  window.open(u, "_blank", "noopener");
  it.downloads = (it.downloads || 0) + 1;
  if (DB.isOnline() && it.dbid) DB.bump(it.dbid, "dl");
  toast("🌐 已在新标签页打开作品网址");
}
let payItemCur = null;
function openPay(it) {
  payItemCur = it;
  const [g1, g2] = grad(it.g);
  $("#payItem").innerHTML = `<span class="cov" style="--g1:${g1};--g2:${g2}">${it.emoji}</span><div style="flex:1;min-width:0"><b>${esc(it.title)}</b><small>${esc(it.author)} · ${it.linkKind === "url" ? "网址作品" : esc(it.link?.pan || "")}</small></div><span class="pp">¥${it.price}</span>`;
  const btn = $("#payConfirm");
  btn.disabled = false; btn.classList.remove("done");
  btn.textContent = "确认支付 ¥" + it.price;
  $$("#payMethods .pay-v").forEach((x, i) => x.classList.toggle("on", i === 0));
  openModal("#payModal");
}
$("#payConfirm").addEventListener("click", async () => {
  const it = payItemCur; if (!it || !it.price) return;
  if (!ME) { openLogin("login"); return; }
  const btn = $("#payConfirm");
  btn.disabled = true; btn.textContent = "支付中…";
  try {
    /* 演示支付：真实订单入库（不发生真实扣款）；接入真实支付网关后此处替换为下单+回调 */
    if (DB.isOnline()) { const uid = await DB.uid(); await DB.createOrder(it, uid); }
    OWNED.add(it.id); recordBuy(it, it.price);
    btn.classList.add("done"); btn.textContent = "✓ 支付成功";
    toast("✅ 支付成功，作品已解锁");
    setTimeout(() => {
      closeAllModals();
      if (it.linkKind === "url") openSite(it); else openPan(it);
    }, 650);
  } catch (e2) {
    btn.disabled = false; btn.textContent = "确认支付 ¥" + it.price;
    toast("支付失败：" + (e2.message || e2));
  }
});
function openDetail(it) {
  const [g1, g2] = grad(it.g);
  const related = ITEMS.filter((x) => x.id !== it.id && x.tags.some((t) => it.tags.includes(t))).slice(0, 3);
  $("#detailBody").innerHTML = `
    <div class="detail-gallery" style="--g1:${g1};--g2:${g2}">
      <div id="shotMain">${shotHTML(it, 0, true)}</div>
      <div class="thumbs">${[0, 1, 2].map((i) => shotHTML(it, i)).join("")}</div>
    </div>
    <aside class="detail-info" style="--g1:${g1};--g2:${g2}">
      <div class="detail-tags">${statusChip(it)}${it.tags.map((t) => `<span class="mini-chip mini-chip-tag">${esc(t)}</span>`).join("")}</div>
      <h2 class="detail-title">${esc(it.title)}</h2>
      <div class="detail-author"><i data-goto-user="${esc(it.author)}" style="cursor:pointer">${esc(it.author[0])}</i><div><b data-goto-user="${esc(it.author)}" style="cursor:pointer">${esc(it.author)}</b><small>认证创作者 · ${fmtDl(it.downloads)} 次下载</small></div>${it.author !== ME ? `<button class="follow-btn" data-dm title="发私信">✉️</button>` : ""}<button class="follow-btn" data-follow>${FOLLOWING.has(it.author) ? "已关注 ✓" : "+ 关注"}</button></div>
      <p class="detail-desc">${esc(it.desc)}</p>
      <div style="display:flex;gap:16px"><span class="mini-link" data-share>🔗 分享作品</span><span class="mini-link" data-report>⚠️ 举报</span></div>
      <ul class="meta-list">
        ${it.linkKind === "url" ? `
        <li><span>访问方式</span><b>网址直达</b></li>
        <li><span>访问权限</span><b>${it.price === 0 ? "免费直接访问" : "支付解锁后访问"}</b></li>` : it.link ? `
        <li><span>网盘</span><b>${esc(it.link.pan)}</b></li>
        <li><span>提取码</span><b>${it.link.code ? esc(it.link.code) : "无需提取码"}</b></li>
        <li><span>有效期</span><b>${esc(it.link.exp || "长期有效")}</b></li>` : `
        <li><span>文件格式</span><b>${it.fmt}</b></li>
        <li><span>文件大小</span><b>${it.size}</b></li>`}
        <li><span>版本</span><b>${it.ver}</b></li>
        <li><span>更新时间</span><b>${it.updated}</b></li>
      </ul>
      <div class="buy-box">
        ${it.price === 0 ? "" : `<div class="escrow-flow" style="margin-bottom:12px">
          <span class="ef-step">付款托管</span><i>→</i>
          <span class="ef-step">下载使用</span><i>→</i>
          <span class="ef-step on">确认收货</span><i>→</i>
          <span class="ef-step">打款卖家</span>
        </div>`}
        <div class="buy-row">
          <div class="buy-price">${it.price === 0 ? "免费" : "¥" + it.price}<small>${it.price === 0 ? "无需付费，直接获取" : OWNED.has(it.id) ? "已购买 · 永久可用" : "一次购买，永久使用与更新"}</small></div>
          <button class="btn btn-primary buy-btn" data-buy>${it.price === 0 || OWNED.has(it.id) ? (it.linkKind === "url" ? "打开网站" : "打开网盘") : "付费解锁"}</button>
        </div>
        <div class="buy-note">${it.price === 0
          ? (it.linkKind === "url" ? "点击按钮即可直接访问作品网址" : "点击打开网盘链接，提取码将自动复制到剪贴板")
          : OWNED.has(it.id)
            ? (it.linkKind === "url" ? "已购买 · 点击按钮访问作品网址" : "已购买 · 点击打开网盘链接，提取码自动复制")
            : (it.linkKind === "url" ? "支付解锁后即可访问作品网址 · 平台交易保障 · 手续费仅 5%" : "付款后即可打开网盘链接 · 平台交易保障，确认收货后打款 · 手续费仅 5%")}</div>
      </div>
    </aside>
    <section class="detail-extra">
      <div class="xblock">
        <h4>⭐ 评分与评价 <span class="cnt">${it.rating} · ${it.ratingCnt} 人评价</span></h4>
        <div class="rating-line"><span class="big">${it.rating}</span><span class="stars">${starsHTML(it.rating)}</span></div>
        ${it.reviews.map((r) => { const [rg1, rg2] = grad(r.a.length + 3); return `<div class="review" style="--g1:${rg1};--g2:${rg2}"><div class="rv-head"><i data-goto-user="${esc(r.a)}" style="cursor:pointer">${esc(r.a[0])}</i><b data-goto-user="${esc(r.a)}" style="cursor:pointer">${esc(r.a)}</b><span class="stars">${starsHTML(r.s)}</span><small>${r.time}</small></div><p>${esc(r.t)}</p></div>`; }).join("")}
      </div>
      <div class="xblock">
        <h4>💬 评论 <span class="cnt" id="cmtCnt">${it.comments.length} 条</span></h4>
        <div id="cmtList">${it.comments.map(cmtHTML).join("")}</div>
        <div class="cmt-input" style="margin-top:14px"><input id="cmtInput" placeholder="写下你的评论…（回车发送）"><button class="btn btn-primary" id="cmtSend" style="height:38px;padding:0 16px">发送</button></div>
      </div>
    </section>
    ${related.length ? `<section class="detail-more"><h4>你可能会喜欢</h4><div class="more-row">${related.map((r) => { const [rg1, rg2] = grad(r.g); return `<a class="more-card" data-rel="${r.id}" style="--g1:${rg1};--g2:${rg2}"><span class="more-cover">${r.emoji}</span><span><b>${esc(r.title)}</b><small>${r.price === 0 ? "免费" : "¥" + r.price} · ${fmtDl(r.downloads)} 下载</small></span></a>`; }).join("")}</div></section>` : ""}`;
  openModal("#detailModal");

  $("#shotMain").parentElement.querySelector(".thumbs").addEventListener("click", (e) => {
    const th = e.target.closest("[data-shot]"); if (!th) return;
    $("#shotMain").innerHTML = shotHTML(it, +th.dataset.shot, true);
    $$(".thumb").forEach((t) => t.classList.toggle("on", t === th));
  });
  $("#detailBody").querySelector("[data-follow]").addEventListener("click", (e) => {
    if (FOLLOWING.has(it.author)) {
      FOLLOWING.delete(it.author); e.target.textContent = "+ 关注"; toast("已取消关注 " + it.author);
      if (DB.isOnline() && MYUID) DB.setFollow(MYUID, it.author, false);
    } else {
      FOLLOWING.add(it.author); e.target.textContent = "已关注 ✓"; toast("已关注 " + it.author + "，动态会推送到社区");
      if (DB.isOnline() && MYUID) DB.setFollow(MYUID, it.author, true);
    }
  });
  $("#detailBody").querySelector("[data-buy]").addEventListener("click", () => {
    const unlocked = it.price === 0 || OWNED.has(it.id);
    if (unlocked) {
      if (it.linkKind === "url") { openSite(it); if (!OWNED.has(it.id)) recordBuy(it, 0); return; }
      openPan(it);
      if (!OWNED.has(it.id)) { recordBuy(it, 0); if (DB.isOnline() && it.dbid) DB.bump(it.dbid, "dl"); }
      return;
    }
    if (!ME) { openPay(it); openLogin("login"); return; }
    openPay(it);
  });
  const dmBtn = $("#detailBody").querySelector("[data-dm]");
  if (dmBtn) dmBtn.addEventListener("click", () => openDM(it.author));
  $("#detailBody").querySelector("[data-share]").addEventListener("click", () => { navigator.clipboard?.writeText(location.href.split("?")[0] + "?view=detail&id=" + it.id).catch(() => {}); toast("🔗 链接已复制，快去分享吧"); });
  $("#detailBody").querySelector("[data-report]").addEventListener("click", () => toast("已收到举报，平台会在 24h 内核实"));
  const sendCmt = async () => {
    const v = $("#cmtInput").value.trim(); if (!v) return;
    if (DB.isOnline() && it.dbid) { try { const u = await DB.uid(); await DB.insertWorkComment(it.dbid, v, u); } catch (e2) { toast("评论同步失败：" + (e2.message || e2)); return; } }
    it.comments.unshift({ a: ME, t: v, time: "刚刚" });
    $("#cmtList").innerHTML = it.comments.map(cmtHTML).join("");
    $("#cmtCnt").textContent = it.comments.length + " 条";
    $("#cmtInput").value = "";
    toast("💬 评论已发布");
  };
  $("#cmtSend").addEventListener("click", sendCmt);
  $("#cmtInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendCmt(); });
  $$("#detailBody [data-rel]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openDetail(ITEMS.find((x) => x.id === +a.dataset.rel)); }));
}

/* ---------- 上传向导 ---------- */
const up = { step: 1, link: { url: "", pan: "", code: "", exp: "长期有效" }, linkMode: "pan", siteUrl: "", cover: 0, tags: [], priceMode: "free", shots: [] };
const COVERS = [
  ["🧩", 0], ["🚀", 4], ["🎨", 3], ["🤖", 7], ["📦", 10], ["🔮", 6], ["🌿", 5], ["⚡", 1],
];
function buildCoverPicker() {
  let html = "";
  if (up.customCover) {
    html += `<button class="cover-opt${up.cover === 8 ? " on" : ""}" data-cover="8" title="自定义封面"><img class="cov-img" src="${up.customCover}" alt=""></button>`;
  }
  html += COVERS.map(([e, gi], i) => `<button class="cover-opt${i === up.cover ? " on" : ""}" data-cover="${i}" style="--g1:${grad(gi)[0]};--g2:${grad(gi)[1]}">${e}</button>`).join("");
  html += `<button class="cover-opt add" data-cover="add" type="button" title="上传图片，自定义裁剪为封面"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>上传封面</button>`;
  $("#coverPicker").innerHTML = html;
}

/* ---------- 封面自定义裁剪（拖拽平移 + 滑杆/滚轮缩放） ---------- */
const crop = { img: null, base: 1, zoom: 1, tx: 0, ty: 0, w: 0, h: 0 };
const STAGE = 264, cropStage = $("#cropStage");
function loadCrop(file) {
  const r = new FileReader();
  r.onload = () => openCrop(String(r.result));
  r.readAsDataURL(file);
}
function openCrop(src) {
  const im = new Image();
  im.onload = () => {
    crop.img = im; crop.w = im.width; crop.h = im.height;
    crop.base = Math.max(STAGE / im.width, STAGE / im.height);
    crop.zoom = 1; $("#cropZoom").value = 1;
    crop.tx = (STAGE - crop.w * crop.base) / 2;
    crop.ty = (STAGE - crop.h * crop.base) / 2;
    $("#cropImg").src = src;
    $("#cropWrap").hidden = false;
    applyCrop();
  };
  im.src = src;
}
function applyCrop() {
  const draw = crop.base * crop.zoom;
  const minX = Math.min(0, STAGE - crop.w * draw), minY = Math.min(0, STAGE - crop.h * draw);
  crop.tx = Math.max(minX, Math.min(0, crop.tx));
  crop.ty = Math.max(minY, Math.min(0, crop.ty));
  $("#cropImg").style.transform = `translate(${crop.tx}px,${crop.ty}px) scale(${draw})`;
}
function setZoom(z, anchor) {
  z = Math.max(1, Math.min(3, z));
  const a = anchor || { x: STAGE / 2, y: STAGE / 2 };
  const d0 = crop.base * crop.zoom, d1 = crop.base * z;
  crop.tx = a.x - (a.x - crop.tx) * (d1 / d0);
  crop.ty = a.y - (a.y - crop.ty) * (d1 / d0);
  crop.zoom = z;
  $("#cropZoom").value = z;
  applyCrop();
}
let cropDrag = null;
cropStage.addEventListener("pointerdown", (e) => {
  cropDrag = { x: e.clientX, y: e.clientY, tx: crop.tx, ty: crop.ty };
  cropStage.setPointerCapture(e.pointerId);
});
cropStage.addEventListener("pointermove", (e) => {
  if (!cropDrag) return;
  crop.tx = cropDrag.tx + (e.clientX - cropDrag.x);
  crop.ty = cropDrag.ty + (e.clientY - cropDrag.y);
  applyCrop();
});
cropStage.addEventListener("pointerup", () => (cropDrag = null));
cropStage.addEventListener("pointercancel", () => (cropDrag = null));
cropStage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = cropStage.getBoundingClientRect();
  setZoom(crop.zoom * (e.deltaY < 0 ? 1.1 : 0.9), { x: e.clientX - rect.left, y: e.clientY - rect.top });
}, { passive: false });
$("#cropZoom").addEventListener("input", (e) => setZoom(+e.target.value, null));
$("#cropCancel").addEventListener("click", () => ($("#cropWrap").hidden = true));

/* ---------- 内容图片（作品截图，最多 6 张，展示在详情页画廊） ---------- */
function fileToDataURL(file, maxW = 1280) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const scale = Math.min(1, maxW / im.width);
        if (scale >= 1) return resolve(String(r.result));
        const cv = document.createElement("canvas");
        cv.width = Math.round(im.width * scale);
        cv.height = Math.round(im.height * scale);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", 0.85));
      };
      im.onerror = () => resolve(String(r.result));
      im.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}
function renderShotPicker() {
  $("#shotPicker").innerHTML = up.shots.map((s, i) => `
    <div class="shot-thumb"><img src="${s}" alt="内容图片 ${i + 1}">
      <button class="shot-rm" data-shot-rm="${i}" type="button" aria-label="删除图片">×</button>
      ${i === 0 ? '<span class="shot-cover-tag">主图</span>' : ""}
    </div>`).join("") + (up.shots.length < 6 ? `<button class="shot-add" id="shotAdd" type="button">＋<span>添加图片</span></button>` : "");
}
$("#shotPicker").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-shot-rm]");
  if (rm) { up.shots.splice(+rm.dataset.shotRm, 1); renderShotPicker(); return; }
  if (e.target.closest("#shotAdd")) $("#shotInput").click();
});
$("#shotInput").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, 6 - up.shots.length);
  for (const f of files) up.shots.push(await fileToDataURL(f));
  if (files.length) toast(`已添加 ${files.length} 张图片（${up.shots.length}/6）`);
  renderShotPicker();
  e.target.value = "";
});
function makeSampleShots() {
  const pairs = [["#F59E0B", "#EF4444"], ["#10B981", "#3B82F6"], ["#0EA5E9", "#6366F1"]];
  return pairs.map(([c1, c2], k) => {
    const cv = document.createElement("canvas"); cv.width = 960; cv.height = 600;
    const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, 960, 600);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    c.fillStyle = g; c.fillRect(0, 0, 960, 600);
    c.fillStyle = "rgba(255,255,255,.92)"; c.font = "bold 64px sans-serif"; c.textAlign = "center";
    c.fillText("作品截图 " + (k + 1), 480, 320);
    return cv.toDataURL("image/jpeg", 0.85);
  });
}
/* 上传头像/背景的模拟违规审核 */
const avFile = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
const bgFile = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
avFile.hidden = bgFile.hidden = true;
document.body.appendChild(avFile); document.body.appendChild(bgFile);
function auditUpload(kind, apply) {
  const chipEl = kind === "av" ? $("#avAudit") : $("#bgAudit");
  if (!chipEl) return;
  chipEl.innerHTML = '<span class="audit-chip">AI 审核中…</span>';
  setTimeout(() => {
    if (!chipEl.isConnected) return;
    if (Math.random() < 0.15) {
      chipEl.innerHTML = '<span class="audit-chip" style="background:#FEE2E2;color:#DC2626">违规拦截</span>';
      toast("❌ 图片未通过违规审核（模拟），请更换图片");
    } else {
      chipEl.innerHTML = '<span class="audit-chip" style="background:var(--free-bg);color:var(--free)">审核通过</span>';
      apply();
      toast("✅ 审核通过，已生效");
      addNotif({ ico: "🖼️", bg: "--free-bg", text: `你上传的自定义${kind === "av" ? "头像" : "主页背景"}已通过审核并生效`, time: "刚刚", go: "#/profile/" + encodeURIComponent(ME) });
    }
  }, 1700 + Math.random() * 900);
}
/* 上传图片到存储桶：仅接受 data:image/* 内联内容（防 SSRF），路径做白名单清洗 */
async function pushImage(path, dataURL) {
  if (typeof dataURL !== "string" || !dataURL.startsWith("data:image/")) throw new Error("仅支持内联图片内容");
  const safePath = String(path).replace(/[^\w./-]/g, "_");
  return DB.uploadMedia(safePath, dataURL);
}
avFile.addEventListener("change", async () => {
  const f = avFile.files[0]; if (!f) return;
  let url = await fileToDataURL(f, 320);
  if (DB.isOnline() && MYUID) { try { url = await pushImage(`avatars/${MYUID}/${Date.now()}.jpg`, url); } catch (e) { toast("图片上传失败：" + (e.message || e)); avFile.value = ""; return; } }
  auditUpload("av", () => {
    USERS[ME].avatar = { type: "img", url };
    if (DB.isOnline() && MYUID) DB.updateProfile(MYUID, { avatar: USERS[ME].avatar }).catch(() => {});
    renderUserChip(); renderStudio("settings");
  });
  avFile.value = "";
});
bgFile.addEventListener("change", async () => {
  const f = bgFile.files[0]; if (!f) return;
  let url = await fileToDataURL(f, 1600);
  if (DB.isOnline() && MYUID) { try { url = await pushImage(`bgs/${MYUID}/${Date.now()}.jpg`, url); } catch (e) { toast("图片上传失败：" + (e.message || e)); bgFile.value = ""; return; } }
  auditUpload("bg", () => {
    USERS[ME].bgImg = url; USERS[ME].bg = null;
    if (DB.isOnline() && MYUID) DB.updateProfile(MYUID, { bg_img: url, bg: null }).catch(() => {});
    renderStudio("settings");
  });
  bgFile.value = "";
});
$("#cropOk").addEventListener("click", () => {
  const draw = crop.base * crop.zoom;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 640;
  cv.getContext("2d").drawImage(crop.img, -crop.tx / draw, -crop.ty / draw, STAGE / draw, STAGE / draw, 0, 0, 640, 640);
  up.customCover = cv.toDataURL("image/jpeg", 0.88);
  up.cover = 8;
  buildCoverPicker();
  $("#cropWrap").hidden = true;
  toast("✅ 封面已裁剪，可在下方预览");
});
function renderTagSelected() {
  $("#tagSelected").innerHTML = up.tags.map((t) => `<span class="tag-sel">${esc(t)}<button data-rm="${esc(t)}" aria-label="移除标签">×</button></span>`).join("");
  const full = up.tags.length >= 3;
  const counter = $("#tagCounter");
  counter.textContent = `${up.tags.length} / 3` + (full ? "（已选满，移除后可更换）" : "");
  counter.classList.toggle("full", full);
  suggestTags($("#tagInput").value);
}
function suggestTags(q) {
  const full = up.tags.length >= 3;
  const list = PRESET_TAGS.filter((t) => !up.tags.includes(t) && (!q || t.includes(q.toLowerCase()))).slice(0, 12);
  $("#tagSuggest").innerHTML = list.length
    ? list.map((t) => `<button class="chip${full ? "" : ""}" data-add="${t}" ${full ? "disabled style='opacity:.4'" : ""}>${t}</button>`).join("")
    : `<span style="font-size:12.5px;color:var(--ink3);padding:4px">没有匹配的预设标签，可直接回车创建「${esc(q)}」</span>`;
}
function renderPreview() {
  const title = $("#upTitle").value.trim() || "你的作品标题";
  const custom = up.cover === 8 && up.customCover;
  const it = { id: 0, title, emoji: custom ? "🖼️" : COVERS[up.cover][0], g: custom ? 0 : COVERS[up.cover][1], coverURL: custom ? up.customCover : null, tags: up.tags, price: up.priceMode === "free" ? 0 : (+$("#upPrice").value || 0), author: "澄", downloads: 0 };
  $("#previewMini").innerHTML = `<div class="hint">📈 发布后卡片预览</div><div style="max-width:260px">${cardHTML(it)}</div>`;
}
function updateWizard() {
  $$(".upload-step").forEach((s) => (s.hidden = +s.dataset.step !== up.step));
  $$("#stepDots .step").forEach((s) => { const n = +s.dataset.step; s.classList.toggle("on", n === up.step); s.classList.toggle("done", n < up.step); s.querySelector("i").textContent = n < up.step ? "✓" : n; });
  $("#stepBack").hidden = up.step === 1;
  $("#stepNext").textContent = up.step === 3 ? "发布作品 🚀" : "下一步";
  const hints = { 1: "第 1 步 / 共 3 步 · 选择文件与封面", 2: "第 2 步 / 共 3 步 · 最多 3 个标签", 3: "第 3 步 / 共 3 步 · 发布后即上架" };
  $("#stepHint").textContent = hints[up.step];
  validateStep();
}
function validateStep() {
  let ok = false, msg = "";
  if (up.step === 1) {
    ok = up.linkMode === "url" ? validSiteUrl(up.siteUrl) : !!up.link.pan;
    msg = ok ? "" : up.linkMode === "url" ? "请填写 http(s):// 开头的有效网址" : "请粘贴网盘分享链接";
  }
  if (up.step === 2) {
    ok = $("#upTitle").value.trim().length > 0 && $("#upDesc").value.trim().length > 0 && up.tags.length > 0;
    msg = ok ? "" : !$("#upTitle").value.trim() ? "请填写标题" : !$("#upDesc").value.trim() ? "请填写功能介绍" : "至少选择 1 个标签";
    renderPreview();
  }
  if (up.step === 3) { ok = up.priceMode === "free" || +$("#upPrice").value >= 1; msg = ok ? "" : "请设置 1 元以上的价格"; renderPreview(); }
  $("#stepNext").disabled = !ok;
  $("#stepHint").textContent = msg || $("#stepHint").textContent;
}

/* Step 1：网盘链接（自动识别平台） */
const PANS = [
  [/pan\.baidu\.com/i, "百度网盘"],
  [/aliyundrive\.com|alipan\.com/i, "阿里云盘"],
  [/pan\.quark\.cn/i, "夸克网盘"],
  [/lanzou[a-z]?\.com/i, "蓝奏云"],
  [/123pan\.com|123684\.com/i, "123 云盘"],
  [/caiyun\.139\.com/i, "移动云盘"],
  [/share\.weiyun\.com/i, "腾讯微云"],
  [/115\.com/i, "115 网盘"],
  [/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i, "OneDrive"],
];
function detectPan(v) { for (const [re, name] of PANS) if (re.test(v)) return name; return ""; }
$("#panUrl").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  const pan = detectPan(v);
  up.link.url = v; up.link.pan = pan;
  $("#panDetect").hidden = !pan;
  $("#panErr").hidden = !(v && !pan);
  if (pan) $("#panBrand").innerHTML = `🌐 <b style="color:var(--ink)">${pan}</b>`;
  validateStep();
});
$("#panCode").addEventListener("input", (e) => { up.link.code = e.target.value.trim().toUpperCase(); });
$("#panExpiry").addEventListener("click", (e) => {
  const c = e.target.closest("[data-exp]"); if (!c) return;
  up.link.exp = c.dataset.exp;
  $$("#panExpiry .chip").forEach((x) => x.classList.toggle("on", x === c));
});
/* Step 1：网盘 / 网址 双模式（网址作品：免费直跳，付费解锁后跳转） */
function validSiteUrl(v) {
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h)) return false;
    if (/^(::1|\[::1\]|\[f[cd])/i.test(h) || /\.local$/i.test(h) || !h.includes(".")) return false;
    return true;
  } catch (_) { return false; }
}
function applyLinkMode() {
  if ($("#panFields")) $("#panFields").hidden = up.linkMode !== "pan";
  if ($("#urlField")) $("#urlField").hidden = up.linkMode !== "url";
  $$("#linkKindTabs .chip").forEach((x) => x.classList.toggle("on", x.dataset.lk === up.linkMode));
  validateStep();
}
$("#linkKindTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-lk]"); if (!b) return; up.linkMode = b.dataset.lk; applyLinkMode(); });
$("#siteUrl").addEventListener("input", (e) => {
  up.siteUrl = e.target.value.trim();
  $("#siteErr").hidden = !up.siteUrl || validSiteUrl(up.siteUrl);
  validateStep();
});
$("#coverPicker").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cover]"); if (!b) return;
  if (b.dataset.cover === "add") { $("#coverInput").click(); return; }
  up.cover = +b.dataset.cover; buildCoverPicker();
});
$("#coverInput").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) loadCrop(f); e.target.value = ""; });

/* Step 2：标签选择器 */
/* Step 2：标签选择器（点击输入框弹出，点其他空白处收起） */
function openTagSuggest() { $("#tagSuggest").hidden = false; suggestTags($("#tagInput").value.trim()); }
function closeTagSuggest() { $("#tagSuggest").hidden = true; }
$("#tagInput").addEventListener("focus", openTagSuggest);
$("#tagInput").addEventListener("input", (e) => { openTagSuggest(); suggestTags(e.target.value.trim()); });
document.addEventListener("click", (e) => { if (!e.target.closest(".tag-select")) closeTagSuggest(); });
$("#tagInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const v = e.target.value.trim().toLowerCase();
  if (!v || up.tags.length >= 3) return;
  if (!up.tags.includes(v)) up.tags.push(v);
  e.target.value = ""; renderTagSelected(); validateStep();
});
$("#tagSelected").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; up.tags = up.tags.filter((t) => t !== b.dataset.rm); renderTagSelected(); validateStep(); });
$("#tagSuggest").addEventListener("click", (e) => {
  const b = e.target.closest("[data-add]"); if (!b || up.tags.length >= 3) return;
  up.tags.push(b.dataset.add); $("#tagInput").value = ""; renderTagSelected(); validateStep();
});
["upTitle", "upDesc"].forEach((id) => $("#" + id).addEventListener("input", () => { validateStep(); renderPreview(); }));

/* Step 3：定价 */
$(".price-options").addEventListener("click", (e) => {
  const b = e.target.closest(".price-opt"); if (!b) return;
  up.priceMode = b.dataset.price;
  $$(".price-opt").forEach((x) => x.classList.toggle("on", x === b));
  $("#priceField").hidden = up.priceMode !== "paid";
  $("#escrowNote").hidden = up.priceMode !== "paid";
  validateStep();
});
$("#upPrice").addEventListener("input", () => { validateStep(); renderPreview(); });

/* 步骤流转 */
$("#uploadBtn").addEventListener("click", () => {
  if (!requireLogin()) return;
  Object.assign(up, { step: 1, cover: 0, tags: [], priceMode: "free", customCover: null, shots: [], link: { url: "", pan: "", code: "", exp: "长期有效" }, linkMode: "pan", siteUrl: "" });
  $("#upTitle").value = ""; $("#upDesc").value = ""; $("#upPrice").value = "";
  $("#panUrl").value = ""; $("#panCode").value = ""; $("#panDetect").hidden = true; $("#panErr").hidden = true;
  $("#siteUrl").value = ""; $("#siteErr").hidden = true;
  $$("#panExpiry .chip").forEach((x, i) => x.classList.toggle("on", i === 0));
  applyLinkMode();
  $("#cropWrap").hidden = true;
  buildCoverPicker(); renderTagSelected(); renderShotPicker(); updateWizard();
  openModal("#uploadModal");
});
$("#stepBack").addEventListener("click", () => { if (up.step > 1) { up.step--; updateWizard(); } });
$("#stepNext").addEventListener("click", async () => {
  if (up.step < 3) { up.step++; updateWizard(); return; }
  const custom = up.cover === 8 && up.customCover;
  const gi = custom ? 0 : COVERS[up.cover][1];
  const title = $("#upTitle").value.trim();
  /* 进入创作者中心的「审核中」列表 */
  const entry = { mid: "m" + Date.now(), title, emoji: custom ? "🖼️" : COVERS[up.cover][0], g: gi, coverURL: custom ? up.customCover : null, status: "pending", price: up.priceMode === "free" ? 0 : +$("#upPrice").value, views: 0, downloads: 0, revenue: 0, date: new Date().toISOString().slice(0, 10), shots: [...up.shots], link: up.linkMode === "pan" ? { ...up.link } : null, linkKind: up.linkMode, siteUrl: up.linkMode === "url" ? up.siteUrl : "" };
  MY.items.unshift(entry);
  closeAllModals();
  toast("📤 已提交审核，预计 2 小时内完成（演示约 5 秒）");
  /* 数据库入库：图片先上传存储桶，再写作品表 */
  let dbid = null;
  if (DB.isOnline()) {
    try {
      const uid = await DB.uid();
      const pub = { ...entry, desc: $("#upDesc").value.trim(), type: up.tags.includes("skill") ? "skill" : (up.tags[0] || "其他"), tags: [...up.tags], ver: "v1.0", author: ME };
      if (pub.coverURL && pub.coverURL.startsWith("data:image/")) pub.coverURL = await pushImage(`covers/${uid}/${Date.now()}.jpg`, pub.coverURL);
      for (let i = 0; i < pub.shots.length; i++) if (pub.shots[i].startsWith("data:image/")) pub.shots[i] = await pushImage(`shots/${uid}/${Date.now()}_${i}.jpg`, pub.shots[i]);
      entry.coverURL = pub.coverURL; entry.shots = pub.shots;
      const created = await DB.insertWork(pub, uid);
      dbid = created.dbid; entry.dbid = dbid; entry.id = dbid;
    } catch (e) { toast("⚠️ 数据库同步失败：" + (e.message || e)); }
  }
  /* 演示：5 秒后自动过审上线（真实数据库中状态同步更新） */
  setTimeout(async () => {
    entry.status = "online";
    if (dbid && DB.isOnline()) { try { await DB.setWorkStatus(dbid, "online"); } catch (_) {} }
    ITEMS.unshift({
      id: dbid || Date.now(), dbid, title,
      emoji: entry.emoji, g: gi, coverURL: entry.coverURL, shots: entry.shots, link: entry.link, linkKind: entry.linkKind, siteUrl: entry.siteUrl,
      type: up.tags.includes("skill") ? "skill" : (up.tags[0] || "其他"), tags: [...up.tags],
      price: entry.price, author: ME, downloads: 0, likes: 0, ver: "v1.0",
      fmt: entry.linkKind === "url" ? "网址作品" : (up.link.pan + " 链接"), size: entry.linkKind === "url" ? "" : up.link.exp,
      updated: entry.date, desc: $("#upDesc").value.trim(),
      comments: [], reviews: [], rating: 5, ratingCnt: 0,
    });
    const n = { ico: "✅", bg: "--free-bg", text: `你的作品《${title}》审核通过，已上线`, time: "刚刚", go: "#/studio?tab=works" };
    addNotif(n);
    if (DB.isOnline() && MYUID) DB.pushNotif(MYUID, n);
    if (!$("#view-explore").hidden) renderGrid();
    if (!$("#view-studio").hidden && studioTab === "works") renderStudio("works");
    toast("✅《" + title + "》审核通过，已上线");
  }, 5000);
  state.type = "全部"; state.sort = "new"; $("#sortSel").value = "new";
  buildFilterBar(); renderGrid();
});

/* ============================================================
   多视图路由 + 排行榜 / 社区 / 创作者主页 / 创作者中心 / 通知
   ============================================================ */
const $view = (n) => $("#view-" + n);
let studioTab = "overview", studioBooted = false;

function parseHash() {
  const h = location.hash || "#/";
  const [path, qs] = h.slice(1).split("?");
  return { seg: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
function route() {
  const { seg, q } = parseHash();
  const view = ({ "": "explore", rank: "rank", community: "community", profile: "profile", studio: "studio", messages: "messages" })[seg[0] || ""] || "explore";
  if (view !== "profile") { bannerCleanup?.(); bannerCleanup = null; }
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + view));
  $$(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === view));
  if (view === "rank") renderRank();
  if (view === "community") renderCommunity();
  if (view === "profile") renderProfile(decodeURIComponent(seg[1] || ME), q.get("tab") || "works");
  if (view === "studio") renderStudio(q.get("tab") || studioTab);
  if (view === "messages") renderMessages(q.get("to") ? decodeURIComponent(q.get("to")) : null);
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", route);

/* ---- 排行榜 ---- */
const rankState = { period: "week", tag: "", q: "" };
const PERIODS = [["day", "日榜"], ["week", "周榜"], ["month", "月榜"], ["year", "年榜"], ["hall", "神榜"]];
function dlFor(it, p) {
  const s = it.id % 89 + 7;
  const d = Math.max(3, Math.round(it.downloads / 420) + s * 2);
  if (p === "day") return d;
  if (p === "week") return d * 6 + s;
  if (p === "month") return d * 24 + s * 11;
  return Math.round(it.downloads * 0.52) + s * 66;
}
let HALL = null;
function hallList() {
  if (HALL) return HALL;
  const real = ITEMS.map((it) => ({ title: it.title, author: it.author, tags: it.tags, emoji: it.emoji, g: it.g, dl: it.downloads, id: it.id, price: it.price }));
  const pre = ["AI", "超能", "量子", "星尘", "灵犀", "妙笔", "天工", "闪念"];
  const kind = ["笔记助手", "视频剪辑器", "翻译官", "画板", "日程管家", "抠图工具", "语音转写", "简历工场", "壁纸引擎", "代码伴侣"];
  const authors = ["云上工作室", "白露", "比特猫", "南山客", "软糖软体", "山与海", "像素青蛙", "深夜写代码"];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const synth = [];
  for (let i = 0; i < 40; i++) synth.push({
    title: pre[i % pre.length] + kind[(i * 7 + 3) % kind.length],
    author: authors[i % authors.length],
    tags: [PRESET_TAGS[(i * 5) % PRESET_TAGS.length], PRESET_TAGS[(i * 3 + 1) % PRESET_TAGS.length]],
    emoji: ["🚀", "🎨", "🧠", "📦", "🔧", "🎹", "📷", "🛠️"][i % 8],
    g: i % GRADS.length,
    dl: Math.round(14800 - i * 255 - rnd() * 170),
  });
  HALL = [...real, ...synth].sort((a, b) => b.dl - a.dl).slice(0, 50);
  return HALL;
}
function rankRows(list, isHall) {
  const max = list[0] ? list[0].dlShow : 1;
  return list.map((x, i) => {
    const [g1, g2] = grad(x.g);
    const crown = isHall && i === 0;
    const price = x.price == null ? "神榜收录" : x.price === 0 ? "免费" : "¥" + x.price;
    return `<div class="rank-row${crown ? " crown" : ""}" style="--i:${Math.min(i, 18)};--g1:${g1};--g2:${g2};position:relative" ${x.id ? `data-open="${x.id}"` : 'data-dead="1"'}>
      ${crown ? '<span class="rk-crown">👑</span>' : ""}
      <span class="rk ${i < 3 ? "top" + (i + 1) : ""}">${String(i + 1).padStart(2, "0")}</span>
      <span class="cov">${x.emoji}</span>
      <div class="rank-main"><b>${esc(x.title)}</b><small>${esc(x.author)} · ${(x.tags || []).map(esc).join(" / ")}</small>
        <div class="rank-bar"><i style="--w:${Math.max(3, Math.round(x.dlShow / max * 100))}%;--i:${Math.min(i, 18)}"></i></div>
      </div>
      <div class="rank-num"><b>${fmtDl(x.dlShow)}</b><small>${price}</small></div>
    </div>`;
  }).join("");
}
function updateRankList() {
  const el = $view("rank");
  const isHall = rankState.period === "hall";
  let list;
  if (isHall) list = hallList().map((x) => ({ ...x, dlShow: x.dl }));
  else list = ITEMS.filter((it) => !rankState.tag || it.tags.includes(rankState.tag)).map((it) => ({ ...it, dlShow: dlFor(it, rankState.period) })).sort((a, b) => b.dlShow - a.dlShow);
  if (isHall && rankState.tag) list = list.filter((x) => (x.tags || []).includes(rankState.tag));
  const q = rankState.q.trim();
  const chips = ["全部", ...PRESET_TAGS.filter((t) => !q || t.includes(q.toLowerCase()))].slice(0, 12);
  const chipBox = $("#rankChips");
  if (chipBox) chipBox.innerHTML = chips.map((t) => `<button class="chip${t === rankState.tag ? " on" : ""}" data-rtag="${t}">${t}</button>`).join("");
  $("#rankList").innerHTML = list.length ? rankRows(list, isHall) : `<div class="empty" style="padding:40px 0"><div class="empty-emoji">🔍</div><p>该标签下暂无上榜作品</p></div>`;
}
function renderRank() {
  const el = $view("rank");
  const isHall = rankState.period === "hall";
  const pname = { day: "今日", week: "本周", month: "本月", year: "本年" }[rankState.period];
  el.innerHTML = `<h2 class="view-title">🏆 排行榜</h2><p class="view-sub">${isHall ? "历代下载量最高的 50 件作品 · 神榜永久收录" : pname + "下载量排行 · 每 5 分钟刷新（演示数据）"}</p>
    <div class="rank-toolbar">
      <div class="rank-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="rankQ" placeholder="搜索标签，如：翻译 / 素材…" value="${esc(rankState.q)}"></div>
      <div class="rank-chips" id="rankChips"></div>
    </div>
    <div class="rank-periods">${PERIODS.map(([k, n]) => `<button class="tab${k === rankState.period ? " on" : ""}" data-rp="${k}">${n}</button>`).join("")}</div>
    <div class="rank-list" id="rankList"></div>`;
  updateRankList();
}

/* ---- 社区 ---- */
const feedState = { topic: "全部", open: new Set() };
function postHTML(p, i) {
  const [g1, g2] = grad(p.g);
  const item = p.item ? ITEMS.find((x) => x.id === p.item) : null;
  const [ig1, ig2] = item ? grad(item.g) : [0, 0];
  return `<article class="post" style="--i:${i};--g1:${g1};--g2:${g2}">
    <div class="post-head"><i data-goto-user="${esc(p.a)}">${esc(p.a[0])}</i><div><b data-goto-user="${esc(p.a)}">${esc(p.a)}</b><small>${p.time} · # ${p.topic}</small></div></div>
    <div class="post-text">${esc(p.text)}</div>
    ${item ? `<div class="post-item" data-open-item="${item.id}" style="--g1:${ig1};--g2:${ig2}"><span class="cov">${item.emoji}</span><div><b>${esc(item.title)}</b><small>${item.price === 0 ? "免费" : "¥" + item.price} · ${fmtDl(item.downloads)} 下载</small></div><span style="margin-left:auto;color:var(--ink3)">›</span></div>` : ""}
    ${p.tags.length ? `<div class="post-tags">${p.tags.map((t) => `<span class="mini-chip mini-chip-tag"># ${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="post-actions">
      <button class="pa${p.liked ? " liked" : ""}" data-like-post="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.7-10-9.3C.4 8 2.4 4.5 6 4.5c2.2 0 3.6 1.1 4.5 2.6l1.5 2.4 1.5-2.4c.9-1.5 2.3-2.6 4.5-2.6 3.6 0 5.6 3.5 4 7.2C19.5 16.3 12 21 12 21z"/></svg><span>${p.likes + (p.liked ? 1 : 0)}</span></button>
      <button class="pa" data-cmt-post="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12z"/></svg>评论 ${p.comments.length}</button>
      <button class="pa" data-share-post="${p.id}">🔗 分享</button>
    </div>
    <div class="comments${feedState.open.has(p.id) ? " open" : ""}" id="cmts-${p.id}">
      ${p.comments.map((c) => { const [cg1, cg2] = grad(c.a.length % GRADS.length); return `<div class="cmt" style="--g1:${cg1};--g2:${cg2}"><i>${esc(c.a[0])}</i><div class="c-bubble"><b>${esc(c.a)}</b><p>${esc(c.t)}</p><small>${c.time || "刚刚"}</small></div></div>`; }).join("")}
      <div class="cmt-input"><input placeholder="回复 ${esc(p.a)}…（回车发送）" data-cmt-input="${p.id}"><button class="btn btn-primary" style="height:38px;padding:0 15px" data-cmt-send="${p.id}">发送</button></div>
    </div>
  </article>`;
}
function renderCommunity() {
  const el = $view("community");
  const posts = FEED.filter((p) => feedState.topic === "全部" || p.topic === feedState.topic);
  el.innerHTML = `<h2 class="view-title">社区</h2><p class="view-sub">分享造物心得 · 交流使用技巧 · 认识同好</p>
    <div class="feed-layout">
      <div>
        <div class="composer" id="composer">
          <div class="composer-row"><i>澄</i><textarea id="compText" rows="1" placeholder="分享你的造物心得、求助或展示新作品…"></textarea></div>
          <div class="comp-foot"><span class="hint">Ctrl + Enter 快速发布 · 请遵守社区规范</span><button class="btn btn-primary" id="compSend" style="height:36px">发布动态</button></div>
        </div>
        <div class="chips" style="margin-bottom:18px">${["全部", ...TOPICS.map((t) => t.n)].map((t) => `<button class="chip${t === feedState.topic ? " on" : ""}" data-topic="${t}">${t}</button>`).join("")}</div>
        <div id="feedList">${posts.map(postHTML).join("")}</div>
      </div>
      <aside>
        <div class="side-panel"><h4>🔥 热门话题</h4>${TOPICS.map((t) => `<div class="topic-row" data-topic="${t.n}"><span># ${t.n}</span><b>${t.hot} 条</b></div>`).join("")}</div>
        <div class="side-panel"><h4>⭐ 本周之星</h4>
          <div style="display:flex;gap:11px;align-items:center;cursor:pointer" data-goto-user="林小满">
            <i style="width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-style:normal;background:linear-gradient(135deg,#6366F1,#A855F7)">林</i>
            <div><b style="font-size:14px;display:block">林小满</b><small style="color:var(--ink3);font-size:12px;line-height:1.6">翻译 & 效率工具作者<br>本周获赞 86 · 粉丝 1,204</small></div>
          </div>
        </div>
        <div class="side-panel"><h4>📌 社区规范</h4><p style="font-size:12.5px;color:var(--ink3);line-height:1.8">友善交流，尊重每一位创作者；分享教程请注明可复现步骤；禁止发布与 AI 造物无关的内容。</p></div>
      </aside>
    </div>`;
}

/* ---- 主页可交互动画背景（官方预设） ---- */
const BGS = {
  aurora: { name: "极光", tag: "鼠标跟随", canvas: false, mount(el) {
    el.insertAdjacentHTML("beforeend", '<div class="bg-layer"><div class="aur-blob b1"></div><div class="aur-blob b2"></div><div class="aur-blob b3"></div></div>');
    const mv = (e) => { const r = el.getBoundingClientRect(); el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3)); };
    el.addEventListener("pointermove", mv);
    return () => { el.removeEventListener("pointermove", mv); el.querySelectorAll(".bg-layer").forEach((x) => x.remove()); };
  } },
  mesh: { name: "渐变流", tag: "自动流动", canvas: false, mount(el) {
    const d = document.createElement("div"); d.className = "bg-layer mesh-bg"; el.appendChild(d);
    return () => d.remove();
  } },
  starry: { name: "星夜", tag: "流星 · 点击放星", canvas: false, mount(el) {
    const d = document.createElement("div"); d.className = "bg-layer"; d.style.cssText = "background:linear-gradient(180deg,#0f172a,#334155)";
    for (let i = 0; i < 60; i++) { const s = document.createElement("i"); s.className = "star"; const sz = (Math.random() * 1.8 + 0.8).toFixed(1); s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${sz}px;height:${sz}px;--d:${(Math.random() * 2.4 + 1.4).toFixed(1)}s;--dl:${(Math.random() * 2.5).toFixed(1)}s`; d.appendChild(s); }
    el.appendChild(d);
    const spawn = (x, y) => { const m = document.createElement("i"); m.className = "meteor"; m.style.left = (x != null ? x : Math.random() * 60 + 8) + "%"; m.style.top = (y != null ? y : Math.random() * 35) + "%"; d.appendChild(m); setTimeout(() => m.remove(), 950); };
    const t = setInterval(() => spawn(), 3800);
    setTimeout(() => spawn(), 700);
    const clickM = (e) => { if (e.target.closest("button,a")) return; const r = el.getBoundingClientRect(); spawn(e.clientX - r.left - 60, e.clientY - r.top); };
    el.addEventListener("click", clickM);
    return () => { clearInterval(t); el.removeEventListener("click", clickM); d.remove(); };
  } },
  particles: { name: "粒子场", tag: "鼠标互动", canvas: true, mount(el) {
    const cv = document.createElement("canvas"); cv.className = "bg-layer"; cv.style.cssText = "background:#0B1020"; el.appendChild(cv);
    const ctx = cv.getContext("2d");
    const fit = () => { cv.width = el.clientWidth; cv.height = el.clientHeight; }; fit();
    const P = Array.from({ length: 34 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 }));
    let mx = -9999, my = -9999, raf;
    const mv = (e) => { const r = el.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
    const lv = () => { mx = my = -9999; };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerleave", lv);
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of P) {
        const dx = p.x - mx, dy = p.y - my, dd = Math.hypot(dx, dy);
        if (dd < 90 && dd > 0) { p.x += dx / dd * 1.4; p.y += dy / dd * 1.4; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > cv.width) p.vx *= -1;
        if (p.y < 0 || p.y > cv.height) p.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fill();
      }
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j], d2 = Math.hypot(a.x - b.x, a.y - b.y);
        if (d2 < 90) { ctx.strokeStyle = `rgba(255,255,255,${((1 - d2 / 90) * 0.35).toFixed(2)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointermove", mv); el.removeEventListener("pointerleave", lv); cv.remove(); };
  } },
  waves: { name: "海浪", tag: "鼠标起伏", canvas: true, mount(el) {
    const cv = document.createElement("canvas"); cv.className = "bg-layer"; cv.style.cssText = "background:linear-gradient(180deg,#0369A1,#0EA5E9)"; el.appendChild(cv);
    const ctx = cv.getContext("2d");
    const fit = () => { cv.width = el.clientWidth; cv.height = el.clientHeight; }; fit();
    let raf, t = 0, amp = 14, ampT = 14;
    const mv = (e) => { const r = el.getBoundingClientRect(); ampT = 6 + (e.clientY - r.top) / r.height * 26; };
    el.addEventListener("pointermove", mv);
    const loop = () => {
      t += 0.02; amp += (ampT - amp) * 0.05;
      ctx.clearRect(0, 0, cv.width, cv.height);
      [["rgba(255,255,255,.16)", 0], ["rgba(255,255,255,.28)", 2.1], ["rgba(255,255,255,.42)", 4.2]].forEach(([col, ph]) => {
        ctx.beginPath(); ctx.moveTo(0, cv.height);
        for (let x = 0; x <= cv.width; x += 8) ctx.lineTo(x, cv.height * 0.62 + Math.sin(x / 90 + t + ph) * amp);
        ctx.lineTo(cv.width, cv.height); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointermove", mv); cv.remove(); };
  } },
};
let bannerCleanup = null;
function mountBanner(el, u) {
  bannerCleanup?.(); bannerCleanup = null;
  if (!el || u.bgImg) return;
  const def = BGS[u.bg];
  if (!def) return;
  if (def.canvas && document.documentElement.classList.contains("flat")) return; // 截图/低特效不跑 canvas 动画
  bannerCleanup = def.mount(el);
}

/* ---- 创作者主页 ---- */
let profState = { name: ME, tab: "works" };
function renderProfile(name, tab) {
  profState = { name, tab };
  const u = USERS[name] || { g: 4, bio: "这位创作者很神秘，什么都没有写。", verified: false, followers: 0, following: 0, joined: "2026" };
  const isSelf = name === ME;
  const its = ITEMS.filter((x) => x.author === name);
  const posts = FEED.filter((x) => x.a === name);
  const likes = its.reduce((s, x) => s + x.likes, 0);
  const dls = its.reduce((s, x) => s + x.downloads, 0);
  const [p1, p2] = grad(u.g);
  const empty = `<div class="empty" style="padding:44px 0"><div class="empty-emoji">🌱</div><p>还没有内容</p></div>`;
  const body = tab === "works"
    ? (its.length ? `<div class="grid">${its.map((x, i) => cardHTML(x, i)).join("")}</div>` : empty)
    : tab === "posts"
      ? (posts.length ? posts.map(postHTML).join("") : empty)
      : tab === "bought"
        ? `<div class="panel" style="--i:0"><h3>已购买 <span style="font-weight:500;font-size:12px;color:var(--ink3)">${MY.purchased.length} 件 · 点「打开网盘」自动跳转并复制提取码</span></h3>${MY.purchased.map((b, i) => { const it = ITEMS.find((x) => x.id === b.id); if (!it) return ""; const [g1, g2] = grad(it.g); return `<div class="buy-line" style="--g1:${g1};--g2:${g2};--i:${i}"><span class="cov">${it.emoji}</span><div class="bi"><b>${esc(it.title)}</b><small>${b.time} 获取 · ${b.price === 0 ? "免费" : "¥" + b.price} · ${it.link ? esc(it.link.pan) : ""}</small></div><span class="st st-online">已完成</span><button class="op-btn" data-viewitem="${b.id}">查看</button><button class="op-btn" data-openpan="${b.id}">打开网盘</button></div>`; }).join("") || empty}</div>`
        : `<div class="panel" style="--i:0"><h3>收到的评价</h3>${its.flatMap((x) => x.reviews.map((r) => ({ ...r, it: x }))).map((r) => { const [g1, g2] = grad(r.a.length + 3); return `<div class="review" style="--g1:${g1};--g2:${g2}"><div class="rv-head"><i data-goto-user="${esc(r.a)}" style="cursor:pointer">${esc(r.a[0])}</i><b data-goto-user="${esc(r.a)}" style="cursor:pointer">${esc(r.a)}</b><span class="stars">${starsHTML(r.s)}</span><small>评价了《${esc(r.it.title)}》 · ${r.time}</small></div><p>${esc(r.t)}</p></div>`; }).join("") || empty}</div>`;
  const av = u.avatar || {};
  let avatarInner, avBg = `linear-gradient(135deg,${p1},${p2})`;
  if (av.type === "zodiac") { const z = ZODIAC.find((x) => x[0] === av.v) || ZODIAC[0]; const [za, zb] = grad(z[2]); avatarInner = `<span style="font-size:46px;text-shadow:0 2px 6px rgba(0,0,0,.3)">${z[1]}</span>`; avBg = `linear-gradient(135deg,${za},${zb})`; }
  else if (av.type === "img") { avatarInner = `<img class="av-img" src="${av.url}" alt="">`; avBg = "#26262E"; }
  else avatarInner = esc(name[0]);
  const level = levelOf(name).lv;
  const badges = [];
  if (u.verified) badges.push("✓ 认证创作者");
  if (dls >= 1000) badges.push("🔥 千下俱乐部");
  if (u.followers >= 500) badges.push("⭐ 人气创作者");
  if ((u.joined || "").startsWith("2024")) badges.push("🌱 元老成员");
  /* 活跃热力（基于昵称的确定性伪随机） */
  let hseed = 0; for (const ch of name) hseed = (hseed + ch.charCodeAt(0)) % 997;
  const heat = Array.from({ length: 24 }, (_, i) => { hseed = (hseed * 31 + i * 7 + 11) % 997; return hseed / 997; });
  const activeDays = Math.round(heat.reduce((s, v) => s + (v > 0.35 ? 3 : v > 0.15 ? 1.5 : 0.4), 0));
  const statTiles = [
    ["📦", "作品", its.length, "--accent-soft", "works"],
    ["⬇️", "总下载", dls, "--free-bg", "dl"],
    ["❤️", "粉丝", u.followers, "--paid-bg", "fans"],
    ["⭐", "获赞", likes, "--warn-bg", "likes"],
    ["🧭", "关注中", u.following, "--info-bg", "following"],
  ].map(([ico, lab, v, bg, k], i) => `<div class="p-stat" data-pstat="${k}" style="cursor:pointer;--i:${i}" title="点击查看${lab}"><span class="si" style="background:var(${bg})">${ico}</span><div><b data-count="${v}">0</b><span>${lab}</span></div></div>`).join("");
  $view("profile").innerHTML = `
    <div class="profile-wrap">
    <div class="container">
    <div class="p-banner" id="pBanner" style="--pg1:${p1};--pg2:${p2};${u.bgImg ? `background-image:url(${u.bgImg});background-size:cover;background-position:center` : ""}">
      <span class="p-quote">✦ ${esc(u.quote || "创造，是最好的表达")}</span>
      ${isSelf ? `<button class="customize-btn" data-goto="#/studio?tab=settings">🎨 自定义主页</button>` : ""}
    </div>
    </div>
    <div class="p-card container">
      <div class="p-avatar dbl-hint" style="background:${avBg}" ${isSelf ? 'title="双击更换头像"' : ""}>${avatarInner}<span class="on-dot" title="在线"></span></div>
      <div class="p-id">
        <h2><span class="p-name${isSelf ? " dbl-hint" : ""}" ${isSelf ? 'title="双击修改昵称"' : ""}>${esc(name)}</span> ${u.verified ? `<span class="vbadge" title="认证创作者"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : ""}<span class="lv-chip dbl-hint" data-level title="点击查看等级权益">Lv.${levelOf(name).lv}</span></h2>
        <div class="bio">${esc(u.bio)}</div>
        <div class="p-meta"><span class="meta-chip dbl-hint" data-join title="点击查看加入日历">📅 ${u.joined} 加入</span><span class="meta-chip">🏷️ ${its.length ? its[0].tags.map(esc).join(" / ") : "暂无作品"}</span></div>
      </div>
      <div class="p-side">
        ${badges.length ? `<div class="p-badges">${badges.map((b) => `<span class="badge-ach">${b}</span>`).join("")}</div>` : ""}
        <div class="p-actions">${isSelf
          ? `<a class="btn btn-primary" href="#/studio">🚀 创作者中心</a><a class="btn btn-ghost" href="#/studio?tab=settings">⚙️ 设置</a>`
          : `<button class="btn ${FOLLOWING.has(name) ? "btn-ghost" : "btn-primary"}" id="pFollow">${FOLLOWING.has(name) ? "已关注 ✓" : "+ 关注"}</button><button class="btn btn-ghost" id="pMsg">💬 私信</button>`}
        </div>
      </div>
    </div>
    <div class="p-stats container">${statTiles}</div>
    <div class="container" style="margin-top:18px">
      <div class="panel" style="--i:5"><h3>创作活跃度 <span style="font-weight:500;font-size:12px;color:var(--ink3)">近 24 周</span></h3>
        <div class="heat">${heat.map((v, i) => `<i style="--o:${(0.12 + v * 0.88).toFixed(2)};--i:${i}"></i>`).join("")}</div>
        <div class="heat-legend"><span>少</span><span>活跃约 ${activeDays} 天</span><span>多</span></div>
      </div>
    </div>
    <div class="profile-inner container">
      <div class="p-tabs-row"><div class="tabs">
        <button class="tab${tab === "works" ? " on" : ""}" data-ptab="works">作品 ${its.length}</button>
        <button class="tab${tab === "posts" ? " on" : ""}" data-ptab="posts">动态 ${posts.length}</button>
        <button class="tab${tab === "reviews" ? " on" : ""}" data-ptab="reviews">评价</button>
        ${isSelf ? `<button class="tab${tab === "bought" ? " on" : ""}" data-ptab="bought">🛍️ 已购买 ${MY.purchased.length}</button>` : ""}
      </div></div>
      <div id="pBody">${body}</div>
    </div>
    </div>`;
  mountBanner($("#pBanner"), u);
  $$("#view-profile [data-count]").forEach((n) => countUp(n, +n.dataset.count));
}

/* ---- 私信（会话列表 + 聊天） ---- */
function avatarHTML(name, size = 38) {
  const u = USERS[name] || {};
  const av = u.avatar || {};
  const [g1, g2] = grad(u.g ?? 7);
  let inner = esc((name || "?")[0]), bg = `linear-gradient(135deg,${g1},${g2})`;
  if (av.type === "zodiac") { const z = ZODIAC.find((x) => x[0] === av.v) || ZODIAC[0]; const [za, zb] = grad(z[2]); inner = z[1]; bg = `linear-gradient(135deg,${za},${zb})`; }
  else if (av.type === "img") { inner = `<img class="av-img" src="${av.url}" alt="">`; bg = "#26262E"; }
  return `<span style="width:${size}px;height:${size}px;border-radius:50%;display:inline-grid;place-items:center;flex-shrink:0;background:${bg};color:#fff;font-weight:700;font-size:${Math.round(size * 0.42)}px;overflow:hidden">${inner}</span>`;
}
function openDM(name) { if (!requireLogin()) return; location.hash = "#/messages?to=" + encodeURIComponent(name); }
let messagesCur = null;
function bubbleHTML(m, who) { return `<div class="bubble-row${m.me ? " me" : ""}">${m.me ? "" : avatarHTML(who, 30)}<div class="bubble">${esc(m.t)}<time>${m.time}</time></div></div>`; }
function renderMessages(openWho) {
  const el = $view("messages");
  if (!ME) { el.innerHTML = `<h2 class="view-title">私信</h2><div class="empty"><div class="empty-emoji">💬</div><p>登录后查看私信</p><button class="btn btn-primary" data-needlogin>去登录</button></div>`; return; }
  if (openWho && !CONVS.some((c) => c.who === openWho)) CONVS.unshift({ who: openWho, unread: 0, msgs: [] });
  const cur = openWho || CONVS[0]?.who;
  messagesCur = cur;
  if (cur) { const c = CONVS.find((x) => x.who === cur); if (c) c.unread = 0; }
  const conv = CONVS.find((x) => x.who === cur);
  el.innerHTML = `<h2 class="view-title">私信</h2><p class="view-sub">与创作者一对一沟通 · 回车快速发送</p>
    <div class="msg-layout">
      <div class="conv-col"><div class="conv-head">消息 <small>${CONVS.length} 个会话</small></div><div class="conv-list">${CONVS.map((c) => { const [g1, g2] = grad(c.who.length % GRADS.length); const last = c.msgs[c.msgs.length - 1]; return `<div class="conv-item${c.who === cur ? " on" : ""}" data-conv="${esc(c.who)}"><i style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-style:normal;color:#fff;font-weight:700;background:linear-gradient(135deg,${g1},${g2})">${esc(c.who[0])}</i><div class="ci-main"><b>${esc(c.who)}</b><small>${esc(last ? last.t : "开始聊天吧")}</small></div><time>${last ? last.time : ""}</time>${c.unread ? '<span class="cu"></span>' : ""}</div>`; }).join("")}</div></div>
      <div class="chat-col">${conv ? `
        <div class="chat-head">${avatarHTML(conv.who, 38)}<div><b data-goto-user="${esc(conv.who)}">${esc(conv.who)}</b><small>● 在线</small></div><a class="btn btn-ghost" style="height:32px;margin-left:auto;font-size:12px" href="#/profile/${encodeURIComponent(conv.who)}">查看主页</a></div>
        <div class="chat-body" id="chatBody">${conv.msgs.map((m) => bubbleHTML(m, conv.who)).join("")}</div>
        <div class="chat-input"><input id="chatText" placeholder="发消息…（回车发送）" autocomplete="off"><button class="btn btn-primary" id="chatSend" style="height:42px;padding:0 20px">发送</button></div>` : `<div class="chat-empty">选择左侧会话开始聊天</div>`}
      </div>
    </div>`;
  const bodyEl = $("#chatBody"); if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
}
function sendChat() {
  const conv = CONVS.find((x) => x.who === messagesCur); if (!conv) return;
  const input = $("#chatText"); const v = input.value.trim(); if (!v) return;
  conv.msgs.push({ me: true, t: v, time: "刚刚" });
  renderMessages(conv.who);
  const b = $("#chatBody"); if (b) b.scrollTop = b.scrollHeight;
  if (DB.isOnline() && MYUID) {
    const other = DB.uidOf(messagesCur);
    if (other) { const key = [MYUID, other].sort().join("|"); DB.sendMessage(key, MYUID, other, v).catch((e) => toast("消息同步失败：" + (e.message || e))); }
  }
}
$view("messages").addEventListener("click", (e) => {
  const cv = e.target.closest("[data-conv]");
  if (cv) { renderMessages(cv.dataset.conv); return; }
  if (e.target.closest("#chatSend")) sendChat();
});
$view("messages").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "chatText") sendChat(); });

/* ---- 通用列表弹窗（粉丝 / 关注 / 获赞 / 下载） ---- */
let currentListKind = "fans";
const NAME_POOL = ["轻舟", "阿远", "甜粽", "南栀", "临风", "北岸", "云上工作室", "白露", "比特猫", "南山客"];
function openStatList(kind) {
  currentListKind = kind;
  const name = profState.name;
  const its = ITEMS.filter((x) => x.author === name);
  const titles = { fans: "粉丝", following: "关注中", likes: "获赞记录", dl: "下载记录" };
  $("#listTitle").textContent = (titles[kind] || "") + " · " + name;
  let html = "";
  if (kind === "fans" || kind === "following") {
    const names = kind === "following" ? [...FOLLOWING] : NAME_POOL.filter((_, i) => (i + name.length) % 2 === 0).slice(0, 6);
    html = names.map((n, i) => { const [g1, g2] = grad(n.length % GRADS.length); const u2 = USERS[n]; return `<div class="urow" style="--i:${i}"><i style="background:linear-gradient(135deg,${g1},${g2})">${esc(n[0])}</i><div class="ui"><b data-goto-user="${esc(n)}">${esc(n)}</b><small>${u2 && u2.verified ? "认证创作者" : "创作者"} · ${kind === "fans" ? "关注了你" : "你关注的创作者"}</small></div>${n !== ME ? `<button class="op-btn" data-listfollow="${esc(n)}">${FOLLOWING.has(n) ? "已关注" : "+ 关注"}</button>` : ""}</div>`; }).join("") || `<div class="chat-empty" style="padding:30px">暂无内容</div>`;
  } else if (kind === "likes") {
    html = its.flatMap((x) => x.reviews.slice(0, 1).map((r) => ({ r, x }))).slice(0, 6).map(({ r, x }, i) => { const [g1, g2] = grad(r.a.length % GRADS.length); return `<div class="urow" style="--i:${i}"><i style="background:linear-gradient(135deg,${g1},${g2})">${esc(r.a[0])}</i><div class="ui"><b data-goto-user="${esc(r.a)}">${esc(r.a)}</b><small>赞了《${esc(x.title)}》 · ${r.time}</small></div><span class="num">⭐ ${r.s}</span></div>`; }).join("") || `<div class="chat-empty" style="padding:30px">还没有获赞记录</div>`;
  } else {
    html = its.slice(0, 8).map((x, i) => { const [g1, g2] = grad(x.g); return `<div class="ul-row3" style="--i:${i};--g1:${g1};--g2:${g2}"><span class="cov">${x.emoji}</span><div class="ui"><b>${esc(x.title)}</b><small>累计下载</small></div><span class="num">${fmtDl(x.downloads)}</span></div>`; }).join("") || `<div class="chat-empty" style="padding:30px">还没有下载记录</div>`;
  }
  $("#listBody").innerHTML = html;
  openModal("#listModal");
}

function openPanel(title, html, wide) {
  $("#listTitle").textContent = title;
  $("#listBody").innerHTML = html;
  $("#listModal .modal-panel").classList.toggle("wide", !!wide);
  openModal("#listModal");
}

/* ---- 作品「数据」看板（14 天趋势 + 渠道） ---- */
function openItemData(mid) {
  const e = MY.items.find((x) => x.mid === mid); if (!e) return;
  let seed = [...mid].reduce((s, c) => s + c.charCodeAt(0), 7);
  const days = Array.from({ length: 14 }, (_, i) => { seed = (seed * 31 + 11) % 997; return seed / 997; });
  const max = Math.max(...days, 1);
  const conv = e.views ? (e.downloads / e.views * 100).toFixed(1) : "0.0";
  openPanel("数据看板 · " + e.title, `
    <div class="dkpis">
      <div class="dkpi" style="--i:0"><small>浏览量</small><b>${fmtDl(e.views)}</b></div>
      <div class="dkpi" style="--i:1"><small>下载量</small><b>${fmtDl(e.downloads)}</b></div>
      <div class="dkpi" style="--i:2"><small>累计收益</small><b>¥${e.revenue.toLocaleString()}</b></div>
      <div class="dkpi" style="--i:3"><small>浏览→下载</small><b>${conv}%</b></div>
    </div>
    <div class="dchart">${days.map((v, i) => `<div class="dbar" title="第 ${i + 1} 天" style="--h:${Math.max(6, Math.round(v / max * 100))}%;--i:${i}"><i></i></div>`).join("")}</div>
    <div class="dlegend">近 14 天下载趋势 · 每日相对量</div>
    <div class="ul-row3" style="--i:0"><span class="cov" style="background:var(--accent-soft)">🌐</span><div class="ui"><b>网盘打开次数</b><small>近 30 天 · 打开率 ${Math.min(99, 62 + e.downloads % 30)}%</small></div><span class="num">${fmtDl(Math.round(e.downloads * 1.18))}</span></div>
    <div class="ul-row3" style="--i:1"><span class="cov" style="background:var(--paid-bg)">❤️</span><div class="ui"><b>收藏数</b><small>来自作品页</small></div><span class="num">${fmtDl(Math.round(e.downloads * 0.42))}</span></div>
    <div class="ul-row3" style="--i:2"><span class="cov" style="background:var(--warn-bg)">💬</span><div class="ui"><b>评论数</b><small>社区与详情页</small></div><span class="num">${(e.downloads % 17) + 2}</span></div>
  `, true);
}

/* ---- 作品「编辑」弹窗（含网盘链接重传） ---- */
function openItemEdit(mid) {
  const e = MY.items.find((x) => x.mid === mid); if (!e) return;
  const it0 = ITEMS.find((x) => x.title === e.title);
  const link = e.link || (it0 && it0.link) || { url: "", pan: "", code: "", exp: "长期有效" };
  openPanel("编辑作品 · " + e.title, `
    <label class="field" style="margin-top:0"><span class="field-label">标题</span>
      <input type="text" id="edTitle" maxlength="30" value="${esc(e.title)}"></label>
    <label class="field"><span class="field-label">功能介绍</span>
      <textarea id="edDesc" rows="3" maxlength="500" placeholder="它是什么？能解决什么问题？怎么用？">${esc(e.desc || "")}</textarea></label>
    <div class="field"><span class="field-label">网盘分享链接 <small>更换后买家下载即用新链接，自动识别平台</small></span>
      <input type="url" id="edPan" value="${esc(link.url)}" placeholder="粘贴网盘分享链接，自动识别平台…" autocomplete="off">
      <div class="pan-detect" id="edPanDetect" ${link.pan ? "" : "hidden"}><span class="pan-brand" id="edPanBrand"></span><span class="pan-ok">✓ 已识别，保存后买家将跳转新链接</span></div>
      <em class="pan-err" id="edPanErr" hidden>暂不支持该链接，请使用主流网盘的分享链接</em>
    </div>
    <div class="field"><span class="field-label">提取码 <small>买家打开网盘时自动复制</small></span>
      <input type="text" id="edCode" maxlength="8" value="${esc(link.code || "")}" placeholder="无提取码则留空" style="text-transform:uppercase"></div>
    <div class="field"><span class="field-label">分享有效期</span>
      <div class="chips" id="edExp">${["长期有效", "30 天", "7 天"].map((x) => `<button class="chip${x === link.exp ? " on" : ""}" data-eexp="${x}" type="button">${x}</button>`).join("")}</div></div>
    ${e.status === "online" || e.status === "off" ? `<div class="field"><span class="field-label">下载方式</span>
      <div class="chips"><button class="chip${e.price === 0 ? " on" : ""}" data-edp="0" type="button">免费</button><button class="chip${e.price > 0 ? " on" : ""}" data-edp="1" type="button">付费</button></div>
      <div class="price-input" id="edPriceWrap" style="margin-top:9px" ${e.price === 0 ? "hidden" : ""}><i>¥</i><input type="number" id="edPrice" min="1" max="9999" value="${e.price || ""}" placeholder="19"></div></div>` : ""}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin:18px 0 6px">
      <button class="btn btn-ghost" data-close-x type="button">取消</button>
      <button class="btn btn-primary" id="edSave" type="button">保存修改</button>
    </div>`, true);
  /* 网盘链接实时识别 */
  const panInput = $("#edPan");
  let curPan = link.pan || "";
  const refreshDetect = () => {
    const v = panInput.value.trim();
    curPan = detectPan(v);
    $("#edPanDetect").hidden = !curPan;
    $("#edPanErr").hidden = !(v && !curPan);
    if (curPan) $("#edPanBrand").innerHTML = `🌐 <b style="color:var(--ink)">${curPan}</b>`;
  };
  panInput.addEventListener("input", refreshDetect);
  refreshDetect();
  /* 有效期切换 */
  $$("#edExp [data-eexp]").forEach((b) => b.addEventListener("click", () => {
    $$("#edExp .chip").forEach((x) => x.classList.toggle("on", x === b));
  }));
  /* 价格切换 */
  const wrap = $("#edPriceWrap");
  $$("#listBody [data-edp]").forEach((b) => b.addEventListener("click", () => {
    $$("#listBody [data-edp]").forEach((x) => x.classList.toggle("on", x === b));
    wrap.hidden = b.dataset.edp === "0";
  }));
  $("#edSave").addEventListener("click", () => {
    const t = $("#edTitle").value.trim();
    if (t.length < 2) { toast("标题至少 2 个字符"); return; }
    const url = panInput.value.trim();
    if (!url) { toast("网盘链接不能为空"); return; }
    if (!curPan) { toast("链接无法识别，请检查后重新粘贴"); return; }
    const oldTitle = e.title;
    e.title = t;
    e.desc = $("#edDesc").value.trim();
    e.link = { url, pan: curPan, code: $("#edCode").value.trim().toUpperCase(), exp: ($("#edExp .chip.on") || {}).dataset ? $("#edExp .chip.on").dataset.eexp : "长期有效" };
    const paidChip = $("#listBody [data-edp].on");
    if (paidChip) e.price = paidChip.dataset.edp === "1" ? Math.max(1, +$("#edPrice").value || 0) : 0;
    const it = ITEMS.find((x) => x.title === oldTitle);
    if (it) { it.title = t; it.desc = e.desc || it.desc; it.price = e.price; it.link = { ...e.link }; it.fmt = curPan + " 链接"; it.size = e.link.exp; }
    closeAllModals();
    renderStudio("works");
    toast(curPan === link.pan ? "✏️ 修改已保存，线上内容已同步更新" : `🔗 已换用${curPan}新链接，买家即刻生效`);
  });
  $("#listBody [data-close-x]").addEventListener("click", closeAllModals);
}

/* ---- 等级系统（成长值 + 权益） ---- */
const LV_PERKS = ["上传作品 · 社区交流", "自定义主页背景", "优先审核 · 专属等级章", "神榜加权 · 数据看板", "首页推荐位 · 专属认证标识"];
function levelOf(name) {
  const u = USERS[name] || {};
  const own = ITEMS.filter((x) => x.author === name);
  const mine = name === ME ? MY.items.filter((x) => x.status !== "off") : [];
  const works = own.length + mine.length;
  const dls = own.reduce((s, x) => s + x.downloads, 0) + mine.reduce((s, x) => s + x.downloads, 0);
  const fans = u.followers || 0;
  const lv = Math.min(5, 1 + (works > 0) + (dls >= 1000) + (fans >= 500) + (u.verified ? 1 : 0) + (dls >= 5000));
  const xp = Math.min(96, 12 + works * 11 + Math.min(38, Math.round(dls / 100)) + Math.min(18, Math.round(fans / 50)) + (u.verified ? 17 : 0));
  return { lv, xp, works, dls, fans };
}
function openLevel(name) {
  const { lv, xp } = levelOf(name);
  openPanel("等级与成长 · " + name, `
    <div style="display:flex;align-items:center;gap:13px">
      <span class="lv-chip" style="height:30px;padding:0 13px;font-size:14px;border-radius:10px">Lv.${lv}</span>
      <div style="flex:1"><div class="lv-xp"><i style="--w:${xp}%"></i></div><div class="lv-sub" style="margin:0">成长值 ${xp} / 100${lv >= 5 ? " · 已达满级" : " · 距 Lv." + (lv + 1) + " 还差 " + (100 - xp)}</div></div>
    </div>
    <p style="font-size:12.5px;color:var(--ink3);margin:14px 0 4px">如何成长：发布作品、被下载、收获粉丝、完成认证都会提升成长值。</p>
    ${LV_PERKS.map((p, i) => `<div class="lv-perk${i < lv ? " on" : ""}"><span class="ln">${i + 1}</span><span><b>Lv.${i + 1}</b> · ${p}</span>${i < lv ? '<span style="margin-left:auto;color:var(--free);font-weight:700">✓ 已解锁</span>' : '<span style="margin-left:auto">🔒</span>'}</div>`).join("")}
  `, true);
}

/* ---- 加入日历卡 ---- */
function openJoinCal(name) {
  const u = USERS[name] || {};
  const [y, m] = (u.joined || "2026-01").split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // 周一开头
  const daysTogether = Math.max(1, Math.floor((Date.now() - first.getTime()) / 864e5));
  const cells = ["一", "二", "三", "四", "五", "六", "日"].map((w) => `<span class="wd">${w}</span>`).join("")
    + Array(lead).fill('<span></span>').join("")
    + Array.from({ length: days }, (_, i) => `<span class="d${i === 0 ? " join" : ""}" style="--i:${lead + i}" title="${i === 0 ? "加入纪念日 🎂" : ""}">${i + 1}</span>`).join("");
  openPanel("加入日历 · " + name, `
    <div style="text-align:center;font-size:15px;font-weight:800">${y} 年 ${m} 月 · 与造物集相遇</div>
    <div class="cal">${cells}</div>
    <p class="cal-cap"><b>${y}-${String(m).padStart(2, "0")}-01</b> 加入造物集 · 已陪伴 <b>${daysTogether}</b> 天</p>
    <p style="text-align:center;font-size:12px;color:var(--ink3)">创作不息，感谢一路同行 🌱</p>
  `, true);
}

/* ---- 双击改名 ---- */
function openRename() {
  if (!ME) { openLogin("login"); return; }
  openPanel("修改昵称", `
    <label class="field" style="margin-top:0"><span class="field-label">新的昵称 <small>2–16 个字符</small></span>
      <input type="text" id="rnInput" maxlength="16" value="${esc(ME)}"></label>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin:16px 0 6px">
      <button class="btn btn-ghost" data-close-x type="button">取消</button>
      <button class="btn btn-primary" id="rnSave" type="button">保存</button>
    </div>`, false);
  $("#rnSave").addEventListener("click", () => {
    const v = $("#rnInput").value.trim();
    if (v.length < 2) { toast("昵称至少 2 个字符"); return; }
    if (v === ME) { closeAllModals(); return; }
    if (USERS[v]) { toast("该昵称已被占用"); return; }
    USERS[v] = { ...USERS[ME] };
    delete USERS[ME];
    const wasME = ME; ME = v;
    /* 同步作品与动态作者名 */
    ITEMS.forEach((x) => { if (x.author === wasME) x.author = v; });
    FEED.forEach((p) => { if (p.a === wasME) p.a = v; });
    CONVS.forEach((c) => { if (c.who === wasME) c.who = v; });
    closeAllModals();
    renderUserChip();
    location.hash = "#/profile/" + encodeURIComponent(v);
    toast("✅ 昵称已改为「" + v + "」");
  });
  $("#listBody [data-close-x]").addEventListener("click", closeAllModals);
  $("#rnInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#rnSave").click(); });
}

/* ---- 创作者中心 ---- */
function countUp(el, target, dec = 0, pre = "") {
  if (document.documentElement.classList.contains("flat")) { el.textContent = pre + target.toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec }); return; }
  const dur = 900, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + (target * e).toLocaleString("zh-CN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const stMap = { online: ["st-online", "已上线"], pending: ["st-pending", "审核中"], off: ["st-off", "已下架"] };
const txSt = { "托管中": "st-pending", "已确认": "st-cfm", "已打款": "st-online", "已退款": "st-off" };
function txTable(rows) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>订单号</th><th>作品</th><th>买家</th><th>金额</th><th>手续费 5%</th><th>实收</th><th>状态</th><th>时间</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r.no}</td><td>${esc(r.it)}</td><td>${r.buyer}</td><td>¥${r.amt.toFixed(2)}</td><td>¥${(r.amt * 0.05).toFixed(2)}</td><td><b>¥${(r.amt * 0.95).toFixed(2)}</b></td><td><span class="st ${txSt[r.status]}">${r.status}</span></td><td>${r.date}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderStudio(tab) {
  studioTab = tab;
  const el = $view("studio");
  if (!studioBooted && !document.documentElement.classList.contains("flat")) {
    el.innerHTML = `<div class="studio-head"><div><h2>创作者中心</h2><p>欢迎回来，澄</p></div></div>
      <div class="stat-cards">${[0, 1, 2, 3].map(() => `<div class="stat-card"><small><span class="sk" style="display:inline-block;width:60px;height:12px"></span></small><div class="num"><span class="sk" style="display:inline-block;width:110px;height:26px"></span></div></div>`).join("")}</div>
      <div class="panel"><div class="sk-row"><span class="sk" style="width:42px;height:42px;border-radius:9px"></span><span class="sk" style="width:30%;height:14px"></span><span class="sk" style="width:14%;height:14px"></span></div><div class="sk-row"><span class="sk" style="width:42px;height:42px;border-radius:9px"></span><span class="sk" style="width:24%;height:14px"></span><span class="sk" style="width:18%;height:14px"></span></div></div>`;
    studioBooted = true;
    setTimeout(() => renderStudio(studioTab), 500);
    return;
  }
  const tabs = [["overview", "概览"], ["works", "我的作品"], ["earnings", "收益"], ["settings", "设置"]];
  el.innerHTML = `<div class="studio-head">
      <div><h2>创作者中心</h2><p>欢迎回来，澄 · 上次登录 今天 08:12</p></div>
      <button class="btn btn-primary" id="studioUpload">＋ 上传新作品</button>
    </div>
    <div class="tabs" style="margin-bottom:20px">${tabs.map(([k, n]) => `<button class="tab${k === tab ? " on" : ""}" data-stab="${k}">${n}</button>`).join("")}</div>
    <div id="studioBody"></div>`;
  const body = $("#studioBody");
  const pending = MY.items.filter((x) => x.status === "pending").length;
  if (tab === "overview") {
    const escrow = MY.txs.filter((x) => x.status === "托管中").reduce((s, x) => s + x.amt, 0);
    body.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card" style="--i:0"><small>今日收益</small><div class="num" data-count="${MY.today}" data-pre="¥">¥0</div><div class="delta">↑ 12% 较昨日</div><span class="ico">💰</span></div>
        <div class="stat-card" style="--i:1"><small>本月收益</small><div class="num" data-count="${MY.month}" data-pre="¥" data-dec="1">¥0</div><div class="delta">↑ 8% 较上月</div><span class="ico">📈</span></div>
        <div class="stat-card" style="--i:2"><small>可提现余额</small><div class="num" data-count="${MY.balance}" data-pre="¥" data-dec="1">¥0</div><div class="delta" style="color:var(--ink3)">含托管中 ¥${escrow.toFixed(2)} 除外</div><span class="ico">🏦</span></div>
        <div class="stat-card" style="--i:3"><small>累计收益</small><div class="num" data-count="${MY.total}" data-pre="¥" data-dec="1">¥0</div><div class="delta">已运营 480 天</div><span class="ico">🏆</span></div>
      </div>
      <div class="duo">
        <div class="panel" style="--i:2"><h3>近 7 天收益趋势</h3><div class="chart">${MY.chart.map((v, i) => `<div class="bar" style="--h:${Math.min(100, Math.round(v / 220 * 100))}%;--i:${i}" title="周${"一二三四五六日"[i]} ¥${v}"><b>¥${v}</b><i></i><span>周${"一二三四五六日"[i]}</span></div>`).join("")}</div></div>
        <div class="panel" style="--i:3"><h3>待处理</h3>
          <div class="todo-item" data-goto="#/studio?tab=works">🔍<span>审核中的作品</span><b class="t-num">${pending}</b></div>
          <div class="todo-item" data-goto="#/studio?tab=earnings">🛡️<span>托管中订单 · 等待买家确认收货</span><b class="t-num">${MY.txs.filter((x) => x.status === "托管中").length}</b></div>
          <div class="todo-item" data-goto="#/studio?tab=earnings">💸<span>可提现余额</span><b class="t-num">¥${MY.balance.toFixed(2)}</b></div>
          <div class="todo-item" data-goto="#/community">💬<span>社区新评论</span><b class="t-num">2</b></div>
        </div>
      </div>
      <div class="panel" style="--i:4"><h3>最近订单 <span class="more" data-goto="#/studio?tab=earnings">全部收益 →</span></h3>${txTable(MY.txs.slice(0, 3))}</div>`;
  }
  if (tab === "works") {
    const flt = renderStudio._flt || "全部";
    const list = MY.items.filter((x) => flt === "全部" || stMap[x.status][1] === flt);
    body.innerHTML = `<div class="panel" style="--i:0"><h3>作品管理
      <span class="chips">${["全部", "已上线", "审核中", "已下架"].map((f) => `<button class="chip${f === flt ? " on" : ""}" data-wflt="${f}">${f}</button>`).join("")}</span></h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>作品</th><th>状态</th><th>价格</th><th>浏览</th><th>下载</th><th>收益</th><th>更新时间</th><th>操作</th></tr></thead>
      <tbody>${list.map((x) => { const [g1, g2] = grad(x.g); return `<tr>
        <td><div class="it-cell" style="--g1:${g1};--g2:${g2}"><span class="cov">${x.emoji}</span><div><b>${esc(x.title)}</b><small>${x.date} 发布</small></div></div></td>
        <td><span class="st ${stMap[x.status][0]}">${stMap[x.status][1]}</span></td>
        <td>${x.price === 0 ? "免费" : "¥" + x.price}</td><td>${fmtDl(x.views)}</td><td>${fmtDl(x.downloads)}</td>
        <td><b>¥${x.revenue.toLocaleString()}</b></td><td>${x.date}</td>
        <td><div class="ops"><button class="op-btn" data-op="data">数据</button><button class="op-btn" data-op="edit">编辑</button><button class="op-btn" data-op="${x.status === "online" ? "off" : "on"}">${x.status === "online" ? "下架" : "上架"}</button></div></td>
      </tr>`; }).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--ink3);padding:26px">该状态下暂无作品</td></tr>`}</tbody></table></div></div>`;
    body.dataset.flt = flt;
  }
  if (tab === "earnings") {
    const escrow = MY.txs.filter((x) => x.status === "托管中").reduce((s, x) => s + x.amt, 0);
    body.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card" style="--i:0"><small>可提现余额</small><div class="num" data-count="${MY.balance}" data-pre="¥" data-dec="1">¥0</div><div class="delta" style="color:var(--ink3)">手续费率 5%</div><span class="ico">🏦</span></div>
        <div class="stat-card" style="--i:1"><small>托管中</small><div class="num" data-count="${escrow}" data-pre="¥">¥0</div><div class="delta" style="color:var(--ink3)">买家确认收货后打款</div><span class="ico">🛡️</span></div>
        <div class="stat-card" style="--i:2"><small>本月收益</small><div class="num" data-count="${MY.month}" data-pre="¥" data-dec="1">¥0</div><div class="delta">↑ 8%</div><span class="ico">📈</span></div>
        <div class="stat-card" style="--i:3"><small>累计收益</small><div class="num" data-count="${MY.total}" data-pre="¥" data-dec="1">¥0</div><div class="delta">480 天</div><span class="ico">🏆</span></div>
      </div>
      <div class="panel" style="--i:4"><h3>收益明细 <button class="btn btn-primary" id="withDraw" style="height:34px;padding:0 16px;font-size:13px">提现到支付宝</button></h3>${txTable(MY.txs)}
      <p style="font-size:12px;color:var(--ink3);margin-top:12px">🛡️ 交易保障：买家付款后进入平台托管，买家确认收货后 24h 内打款（扣除 5% 手续费）；未确认收货的订单买家可随时申请退款。</p></div>`;
  }
  if (tab === "settings") {
    const bgCards = Object.entries(BGS).map(([k, d]) => {
      let mini = "";
      if (k === "aurora") mini = `<div class="mini" style="background:#1E1B4B;overflow:hidden"><div class="aur-blob b1" style="filter:blur(12px)"></div><div class="aur-blob b2" style="filter:blur(12px)"></div></div>`;
      if (k === "mesh") mini = `<div class="mini mesh-bg"></div>`;
      if (k === "starry") mini = `<div class="mini" style="background:linear-gradient(180deg,#0F172A,#334155)">${Array.from({ length: 16 }, (_, i2) => `<i class="star" style="left:${i2 * 37 % 100}%;top:${i2 * 23 % 88}%;width:1.6px;height:1.6px;--d:2s;--dl:${(i2 * 0.13).toFixed(1)}s"></i>`).join("")}</div>`;
      if (k === "particles") mini = `<div class="mini" style="background:#0B1020">${Array.from({ length: 10 }, (_, i2) => `<i class="bg-dot" style="left:${i2 * 41 % 95}%;top:${i2 * 29 % 85}%;width:2.4px;height:2.4px;opacity:.8"></i>`).join("")}</div>`;
      if (k === "waves") mini = `<div class="mini" style="background:linear-gradient(180deg,#0369A1,#0EA5E9)"><i class="bg-dot" style="right:12%;bottom:24%;width:3px;height:3px"></i><i class="bg-dot" style="left:20%;top:26%;width:2px;height:2px"></i></div>`;
      const on = USERS[ME].bg === k && !USERS[ME].bgImg;
      return `<button class="bg-card${on ? " on" : ""}" data-bgsel="${k}" type="button" title="${d.name} · ${d.tag}">${mini}<b>${d.name}</b><span class="tagi">${d.tag}</span></button>`;
    }).join("");
    body.innerHTML = `
      <div class="panel" style="--i:0"><h3>头像与形象</h3>
        <div class="set-grid" style="align-items:start">
          <span class="lab">12 生肖头像<br><small style="font-weight:500;color:var(--ink3)">官方设计 · 点击即换</small></span>
          <div class="zodiac-grid">${ZODIAC.map((z) => { const on = USERS[ME].avatar && USERS[ME].avatar.type === "zodiac" && USERS[ME].avatar.v === z[0]; return `<button class="zo${on ? " on" : ""}" data-zo="${z[0]}" type="button" style="background:linear-gradient(135deg,${grad(z[2])[0]},${grad(z[2])[1]})" title="${z[0]}">${z[1]}<span class="zo-name">${z[0]}</span></button>`; }).join("")}</div>
          <span class="lab">上传自定义头像</span>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" id="avUpload" type="button" style="height:38px">📤 上传图片</button><span id="avAudit"></span>
            <small style="font-size:12px;color:var(--ink3)">上传后需通过平台违规审核方可生效</small>
          </div>
        </div>
      </div>
      <div class="panel" style="--i:1"><h3>主页背景 <small style="font-weight:500;color:var(--ink3);font-size:12px">官方设计 · 可交互动画</small></h3>
        <div class="bg-grid">${bgCards}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="bgUpload" type="button" style="height:38px">🖼️ 上传自定义背景</button><span id="bgAudit"></span>
          <small style="font-size:12px;color:var(--ink3)">同样需通过违规审核</small>
        </div>
      </div>
      <div class="panel" style="--i:2"><h3>账号资料</h3>
        <div class="set-grid">
          <span class="lab">昵称</span><input type="text" value="${esc(ME)}" id="setName">
          <span class="lab">简介</span><textarea rows="2" id="setBio">${esc(USERS[ME].bio)}</textarea>
        </div>
      </div>
      <div class="panel" style="--i:3"><h3>收款方式</h3>
        <div class="pay-methods"><button class="pay-m on">支付宝</button><button class="pay-m">微信支付</button></div>
        <p style="font-size:12px;color:var(--ink3);margin-top:12px">打款将在买家确认收货后 24h 内到账（平台手续费 5%）。</p>
      </div>
      <div class="panel" style="--i:4"><h3>通知偏好</h3>
        <div class="set-row"><div>审核与上架通知<small>作品审核通过或驳回时提醒我</small></div><label class="switch"><input type="checkbox" checked><i></i></label></div>
        <div class="set-row"><div>订单与收益通知<small>新订单、确认收货、打款到账</small></div><label class="switch"><input type="checkbox" checked><i></i></label></div>
        <div class="set-row"><div>社区互动消息<small>评论、关注、点赞</small></div><label class="switch"><input type="checkbox"><i></i></label></div>
      </div>
      <button class="btn btn-primary" id="setSave" style="margin-top:4px">保存设置</button>`;
  }
  $$("#studioBody [data-count]").forEach((n) => countUp(n, +n.dataset.count, n.dataset.dec ? 2 : 0, n.dataset.pre || ""));
}

/* ---- 通知中心 ---- */
function renderNotifs() {
  $("#notifList").innerHTML = NOTIFS.map((n, i) => `<div class="notif-item${n.unread ? "" : " read"}" style="--i:${i}" data-n="${i}"><span class="n-ico" style="background:var(${n.bg})">${n.ico}</span><div style="flex:1">${n.text}<small>${n.time}</small></div>${n.unread ? '<span class="n-dot"></span>' : ""}</div>`).join("");
  const c = NOTIFS.filter((n) => n.unread).length;
  const b = $("#bellBadge");
  b.hidden = c === 0;
  b.textContent = c;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
}
function addNotif(n) { if (n.unread === undefined) n.unread = true; NOTIFS.unshift(n); renderNotifs(); }

/* ---- 登录 / 注册 / 微信·QQ 授权（演示） ---- */
const loginModal = $("#loginModal");
let loginMode = "login";
function requireLogin() { if (ME) return true; openLogin("login"); toast("请先登录后再操作"); return false; }
function openLogin(mode = "login") { loginMode = mode; renderLoginMode(); openModal("#loginModal"); }
function renderLoginMode() {
  $$("#loginModal [data-ltab]").forEach((t) => t.classList.toggle("on", t.dataset.ltab === loginMode));
  $("#lfName").hidden = loginMode !== "reg";
  $("#regAgree").hidden = loginMode !== "reg";
  $("#loginSubmit").textContent = loginMode === "reg" ? "注 册" : "登 录";
}
$$("#loginModal [data-ltab]").forEach((t) => t.addEventListener("click", () => { loginMode = t.dataset.ltab; renderLoginMode(); }));
$("#pwEye").addEventListener("click", () => { const p = $("#liPass"); p.type = p.type === "password" ? "text" : "password"; });
function validAccount(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^1[3-9]\d{9}$/.test(v.replace(/\s/g, "")); }
function fieldErr(input, msg) { const f = input.closest(".lfield"); f.classList.toggle("bad", !!msg); input.classList.toggle("err", !!msg); f.querySelector("em").textContent = msg || ""; }
 $("#loginForm").addEventListener("submit", async (e) => {
   e.preventDefault();
   const name = $("#liName").value.trim(), acc = $("#liAccount").value.trim(), pass = $("#liPass").value;
   let ok = true;
   if (loginMode === "reg" && name.length < 2) { fieldErr($("#liName"), "昵称至少 2 个字符"); ok = false; } else fieldErr($("#liName"), "");
   if (!validAccount(acc)) { fieldErr($("#liAccount"), "请输入正确的邮箱或 11 位手机号"); ok = false; } else fieldErr($("#liAccount"), "");
   if (pass.length < 6) { fieldErr($("#liPass"), "密码至少 6 位"); ok = false; } else fieldErr($("#liPass"), "");
   if (loginMode === "reg" && !$("#liAgree").checked) { toast("请先勾选同意《用户协议》"); ok = false; }
   if (!ok) return;
   if (!DB.isOnline()) { toast("数据库未连接，暂时无法登录（见页面顶部提示）"); return; }
   if (/^1[3-9]\d{9}$/.test(acc.replace(/\s/g, ""))) { fieldErr($("#liAccount"), "手机号登录需接入短信服务，当前请使用邮箱"); return; }
   const btn = $("#loginSubmit");
   btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + (loginMode === "reg" ? "注册中…" : "登录中…");
   try {
     if (loginMode === "reg") await DB.signUp(acc, pass, name); else await DB.signIn(acc, pass);
     btn.disabled = false; btn.textContent = loginMode === "reg" ? "注 册" : "登 录";
     closeAllModals();
     toast(loginMode === "reg" ? "🎉 注册成功，欢迎加入造物集" : "✅ 登录成功");
   } catch (err2) {
     btn.disabled = false; btn.textContent = loginMode === "reg" ? "注 册" : "登 录";
     const msg = String(err2.message || err2);
     if (/already registered|already exists|has been taken/i.test(msg)) fieldErr($("#liAccount"), "该邮箱已被注册");
     else if (/Invalid login credentials/i.test(msg)) fieldErr($("#liPass"), "邮箱或密码错误");
     else if (/at least 6/i.test(msg)) fieldErr($("#liPass"), "密码至少 6 位");
     else if (/valid email|invalid format/i.test(msg)) fieldErr($("#liAccount"), "邮箱格式不正确");
     else if (/rate limit|too many/i.test(msg)) fieldErr($("#liAccount"), "操作过于频繁，请稍后再试");
     else toast("登录失败：" + msg);
   }
 });
function signIn(nick, msg) {
  if (!USERS[nick]) USERS[nick] = { g: Math.floor(Math.random() * GRADS.length), bio: "刚刚加入造物集的新朋友。", verified: false, followers: 0, following: 0, joined: "2026-09" };
  ME = nick;
  closeAllModals();
  renderUserChip();
  toast("👋 " + msg + "，欢迎 " + nick);
  route();
}
function drawQR(canvas) {
  const c = canvas.getContext("2d"), n = 21, s = canvas.width / n;
  c.fillStyle = "#fff"; c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "#16161A";
  let seed = 42; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rnd() > 0.52) c.fillRect(x * s, y * s, s, s);
  const finder = (fx, fy) => { c.fillStyle = "#16161A"; c.fillRect(fx * s, fy * s, 7 * s, 7 * s); c.fillStyle = "#fff"; c.fillRect((fx + 1) * s, (fy + 1) * s, 5 * s, 5 * s); c.fillStyle = "#16161A"; c.fillRect((fx + 2) * s, (fy + 2) * s, 3 * s, 3 * s); };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}
let qrTimer = null;
function startQR(kind) {
  $("#loginForm").hidden = true;
  loginModal.querySelector(".oauth-divider").hidden = true;
  loginModal.querySelector(".oauth-row").hidden = true;
  $("#qrArea").hidden = false;
  drawQR($("#qrCanvas"));
  $("#qrTip").textContent = "请使用" + kind + "扫一扫登录";
  $("#qrTip").classList.remove("ok");
  /* 微信/QQ 原生登录需要企业资质认证；此处展示真实二维码样式并引导使用邮箱注册 */
  qrTimer = setTimeout(() => {
    $("#qrTip").textContent = "⚠️ " + (kind === "wx" ? "微信" : "QQ") + " 登录需要企业资质认证，暂未开放";
    $("#qrTip").classList.remove("ok");
    $("#qrTip").style.color = "var(--warn)";
    qrTimer = setTimeout(() => {
      resetLoginPanel();
      loginMode = "reg"; renderLoginMode();
      toast("请使用邮箱注册登录（微信/QQ 登录即将开放）");
    }, 1600);
  }, 2000);
}
$("#oauthWx").addEventListener("click", () => startQR("wx"));
$("#oauthQq").addEventListener("click", () => startQR("qq"));
$("#qrCancel").addEventListener("click", () => resetLoginPanel());
function resetLoginPanel() {
  clearTimeout(qrTimer);
  $("#qrArea").hidden = true;
  $("#loginForm").hidden = false;
  loginModal.querySelector(".oauth-divider").hidden = false;
  loginModal.querySelector(".oauth-row").hidden = false;
}
function renderUserChip() {
  const u = USERS[ME] || {};
  const av = u.avatar || {};
  const btn = $("#avatarBtn");
  if (!ME) { btn.textContent = "未"; btn.style.background = "linear-gradient(135deg,#9CA3AF,#6B7280)"; }
  else if (av.type === "zodiac") { btn.textContent = ZODIAC.find((z) => z[0] === av.v)[1]; btn.style.background = ""; }
  else { btn.textContent = ME[0]; btn.style.background = ""; }
  $("#userPop .user-pop-head").innerHTML = ME
    ? `<i>${esc(ME[0])}</i><div><b>${esc(ME)}</b><small>${u.verified ? "认证创作者 · Lv.3" : "新用户 · Lv.1"}</small></div>`
    : `<i>未</i><div><b>未登录</b><small>登录后享受完整功能</small></div>`;
}

/* ---- 顶栏交互：通知 / 用户菜单 / 主题 ---- */
const bellBtn = $("#bellBtn"), notifPop = $("#notifPop"), avatarBtn = $("#avatarBtn"), userPop = $("#userPop");
bellBtn.addEventListener("click", (e) => { e.stopPropagation(); notifPop.hidden = !notifPop.hidden; userPop.hidden = true; });
$("#notifList").addEventListener("click", (e) => {
  const item = e.target.closest("[data-n]"); if (!item) return;
  const n = NOTIFS[+item.dataset.n];
  n.unread = false; renderNotifs(); notifPop.hidden = true;
  if (n.go) location.hash = n.go;
});
$("#readAll").addEventListener("click", () => { NOTIFS.forEach((n) => (n.unread = false)); renderNotifs(); if (DB.isOnline() && MYUID) DB.markAllNotifsRead(MYUID); toast("已全部标记为已读"); });
avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!ME) { openLogin("login"); return; }
  userPop.hidden = !userPop.hidden; notifPop.hidden = true;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".notif")) notifPop.hidden = true;
  if (!e.target.closest(".user-menu")) userPop.hidden = true;
});
$("#logoutBtn").addEventListener("click", async () => { userPop.hidden = true; if (DB.isOnline()) await DB.signOut(); ME = null; MYUID = null; NOTIFS = []; renderNotifs(); renderUserChip(); route(); toast("已退出登录，期待下次再见"); });
$("#userPop").addEventListener("click", (e) => { if (!ME && e.target.closest("a")) { e.preventDefault(); openLogin("login"); toast("请先登录"); } });
const themeBtn = $("#themeBtn");
themeBtn.addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("mh-theme", t); } catch (_) {}
  themeBtn.classList.add("spin"); setTimeout(() => themeBtn.classList.remove("spin"), 420);
  toast(t === "dark" ? "🌙 已切换到深色模式" : "☀️ 已切换到浅色模式");
});

/* ---- 各视图内部交互（事件委托，容器持久） ---- */
$view("rank").addEventListener("click", (e) => {
  const r = e.target.closest("[data-open]");
  if (r) { openDetail(ITEMS.find((x) => x.id === +r.dataset.open)); return; }
  const dead = e.target.closest("[data-dead]");
  if (dead) { toast("该作品来自历代归档库（演示数据）"); return; }
  const rt = e.target.closest("[data-rtag]");
  if (rt) { rankState.tag = rankState.tag === rt.dataset.rtag ? "" : rt.dataset.rtag; updateRankList(); return; }
  const rp = e.target.closest("[data-rp]");
  if (rp) { rankState.period = rp.dataset.rp; renderRank(); }
});
$view("rank").addEventListener("input", (e) => { if (e.target.id === "rankQ") { rankState.q = e.target.value; updateRankList(); } });
$view("community").addEventListener("click", (e) => {
  const topic = e.target.closest("[data-topic]");
  if (topic) { feedState.topic = topic.dataset.topic; renderCommunity(); return; }
  const lp = e.target.closest("[data-like-post]");
  if (lp) {
    const p = FEED.find((x) => x.id === +lp.dataset.likePost);
    p.liked = !p.liked;
    lp.classList.toggle("liked", p.liked);
    lp.querySelector("span").textContent = p.likes + (p.liked ? 1 : 0);
    if (DB.isOnline() && p.dbid && ME) DB.togglePostLike(p.dbid).then((r) => { p.liked = r.liked; p.likes = r.count; lp.classList.toggle("liked", p.liked); lp.querySelector("span").textContent = r.count; }).catch(() => {});
    return;
  }
  const cp = e.target.closest("[data-cmt-post]");
  if (cp) { const id = +cp.dataset.cmtPost; feedState.open.has(id) ? feedState.open.delete(id) : feedState.open.add(id); $("#cmts-" + id).classList.toggle("open"); return; }
  const cs = e.target.closest("[data-cmt-send]");
  if (cs) { sendFeedCmt(+cs.dataset.cmtSend); return; }
  const oi = e.target.closest("[data-open-item]");
  if (oi) { openDetail(ITEMS.find((x) => x.id === +oi.dataset.openItem)); return; }
  const sp = e.target.closest("[data-share-post]");
  if (sp) { navigator.clipboard?.writeText(location.href).catch(() => {}); toast("🔗 动态链接已复制"); return; }
  if (e.target.closest("#compSend")) { sendFeedPost(); return; }
});
$view("community").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-cmt-input]")) sendFeedCmt(+e.target.dataset.cmtInput);
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "compText") sendFeedPost();
});
$view("community").addEventListener("input", (e) => { if (e.target.id === "compText") $("#composer").classList.toggle("has-text", e.target.value.trim().length > 0); });
function sendFeedCmt(id) {
  const p = FEED.find((x) => x.id === id);
  const input = $(`[data-cmt-input="${id}"]`);
  const v = input.value.trim(); if (!v) return;
  p.comments.unshift({ a: ME, t: v, time: "刚刚" });
  feedState.open.add(id);
  if (DB.isOnline() && p.dbid) { const u = DB.uidOf(ME); DB.insertPostComment(p.dbid, v, u).catch((e) => toast("评论同步失败：" + (e.message || e))); }
  renderCommunity();
  toast("💬 评论已发布");
}
function sendFeedPost() {
  const v = $("#compText").value.trim(); if (!v) return;
  if (requireLogin()) return;
  const uid = DB.uidOf(ME);
  const finish = (dbid) => {
    FEED.unshift({ id: dbid || Date.now(), dbid, a: ME, g: nickHash(ME), time: "刚刚", topic: "动态", text: v, tags: [], likes: 0, comments: [] });
    feedState.topic = "全部";
    renderCommunity();
    toast("🎉 动态已发布到社区");
  };
  if (DB.isOnline() && uid) DB.insertFeedPost({ topic: "动态", text: v, tags: [] }, uid).then((dbid) => finish(dbid)).catch((e) => toast("发布失败：" + (e.message || e)));
  else finish(null);
}
$view("profile").addEventListener("click", (e) => {
  const lvChip = e.target.closest("[data-level]");
  if (lvChip) { openLevel(profState.name); return; }
  const joinChip = e.target.closest("[data-join]");
  if (joinChip) { openJoinCal(profState.name); return; }
  const ps = e.target.closest("[data-pstat]");
  if (ps) { const k = ps.dataset.pstat; if (k === "works") renderProfile(profState.name, "works"); else openStatList(k); return; }
  const op2 = e.target.closest("[data-openpan]");
  if (op2) { openPan(ITEMS.find((x) => x.id === +op2.dataset.openpan)); return; }
  const vi = e.target.closest("[data-viewitem]");
  if (vi) { openDetail(ITEMS.find((x) => x.id === +vi.dataset.viewitem)); return; }
  const lf = e.target.closest("[data-listfollow]");
  if (lf) { const n = lf.dataset.listfollow; FOLLOWING.has(n) ? FOLLOWING.delete(n) : FOLLOWING.add(n); openStatList(currentListKind); return; }
  if (e.target.closest("#pMsg")) { openDM(profState.name); return; }
  const like = e.target.closest("[data-like]");
  if (like) { e.stopPropagation(); const it = ITEMS.find((x) => x.id === +like.closest(".card").dataset.id); it.liked = !it.liked; like.classList.toggle("liked", it.liked); toast(it.liked ? "❤️ 已加入收藏" : "已取消收藏"); return; }
  const tagChip = e.target.closest(".mini-chip-tag");
  if (tagChip && tagChip.dataset.tag) { e.stopPropagation(); state.tag = tagChip.dataset.tag; buildFilterBar(); renderGrid(); location.hash = "#/"; return; }
  const tab = e.target.closest("[data-ptab]");
  if (tab) { renderProfile(profState.name, tab.dataset.ptab); return; }
  if (e.target.closest("#pFollow")) {
    const n = profState.name;
    if (n === ME) return;
    FOLLOWING.has(n) ? FOLLOWING.delete(n) : FOLLOWING.add(n);
    if (DB.isOnline() && MYUID) DB.setFollow(MYUID, n, FOLLOWING.has(n));
    renderProfile(n, profState.tab);
    toast(FOLLOWING.has(n) ? "已关注 " + n : "已取消关注");
    return;
  }
  if (e.target.closest("#pMsg")) { toast("私信功能即将开放（演示）"); return; }
  const card = e.target.closest(".card");
  if (card) openDetail(ITEMS.find((x) => x.id === +card.dataset.id));
});
$view("studio").addEventListener("click", (e) => {
  const stab = e.target.closest("[data-stab]");
  if (stab) { location.hash = "#/studio?tab=" + stab.dataset.stab; return; }
  if (e.target.closest("#studioUpload")) { $("#uploadBtn").click(); return; }
  const goto = e.target.closest("[data-goto]");
  if (goto) { location.hash = goto.dataset.goto; return; }
  const wflt = e.target.closest("[data-wflt]");
  if (wflt) { renderStudio._flt = wflt.dataset.wflt; renderStudio("works"); return; }
  const op = e.target.closest("[data-op]");
  if (op) {
    const row = op.closest("tr"); const idx = [...$$("tbody tr", row.parentElement)].indexOf(row);
    const list = MY.items.filter((x) => (renderStudio._flt || "全部") === "全部" || stMap[x.status][1] === (renderStudio._flt || "全部"));
    const it = list[idx];
    if (op.dataset.op === "data") openItemData(it.mid);
    if (op.dataset.op === "edit") openItemEdit(it.mid);
    if (op.dataset.op === "off" || op.dataset.op === "on") {
      it.status = op.dataset.op === "off" ? "off" : "online";
      if (DB.isOnline() && it.dbid) DB.setWorkStatus(it.dbid, it.status);
      renderStudio("works"); toast(op.dataset.op === "off" ? "已下架，买家不再可见" : "已重新上架");
    }
    return;
  }
  if (e.target.closest("#withDraw")) {
    const btn = e.target.closest("#withDraw");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> 处理中…';
    setTimeout(() => {
      btn.classList.add("success"); btn.innerHTML = "✓ 已提交";
      MY.balance = 0;
      toast("💸 提现申请已提交，预计 1 个工作日到账");
      setTimeout(() => renderStudio("earnings"), 1200);
    }, 900);
    return;
  }
  if (e.target.closest("#setSave")) {
    USERS[ME].bio = $("#setBio").value.trim();
    if (DB.isOnline() && MYUID) DB.updateProfile(MYUID, { bio: USERS[ME].bio }).catch((e2) => toast("云同步失败：" + (e2.message || e2)));
    const btn = e.target.closest("#setSave");
    btn.classList.add("success"); btn.textContent = "✓ 已保存";
    setTimeout(() => { btn.classList.remove("success"); btn.textContent = "保存设置"; }, 1600);
    toast("设置已保存");
    return;
  }
  const zo = e.target.closest("[data-zo]");
  if (zo) {
    USERS[ME].avatar = { type: "zodiac", v: zo.dataset.zo };
    if (DB.isOnline() && MYUID) DB.updateProfile(MYUID, { avatar: USERS[ME].avatar }).catch(() => {});
    renderStudio("settings"); renderUserChip(); toast("已换上「" + zo.dataset.zo + "」生肖头像 🎉"); return;
  }
  const bs = e.target.closest("[data-bgsel]");
  if (bs) { USERS[ME].bg = bs.dataset.bgsel; USERS[ME].bgImg = null; if (DB.isOnline() && MYUID) DB.updateProfile(MYUID, { bg: bs.dataset.bgsel, bg_img: null }).catch(() => {}); renderStudio("settings"); toast("背景已切换，去个人主页体验互动效果 →"); return; }
  if (e.target.closest("#avUpload")) { avFile.click(); return; }
  if (e.target.closest("#bgUpload")) { bgFile.click(); return; }
  const pm = e.target.closest(".pay-m");
  if (pm) { $$(".pay-m").forEach((x) => x.classList.toggle("on", x === pm)); toast("收款方式：已选择 " + pm.textContent); return; }
});
document.addEventListener("click", (e) => {
  const nl = e.target.closest("[data-needlogin]");
  if (nl) { openLogin("login"); return; }
  const gu = e.target.closest("[data-goto-user]");
  if (gu) { location.hash = "#/profile/" + encodeURIComponent(gu.dataset.gotoUser); return; }
  const gt = e.target.closest("[data-goto]");
  if (gt) location.hash = gt.dataset.goto;
});
document.addEventListener("dblclick", (e) => {
  if (!$view("profile") || $view("profile").hidden) return;
  if (e.target.closest(".p-avatar")) {
    if (profState.name !== ME) { toast("只能修改自己的头像"); return; }
    location.hash = "#/studio?tab=settings";
    toast("🎨 在这里选择 12 生肖头像或上传自定义头像");
  }
  if (e.target.closest(".p-name")) {
    if (profState.name !== ME) { toast("只能修改自己的昵称"); return; }
    openRename();
  }
});

/* ---------- 深链（分享定位 / 演示）：?view=detail&id=11 或 ?view=upload&step=3 ---------- */
const params = new URLSearchParams(location.search);
if (params.has("flat")) document.documentElement.classList.add("flat"); // 低特效：无毛玻璃/动画（截图与低性能设备用）
else { try { const savedTheme = localStorage.getItem("mh-theme"); if (savedTheme) document.documentElement.dataset.theme = savedTheme; } catch (_) {} }

/* ---------- 启动：连接数据库 → 加载数据 → 渲染 → 深链 ---------- */
let bootDone = false;
const bootQueue = [];
function afterBoot(fn) { bootDone ? fn() : bootQueue.push(fn); }

async function loadSocial(myUid) {
  const social = await DB.fetchSocial();
  social.forEach((f) => {
    const a = DB.nickOf(f.follower), b = DB.nickOf(f.followee);
    if (!a || !b) return;
    if (USERS[b]) USERS[b].followers = (USERS[b].followers || 0) + 1;
    if (USERS[a]) USERS[a].following = (USERS[a].following || 0) + 1;
    if (myUid && f.follower === myUid) FOLLOWING.add(b);
  });
}
async function loadPublic() {
  const works = await DB.fetchWorks();
  ITEMS.length = 0; ITEMS.push(...works);
  const profiles = await DB.fetchProfiles();
  profiles.forEach((p) => {
    const nick = p.nickname; DB.remember(p.id, nick);
    if (!USERS[nick]) USERS[nick] = { g: nickHash(nick) };
    Object.assign(USERS[nick], { bio: p.bio, verified: p.verified, level: p.level || 1, joined: p.joined || "", avatar: p.avatar || {}, bg: p.bg, bgImg: p.bg_img, quote: p.quote, payQr: p.pay_qr });
  });
  const [comments, reviews, feed] = await Promise.all([DB.fetchAllWorkComments(), DB.fetchAllReviews(), DB.fetchFeed(MYUID, relTime)]);
  ITEMS.forEach((it) => { it.comments = []; it.reviews = []; });
  comments.forEach((c) => { const it = ITEMS.find((x) => x.dbid === c.work_id); if (it) it.comments.push({ a: DB.nickOf(c.author) || "?", t: c.body, time: (c.created_at || "").slice(0, 10) }); });
  reviews.forEach((r) => { const it = ITEMS.find((x) => x.dbid === r.work_id); if (it) it.reviews.push({ a: r.profiles?.nickname || "?", s: r.rating, t: r.body, time: (r.created_at || "").slice(0, 10) }); });
  ITEMS.forEach((it) => {
    it.ratingCnt = it.reviews.length;
    it.rating = it.ratingCnt ? (it.reviews.reduce((s, r) => s + r.s, 0) / it.ratingCnt).toFixed(1) : 5;
  });
  FEED.length = 0; FEED.push(...feed);
  TOPICS.forEach((t) => { t.hot = FEED.filter((p) => p.topic === t.n).length * 8 + 6; });
}
async function loadMyData() {
  if (!MYUID) return;
  const myWorks = await DB.fetchMyWorks(MYUID);
  MY.items = myWorks.map((w) => ({ mid: "m" + w.dbid, dbid: w.dbid, title: w.title, emoji: w.emoji, g: w.g, coverURL: w.coverURL, status: w.status, price: w.price, views: w.views, downloads: w.downloads, date: w.updated, link: w.link, linkKind: w.linkKind, siteUrl: w.siteUrl }));
  MY.txs = await DB.fetchSellerOrders(MYUID);
  const buy = await DB.fetchBuyerOrders(MYUID);
  OWNED.clear(); MY.purchased = [];
  buy.forEach((b) => { if (b.raw === "paid" || b.raw === "confirmed") { OWNED.add(b.work_id); MY.purchased.push({ id: b.work_id, time: b.date.slice(0, 10), price: b.amt }); } });
  const e = await DB.myEarnings();
  MY.total = +e.total || 0; MY.month = +e.month || 0; MY.balance = +e.total || 0;
  const now = Date.now(), day = 86400000;
  MY.chart = Array.from({ length: 7 }, (_, i) => {
    const d0 = new Date(now - (6 - i) * day), key = d0.toISOString().slice(0, 10);
    return MY.txs.filter((t) => (t.date || "").startsWith(key.slice(5))).reduce((s, t) => s + t.amt, 0);
  });
  MY.today = MY.chart[6];
  /* 私信会话 */
  const msgs = await DB.fetchMyMessages(MYUID);
  const groups = {};
  msgs.forEach((m) => { const other = m.me ? DB.nickOf(m.receiverUid) : m.a; if (!other) return; (groups[other] = groups[other] || { who: other, unread: 0, msgs: [] }).msgs.push({ me: m.me, t: m.t, time: m.time }); });
  CONVS = Object.values(groups);
}
async function loadNotifs() {
  if (!MYUID) return;
  NOTIFS = await DB.fetchNotifs(MYUID);
  renderNotifs();
}
async function boot() {
  buildFilterBar(); buildCoverPicker(); renderTagSelected(); updateWizard(); renderUserChip(); renderNotifs();
  const ok = DB.init();
  if (!ok) { $("#dbBanner").hidden = false; renderGrid(); route(); bootDone = true; afterBootAll(); return; }
  DB.onAuth(async (nick) => {
    const prev = ME; ME = nick || null;
    if (ME) {
      MYUID = await DB.uid() || MYUID;
      if (!USERS[ME]) USERS[ME] = { g: nickHash(ME) };
      USERS[ME].bg = USERS[ME].bg || "aurora";
      await loadSocial(MYUID).catch(() => {});
      await loadMyData().catch(() => {});
      await loadNotifs().catch(() => {});
    } else {
      MYUID = null; NOTIFS = []; MY.items = []; MY.txs = []; MY.purchased = [];
      OWNED.clear(); FOLLOWING.clear(); renderNotifs();
    }
    if (prev !== ME) { renderUserChip(); route(); }
  });
  try {
    const sess = await DB.getSession();
    if (sess) { ME = await DB.ensureNickname(sess) || null; MYUID = sess.id; }
    if (ME) {
      if (!USERS[ME]) USERS[ME] = { g: nickHash(ME) };
      USERS[ME].bg = USERS[ME].bg || "aurora";
      await loadSocial(MYUID); await loadMyData(); await loadNotifs();
    }
    await loadPublic();
  } catch (e) { console.warn("数据加载失败：", e); $("#dbBanner").hidden = false; }
  renderGrid(); route(); bootDone = true;
  afterBootAll();
}
function afterBootAll() { while (bootQueue.length) { try { bootQueue.shift()(); } catch (e) { console.warn(e); } } }

buildFilterBar(); renderUserChip(); renderNotifs();
boot();

/* 深链（数据就绪后执行） */
afterBoot(() => {
  const view = params.get("view");
  if (view === "detail") {
    const id = +(params.get("id") || 0);
    const it = ITEMS.find((x) => x.dbid === id || x.id === id) || ITEMS[0];
    if (it) { if (params.get("shots") === "1") it.shots = makeSampleShots(); openDetail(it); }
  }
  if (view === "upload") {
    if (!requireLogin()) return;
    $("#uploadBtn").click();
    const st = Math.min(3, Math.max(1, +(params.get("step") || 1)));
    if (st >= 2) {
      $("#upTitle").value = "我的新作品";
      $("#upDesc").value = "作品功能介绍。";
      renderTagSelected();
    }
    up.step = st; updateWizard();
    if (params.get("crop") === "1") {
      const cv = document.createElement("canvas"); cv.width = 960; cv.height = 640;
      const c = cv.getContext("2d");
      const g = c.createLinearGradient(0, 0, 960, 640);
      g.addColorStop(0, "#34D399"); g.addColorStop(.55, "#0EA5E9"); g.addColorStop(1, "#6366F1");
      c.fillStyle = g; c.fillRect(0, 0, 960, 640);
      c.fillStyle = "rgba(255,255,255,.92)"; c.font = "bold 84px sans-serif"; c.textAlign = "center";
      c.fillText("示例封面图 · 960×640", 480, 340);
      openCrop(cv.toDataURL());
    }
    if (params.get("shots") === "1") { up.shots.push(...makeSampleShots()); renderShotPicker(); }
    if (params.get("tagOpen") === "1") openTagSuggest();
    if (params.get("paid") === "1") {
      up.priceMode = "paid";
      $$(".price-opt").forEach((x) => x.classList.toggle("on", x.dataset.price === "paid"));
      $("#priceField").hidden = false; $("#escrowNote").hidden = false; validateStep();
    }
  }
  if (params.get("notif") === "1") notifPop.hidden = false;
  if (params.get("itemdata")) openItemData(params.get("itemdata"));
  if (params.get("itemedit")) openItemEdit(params.get("itemedit"));
  if (params.get("level") === "1") openLevel(ME);
  if (params.get("cal") === "1") openJoinCal(ME);
  if (params.get("rename") === "1") openRename();
  if (params.get("login") === "1") openLogin();
  if (params.get("rp")) rankState.period = params.get("rp");
  if (params.get("rtag")) rankState.tag = params.get("rtag");
  if (params.get("rp") || params.get("rtag")) { buildFilterBar(); renderRank(); }
  if (params.get("bgs")) { if (ME && USERS[ME]) { USERS[ME].bg = params.get("bgs"); if (!$("#view-profile").hidden) renderProfile(ME, "works"); } }
});
} catch (err) {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;top:0;left:0;z-index:9999;background:#fee;color:#900;padding:10px;font:12px monospace;max-width:100%;white-space:pre-wrap";
  d.textContent = "CRASH: " + err.message + "\n" + (err.stack || "").split("\n").slice(0, 4).join("\n");
  document.body.appendChild(d);
}
