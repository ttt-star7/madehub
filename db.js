/* ============================================================
   造物集 MadeHub · Supabase 数据适配层
   由 config.js 提供密钥；未配置时 DB.online = false，站点以空数据运行。
   所有数据库访问集中在这里，业务层只调用 DB.* 接口。
   ============================================================ */
window.DB = (function () {
  "use strict";
  let client = null;
  let online = false;
  const names = {};            // uid -> nickname
  const uids = {};             // nickname -> uid
  const C = window.MH_CONFIG || {};

  function init() {
    if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase
      && /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(C.SUPABASE_URL)) {
      try { client = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY); online = true; }
      catch (e) { console.warn("DB init failed:", e); online = false; }
    }
    return online;
  }
  const isOnline = () => online;
  const meUid = () => { try { return client?.auth.getUser()?.then?.((r) => r.data?.user?.id || null) || null; } catch (_) { return null; } };
  async function uid() { if (!online) return null; const r = await client.auth.getUser(); return r?.data?.user?.id || null; }
  const nickOf = (id) => names[id] || null;
  const uidOf = (nick) => uids[nick] || null;

  /* ---------- 会话 / 认证 ---------- */
  async function getSession() {
    if (!online) return null;
    const r = await client.auth.getSession();
    return r?.data?.session?.user || null;
  }
  async function signUp(email, pass, nickname) {
    const r = await client.auth.signUp({ email, password: pass, options: { data: { nickname } } });
    if (r.error) throw r.error;
    return r;
  }
  async function signIn(email, pass) {
    const r = await client.auth.signInWithPassword({ email, password: pass });
    if (r.error) throw r.error;
    return r;
  }
  async function signOut() { try { await client.auth.signOut(); } catch (_) {} }
  function onAuth(cb) {
    if (!online) return;
    client.auth.onAuthStateChange(async (_ev, session) => {
      if (session?.user) {
        const nick = await ensureNickname(session.user);
        cb(nick, session.user);
      } else cb(null, null);
    });
  }
  async function ensureNickname(user) {
    let nick = user.user_metadata?.nickname || null;
    if (!nick) {
      const { data } = await client.from("profiles").select("nickname").eq("id", user.id).single();
      nick = data?.nickname || null;
    }
    if (nick) remember(user.id, nick);
    return nick;
  }
  function remember(id, nick) { names[id] = nick; uids[nick] = id; }

  /* ---------- 资料 ---------- */
  async function fetchProfiles() {
    const { data, error } = await client.from("profiles").select("*");
    if (error) throw error;
    return data || [];
  }
  async function updateProfile(id, patch) {
    const { error } = await client.from("profiles").update(patch).eq("id", id);
    if (error) throw error;
  }
  async function fetchProfile(id) {
    const { data, error } = await client.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  /* ---------- 作品 ---------- */
  const WORK_SEL = "*, profiles!works_author_fk(nickname)";
  function workToApp(row) {
    return {
      dbid: row.id,
      id: row.id,
      title: row.title,
      desc: row.descr || "",
      type: row.type || "其他",
      tags: row.tags || [],
      price: Number(row.price) || 0,
      emoji: row.cover?.emoji || "🧩",
      g: row.cover?.g ?? 0,
      coverURL: row.cover?.url || null,
      shots: row.shots || [],
      link: row.link_kind === "url" ? null : {
        pan: row.pan_brand || "网盘", url: row.pan_url || "", code: row.pan_code || "", exp: row.pan_exp || "长期有效",
      },
      linkKind: row.link_kind || "pan",
      siteUrl: row.site_url || "",
      status: row.status,
      downloads: row.downloads || 0,
      likes: row.likes || 0,
      views: row.views || 0,
      ver: row.ver || "v1.0",
      author: row.profiles?.nickname || "?",
      updated: (row.updated_at || row.created_at || "").slice(0, 10),
      createdTs: new Date(row.created_at || Date.now()).getTime(),
    };
  }
  function appToWork(a, authorUid) {
    return {
      author: authorUid,
      title: a.title,
      descr: a.desc || "",
      type: a.type || "其他",
      tags: a.tags || [],
      price: a.price || 0,
      cover: { emoji: a.emoji || "🧩", g: a.g ?? 0, url: a.coverURL || null },
      shots: a.shots || [],
      link_kind: a.linkKind || (a.siteUrl ? "url" : "pan"),
      pan_brand: a.link?.pan || null, pan_url: a.link?.url || null,
      pan_code: a.link?.code || null, pan_exp: a.link?.exp || "长期有效",
      site_url: a.siteUrl || null,
      status: a.status || "online",
      ver: a.ver || "v1.0",
    };
  }
  async function fetchWorks() {
    const { data, error } = await client.from("works").select(WORK_SEL).eq("status", "online").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(workToApp);
  }
  async function fetchMyWorks(uid) {
    const { data, error } = await client.from("works").select(WORK_SEL).eq("author", uid).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(workToApp);
  }
  async function insertWork(appItem, authorUid) {
    const row = appToWork(appItem, authorUid);
    const { data, error } = await client.from("works").insert(row).select(WORK_SEL).single();
    if (error) throw error;
    return workToApp(data);
  }
  async function updateWork(appItem) {
    const row = appToWork(appItem, null);
    delete row.author;
    const { error } = await client.from("works").update(row).eq("id", appItem.dbid || appItem.id);
    if (error) throw error;
  }
  async function setWorkStatus(dbid, status) {
    const { error } = await client.from("works").update({ status }).eq("id", dbid);
    if (error) throw error;
  }
  async function deleteWork(dbid) {
    const { error } = await client.from("works").delete().eq("id", dbid);
    if (error) throw error;
  }
  async function bump(dbid, kind) { const { error } = await client.rpc(kind === "likes" ? "bump_work_likes" : kind === "dl" ? "bump_work_downloads" : "bump_work_views", kind === "likes" ? { wid: dbid, delta: 1 } : { wid: dbid }); if (error) console.warn(error); }

  /* ---------- 订单 / 已购 ---------- */
  const ORD_SEL = "*, works(title), buyer_p:profiles!orders_buyer_fk(nickname), seller_p:profiles!orders_seller_fk(nickname)";
  function orderToTx(row) {
    return {
      id: row.id, dbid: row.id,
      no: "MH" + String(row.id).padStart(7, "0"),
      it: row.works?.title || "",
      buyer: row.buyer_p?.nickname || "",
      amt: Number(row.amount),
      status: row.status === "paid" ? "托管中" : row.status === "confirmed" ? "已打款" : row.status === "refunded" ? "已退款" : row.status,
      date: (row.created_at || "").slice(5, 16).replace("T", " "),
      work_id: row.work_id, buyer_uid: row.buyer, seller_uid: row.seller, raw: row.status,
    };
  }
  async function fetchSellerOrders(uid) {
    const { data, error } = await client.from("orders").select(ORD_SEL).eq("seller", uid).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(orderToTx);
  }
  async function fetchBuyerOrders(uid) {
    const { data, error } = await client.from("orders").select(ORD_SEL).eq("buyer", uid).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(orderToTx);
  }
  async function createOrder(work, buyerUid) {
    const sellerUid = uidOf(work.author);
    const { data, error } = await client.from("orders").insert({
      work_id: work.dbid || work.id, buyer: buyerUid, seller: sellerUid,
      amount: Number(work.price) || 0, pay_method: window.MH_CONFIG?.PAY_MODE || "demo",
    }).select("id").single();
    if (error) throw error;
    return data.id;
  }
  async function confirmOrder(orderId) {
    const { error } = await client.from("orders").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", orderId);
    if (error) throw error;
  }
  async function myEarnings() {
    const { data, error } = await client.rpc("my_earnings");
    if (error) throw error;
    return data || { total: 0, month: 0, escrow: 0 };
  }

  /* ---------- 社区动态 ---------- */
  const FEED_SEL = "*, profiles!feed_posts_author_fk(nickname), post_likes(user_id), post_comments(*, profiles!post_comments_author_fk(nickname))";
  function feedToApp(row, myUid, rel) {
    return {
      dbid: row.id, id: row.id, a: row.profiles?.nickname || "?",
      g: (row.profiles?.nickname || "?").length % GRADS_FALLBACK,
      time: rel(row.created_at), topic: row.topic || "动态",
      text: row.body, tags: row.tags || [], item: row.item_id || null,
      likes: (row.post_likes || []).length,
      liked: myUid ? (row.post_likes || []).some((l) => l.user_id === myUid) : false,
      comments: (row.post_comments || []).map((c) => ({ a: c.profiles?.nickname || "?", t: c.body, time: rel(c.created_at) })),
    };
  }
  let GRADS_FALLBACK = 12; // 哈希基数（真实渐变由 UI 层按昵称推导）
  async function fetchFeed(myUid, rel) {
    const { data, error } = await client.from("feed_posts").select(FEED_SEL).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return (data || []).map((r) => feedToApp(r, myUid, rel));
  }
  async function insertFeedPost(p, authorUid) {
    const { data, error } = await client.from("feed_posts").insert({
      author: authorUid, topic: p.topic || "动态", body: p.text, tags: p.tags || [], item_id: p.item || null,
    }).select("id").single();
    if (error) throw error;
    return data.id;
  }
  async function togglePostLike(pid) { const { data, error } = await client.rpc("toggle_post_like", { pid }); if (error) throw error; return data; }
  async function insertPostComment(pid, body, authorUid) { const { error } = await client.from("post_comments").insert({ post_id: pid, body, author: authorUid }); if (error) throw error; }

  /* ---------- 作品评论 ---------- */
  async function fetchWorkComments(wid) {
    const { data, error } = await client.from("work_comments").select("*, profiles!work_comments_author_fk(nickname)").eq("work_id", wid).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((c) => ({ a: c.profiles?.nickname || "?", t: c.body, time: (c.created_at || "").slice(0, 10) }));
  }
  async function insertWorkComment(wid, body, authorUid) { const { error } = await client.from("work_comments").insert({ work_id: wid, body, author: authorUid }); if (error) throw error; }

  /* ---------- 关注 ---------- */
  async function fetchFollowing(uid) {
    const { data, error } = await client.from("follows").select("followee").eq("follower", uid);
    if (error) throw error;
    return (data || []).map((x) => names[x.followee] || x.followee);
  }
  async function setFollow(followerUid, targetNick, on) {
    const tid = uids[targetNick]; if (!tid) return;
    if (on) { const { error } = await client.from("follows").insert({ follower: followerUid, followee: tid }); if (error) console.warn(error); }
    else { const { error } = await client.from("follows").delete().eq("follower", followerUid).eq("followee", tid); if (error) console.warn(error); }
  }

  /* ---------- 通知 ---------- */
  async function fetchNotifs(uid) {
    const { data, error } = await client.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return (data || []).map((n) => ({ ico: n.ico, bg: n.tone, text: n.body, time: (n.created_at || "").slice(5, 16).replace("T", " "), unread: !!n.unread, go: n.go_to || "" }));
  }
  async function pushNotif(uid, n) {
    const { error } = await client.from("notifications").insert({ user_id: uid, ico: n.ico || "🔔", tone: n.bg || "--accent-soft", body: n.text, go_to: n.go || "", unread: true });
    if (error) console.warn(error);
  }
  async function markAllNotifsRead(uid) {
    const { error } = await client.from("notifications").update({ unread: false }).eq("user_id", uid);
    if (error) console.warn(error);
  }

  /* ---------- 私信 ---------- */
  async function fetchMessages(convKey) {
    const { data, error } = await client.from("messages").select("*, profiles!messages_sender_fk(nickname)").eq("conv", convKey).order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    return (data || []).map((m) => ({ a: m.profiles?.nickname || "?", t: m.body, time: (m.created_at || "").slice(5, 16).replace("T", " ") }));
  }
  async function sendMessage(convKey, senderUid, receiverUid, body) {
    const { error } = await client.from("messages").insert({ conv: convKey, sender: senderUid, receiver: receiverUid, body });
    if (error) throw error;
  }

  /* ---------- 存储（图片） ---------- */
  // dataURL 转 Blob：手工 base64 解码，全程不发起任何网络请求，杜绝 SSRF
  function dataURLToBlob(dataURL) {
    if (typeof dataURL !== "string" || dataURL.indexOf("data:image/") !== 0 || dataURL.indexOf("base64,") < 0) {
      throw new Error("仅支持 base64 编码的 data:image 图片内容");
    }
    const markAt = dataURL.indexOf("base64,") + "base64,".length;
    const mime = dataURL.slice(11, dataURL.indexOf(";"));
    const b64 = dataURL.slice(markAt).replace(/\s+/g, "");
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || "image/png" });
  }
  function safeName(p) { return String(p).replace(/[^\w./-]/g, "_"); }
  async function uploadMedia(path, dataURL) {
    const blob = dataURLToBlob(dataURL);
    const cleanPath = safeName(path);
    const { error } = await client.storage.from("media").upload(cleanPath, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) throw error;
    const { data } = client.storage.from("media").getPublicUrl(cleanPath);
    return data.publicUrl;
  }

  /* ---------- 批量读取（启动 hydrate 用） ---------- */
  async function fetchSocial() {
    const { data, error } = await client.from("follows").select("*");
    if (error) throw error;
    return data || [];
  }
  async function fetchAllWorkComments() {
    const { data, error } = await client.from("work_comments").select("*, profiles!work_comments_author_fk(nickname)").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function fetchAllReviews() {
    const { data, error } = await client.from("reviews").select("*, profiles!reviews_author_fk(nickname)").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function fetchMyMessages(uid) {
    const { data, error } = await client.from("messages").select("*, profiles!messages_sender_fk(nickname)").or(`sender.eq.${uid},receiver.eq.${uid}`).order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((m) => ({
      senderUid: m.sender, receiverUid: m.receiver,
      a: m.profiles?.nickname || (m.sender === uid ? (names[m.sender] || "我") : (names[m.receiver] || "对方")),
      me: m.sender === uid, t: m.body, time: (m.created_at || "").slice(5, 16).replace("T", " "),
    }));
  }

  return {
    init, isOnline, uid, nickOf, uidOf, remember,
    getSession, signUp, signIn, signOut, onAuth,
    fetchProfiles, updateProfile, fetchProfile,
    fetchWorks, fetchMyWorks, insertWork, updateWork, setWorkStatus, deleteWork, bump,
    fetchSellerOrders, fetchBuyerOrders, createOrder, confirmOrder, myEarnings,
    fetchFeed, insertFeedPost, togglePostLike, insertPostComment,
    fetchWorkComments, insertWorkComment,
    fetchFollowing, setFollow,
    fetchNotifs, pushNotif, markAllNotifsRead,
    fetchMessages, sendMessage, uploadMedia,
    fetchSocial, fetchAllWorkComments, fetchAllReviews, fetchMyMessages,
  };
})();
