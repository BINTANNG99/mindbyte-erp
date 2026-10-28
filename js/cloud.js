/* MINDBYTE Order System: cloud database on a private GitHub repository.
   The device copy (IndexedDB) stays the working copy. Changes are pushed to the repo a few seconds after
   they are made, one commit per save, so the repo holds the full history of every edit and any earlier
   version can be restored. Other devices pull new commits on start-up, on focus and every minute.

   Repo layout: orders.json, customers.json, prices.json, expenses.json, workers.json
                ({ records: [...], deleted: { id: time } }), settings.json, audit.json, files/<id> (proofs, logo, QRIS).
   Deletions travel as tombstones ("deleted"), so a record removed on one device is removed everywhere. */
"use strict";

const GH_FILES = [...COLLS, "settings", "audit"];
const Cloud = {
  cfg: null, state: "off", /* off | syncing | live | error */ error: "", lastSync: 0, applying: false,
  dirty: new Set(), shas: {}, head: "", chain: Promise.resolve(), timer: 0, pushedAt: 0, tomb: {}, sentFiles: new Set(),

  loadCfg() { this.cfg = lsGet("mb_gh_cfg"); this.shas = lsGet("mb_gh_shas") || {}; this.head = lsGet("mb_gh_head") || ""; this.sentFiles = new Set(lsGet("mb_gh_files") || []); this.pushedAt = lsGet("mb_gh_pushed") || 0; return this.cfg; },
  saveState() { lsSet("mb_gh_shas", this.shas); lsSet("mb_gh_head", this.head); lsSet("mb_gh_files", [...this.sentFiles]); lsSet("mb_gh_pushed", this.pushedAt); },
  /* cfg.api lets a test server stand in for api.github.com */
  base() { return `${this.cfg.api || "https://api.github.com"}/repos/${this.cfg.owner}/${this.cfg.repo}`; },
  async api(path, opt = {}) {
    const r = await fetch(`${this.base()}${path}`, { ...opt, cache: "no-store",
      headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opt.body ? { "Content-Type": "application/json" } : {}), ...(opt.headers || {}) } });
    if (r.status === 404 && opt.allow404) return null;
    if (!r.ok) { const e = new Error((await r.json().catch(() => ({}))).message || `GitHub error ${r.status}`); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  },
  async init() {
    if (!this.loadCfg()) return;
    if (this.cfg.mode === "email") Auth.renew();
    this.tomb = (await metaGet("tomb")) || {};
    wrapStoreForCloud();
    this.sync();
    addEventListener("focus", () => this.pull());
    addEventListener("online", () => { this.flush(); this.pull(); });
    /* near-realtime: while the app is on screen, look for other devices' changes every 5 seconds
       (one small request when nothing changed), and at once when the app comes back into view */
    setInterval(() => { if (!document.hidden) this.pull(); }, 5000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.pull(); });
  },
  /* first contact and manual "Sync Now": pull everything, merge, push what is newer here */
  sync() { return this.queue(async () => { this.state = "syncing"; updateStoreInfo(); await this.pullNow(true); GH_FILES.forEach(n => this.dirty.add(n)); await this.pushNow("Sync from " + deviceName()); await this.sendFiles(); }); },
  /* one pull at a time: a slow connection must not pile up checks */
  pull() { if (!this.cfg || !navigator.onLine || this.pulling) return; this.pulling = true; this.queue(async () => { try { await this.pullNow(false); } finally { this.pulling = false; } }); },
  flush() { clearTimeout(this.timer); if (this.dirty.size) this.queue(() => this.pushNow()); },
  touch(name) { this.dirty.add(name); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1500); updateStoreInfo(); },
  queue(fn) {
    this.chain = this.chain.then(async () => {
      try { await fn(); this.state = "live"; this.error = ""; }
      catch (e) {
        this.state = "error"; this.error = !navigator.onLine ? "Offline. Changes are kept on this device and sent when the connection returns." : e.status === 401 ? (this.cfg.mode === "email" ? "Signed out. Sign in again." : "The access token was rejected (expired or revoked). Enter a new one in Settings.") : e.message || String(e);
        if (e.status === 401 && this.cfg.mode === "email") Auth.expired();
      }
      updateStoreInfo();
    });
    return this.chain;
  },
  async readFile(name, ref) {
    const meta = await this.api(`/contents/${name}.json${ref ? `?ref=${ref}` : ""}`, { allow404: true }); if (!meta) return { sha: null, data: null };
    let text = meta.content ? b64dec(meta.content) : "";
    /* through the sign-in worker the raw file comes from the same path; download_url would bypass it */
    if (!text) { const raw = await fetch((this.cfg.mode !== "email" && meta.download_url) || `${this.base()}/contents/${name}.json${ref ? `?ref=${ref}` : ""}`, { headers: { Authorization: `Bearer ${this.cfg.token}`, Accept: "application/vnd.github.raw" }, cache: "no-store" }); text = await raw.text(); }
    return { sha: meta.sha, data: text ? JSON.parse(text) : null };
  },
  async pullNow(force) {
    const c = await this.api(`/commits?per_page=1`, { allow404: true }).catch(e => { if (e.status === 409) return []; throw e; }); /* 409 = empty repo */
    const head = c && c[0] ? c[0].sha : "";
    if (!force && head === this.head) { this.lastSync = Date.now(); return; }
    let changed = false;
    for (const n of GH_FILES) { const f = await this.readFile(n); if (f.sha === this.shas[n] && !force) continue; if (f.data) changed = (await this.mergeIn(n, f.data)) || changed; this.shas[n] = f.sha; }
    this.head = head; this.lastSync = Date.now(); this.saveState();
    if (changed) refreshSafe();
  },
  /* apply a remote file to the device copy; returns true when anything changed here */
  async mergeIn(n, remote) {
    this.applying = true;
    try {
      if (n === "settings") { if ((remote.savedAt || 0) > (S.settings.savedAt || 0)) { loadSettings({ ...remote.value, savedAt: remote.savedAt }); await Store._meta("settings", S.settings); applyTheme(); loadImages(); return true; } return false; }
      if (n === "audit") { const before = S.audit.length; S.audit = mergeAudit(S.audit, remote.value || []); await Store._meta("audit", S.audit); return S.audit.length !== before; }
      const m = mergeColl(S[n], remote, this.tomb[n] || {});
      this.tomb[n] = m.deleted; await Store._meta("tomb", this.tomb);
      const local = new Map(S[n].map(r => [r.id, r])), put = m.records.filter(r => { const l = local.get(r.id); return !l || JSON.stringify(l) !== JSON.stringify(r); });
      const del = S[n].filter(r => !m.records.some(x => x.id === r.id));
      /* an order changed elsewhere (another device, Claude, ChatGPT) keeps this device's previous version on its undo list,
         so the order page's undo button can take the change back; changes by an AI app also say so on screen */
      if (n === "orders") { const ai = [];
        put.forEach(r => { const l = local.get(r.id); if (l && (r.updatedAt || 0) > (l.updatedAt || 0)) { pushUndo(l); const t = r.log?.[r.log.length - 1]?.text || ""; if (/^(Claude|ChatGPT|AI)[^:]{0,20}: /i.test(t)) ai.push([r, t]); } });
        if (ai.length) setTimeout(() => { const [r, t] = ai[ai.length - 1]; toast(ai.length > 1 ? `${plural(ai.length, "order")} changed by an AI app` : `Order ${qfmt(r.queue)}: ${t}`, () => stepHist(r.id, -1)); }, 400); }
      if (put.length) await Store._putMany(n, put); for (const r of del) await Store._del(n, r.id);
      return !!(put.length || del.length);
    } finally { this.applying = false; }
  },
  bodyOf(n) {
    if (n === "settings") return { savedAt: S.settings.savedAt || Date.now(), value: S.settings };
    if (n === "audit") return { value: S.audit };
    return { records: [...S[n]].sort((a, b) => String(a.id).localeCompare(String(b.id))), deleted: this.tomb[n] || {} };
  },
  /* one commit per save, holding every changed file (Git Data API); retried when another device pushed first */
  async pushNow(message) {
    if (!this.dirty.size || !navigator.onLine) return;
    const msg = message || commitMessage(this.pushedAt), br = this.cfg.branch || "main";
    for (let attempt = 0; ; attempt++) {
      const ref = await this.api(`/git/ref/heads/${br}`, { allow404: true }).catch(e => { if (e.status === 409) return null; throw e; });
      if (!ref) { /* empty repository: the first file has to be created through the contents API */
        await this.api(`/contents/README.md`, { method: "PUT", body: JSON.stringify({ message: "Create MINDBYTE data repository", content: b64enc("# MINDBYTE data\n\nPrivate database of the MINDBYTE Order System. Do not edit by hand.\n"), branch: br }) });
        continue;
      }
      const head = ref.object.sha, names = [...this.dirty];
      /* another device pushed since our last look: take in every file it changed, not only the ones we are about to write,
         because after this push our head moves past that commit and a later pull would skip it */
      if (head !== this.head) { let changed = false; for (const n of GH_FILES) { const f = await this.readFile(n); if (f.data && f.sha !== this.shas[n]) changed = (await this.mergeIn(n, f.data)) || changed; this.shas[n] = f.sha; } if (changed) refreshSafe(); }
      const base = await this.api(`/git/commits/${head}`);
      const tree = await this.api(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree: names.map(n => ({ path: `${n}.json`, mode: "100644", type: "blob", content: JSON.stringify(clean(this.bodyOf(n)), null, 1) })) }) });
      if (tree.sha === base.tree.sha) { names.forEach(n => this.dirty.delete(n)); this.head = head; break; }   /* nothing actually changed */
      const commit = await this.api(`/git/commits`, { method: "POST", body: JSON.stringify({ message: msg, tree: tree.sha, parents: [head] }) });
      try { await this.api(`/git/refs/heads/${br}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }); }
      catch (e) { if (e.status === 422 && attempt < 4) continue; throw e; }
      tree.tree.forEach(t => { const n = t.path.replace(/\.json$/, ""); if (GH_FILES.includes(n)) this.shas[n] = t.sha; });
      this.head = commit.sha; names.forEach(n => this.dirty.delete(n)); break;
    }
    this.pushedAt = Date.now(); this.lastSync = Date.now(); this.saveState();
  },
  /* proofs, logo and QRIS go to files/<id> once */
  async sendFiles() {
    if (!Store.db) return;
    const ids = [S.settings.qrisFile, S.settings.logoFile, ...S.orders.flatMap(o => Object.values(o.proofs || {}).map(p => p.fileId))].filter(id => id && !this.sentFiles.has(id));
    for (const id of ids) { const f = await Store._getFile(id); if (f) await this.putFile(id, f); }
  },
  async putFile(id, f) {
    const ex = await this.api(`/contents/files/${id}`, { allow404: true });
    if (!ex) await this.api(`/contents/files/${id}`, { method: "PUT", body: JSON.stringify({ message: `File ${f.name || id}`, content: (await blobToDataUrl(f.blob)).split(",")[1] }) });
    this.sentFiles.add(id); this.saveState();
  },
  /* settings (with the message templates) as they were at an earlier commit, saved again as a new change */
  restoreSettings(sha) {
    return this.queue(async () => {
      const f = await this.readFile("settings", sha); if (!f.data || !f.data.value) throw new Error("This version has no settings");
      loadSettings({ ...f.data.value }); await Store.meta("settings", S.settings); applyTheme(); await loadImages();
      await this.pushNow(`Restored the settings of ${fmtDateTime((await this.api(`/commits/${sha}`)).commit.author.date)}`); refreshSafe();
    });
  },
  async history() { return (await this.api(`/commits?per_page=50`)).map(c => ({ sha: c.sha, at: new Date(c.commit.author.date).getTime(), msg: c.commit.message })); },
  /* bring back the data as it was at an earlier commit; saved as a new change, so nothing is lost */
  async restore(sha) {
    return this.queue(async () => {
      const now = Date.now();
      for (const n of COLLS) {
        const f = await this.readFile(n, sha), old = f.data ? f.data.records || [] : [], keep = new Set(old.map(r => r.id));
        this.applying = true;
        try {
          await Store._putMany(n, old.map(r => ({ ...r, updatedAt: now })));
          for (const r of S[n].filter(r => !keep.has(r.id))) { (this.tomb[n] = this.tomb[n] || {})[r.id] = now; await Store._del(n, r.id); }
          Object.keys(this.tomb[n] || {}).forEach(id => { if (keep.has(id)) delete this.tomb[n][id]; });
        } finally { this.applying = false; }
        this.dirty.add(n);
      }
      await Store._meta("tomb", this.tomb);
      await this.pushNow(`Restored the version of ${fmtDateTime((await this.api(`/commits/${sha}`)).commit.author.date)}`);
      refreshSafe();
    });
  }
};
function mergeColl(localArr, remote, localTomb) {
  const deleted = { ...(remote.deleted || {}) };
  Object.entries(localTomb).forEach(([id, t]) => { if (!deleted[id] || t > deleted[id]) deleted[id] = t; });
  const by = new Map();
  (remote.records || []).forEach(r => by.set(r.id, r));
  localArr.forEach(r => { const x = by.get(r.id); if (!x || (r.updatedAt || 0) > (x.updatedAt || 0)) by.set(r.id, r); });
  const records = [...by.values()].filter(r => !(deleted[r.id] && deleted[r.id] >= (r.updatedAt || 0)));
  records.forEach(r => { if (deleted[r.id]) delete deleted[r.id]; });
  return { records, deleted };
}
function commitMessage(since) {
  const L = S.audit.filter(l => l.at > since).map(l => l.text);
  if (!L.length) return `Update from ${deviceName()}`;
  return L.length === 1 ? L[0] : `${L[L.length - 1]} (+${L.length - 1} more)\n\n${L.slice(-30).map(t => "- " + t).join("\n")}`;
}
const deviceName = () => /Android|iPhone|iPad/i.test(navigator.userAgent) ? "phone" : "computer";
const clean = v => JSON.parse(JSON.stringify(v ?? null));
function b64enc(str) { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64dec(b64) { const s = atob(b64.replace(/\s/g, "")), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new TextDecoder().decode(b); }
function mergeAudit(a, b) { const seen = new Set(), out = []; [...a, ...b].sort((x, y) => x.at - y.at).forEach(l => { const k = l.at + "|" + l.text; if (!seen.has(k)) { seen.add(k); out.push(l); } }); return out.slice(-1500); }
async function metaGet(id) { if (!Store.db) return lsGet("mb9_" + id); return new Promise(res => { const q = Store.db.transaction("meta").objectStore("meta").get(id); q.onsuccess = () => res(q.result ? q.result.value : null); q.onerror = () => res(null); }); }
function refreshSafe() { clearTimeout(refreshSafe.t); refreshSafe.t = setTimeout(() => { const typing = document.activeElement?.matches?.("#main input, #main textarea") || $(".wa-box.editing");
    if (typing) refreshSafe.pending = true; else if (!["new", "past", "edit", "ai"].includes(ROUTE.name) && $("#sheet").hidden) refresh(); else updateStoreInfo(); }, 150); }

/* every local write marks its file for the next push; the originals stay available for applying remote changes */
function wrapStoreForCloud() {
  if (Store._put) return;
  Object.assign(Store, { _put: Store.put, _putMany: Store.putMany, _del: Store.del, _clear: Store.clear, _meta: Store.meta, _saveFile: Store.saveFile, _getFile: Store.getFile });
  const mark = n => { if (!Cloud.applying) Cloud.touch(n); };
  const bury = (c, ids) => { const t = Cloud.tomb[c] = Cloud.tomb[c] || {}; ids.forEach(id => t[id] = Date.now()); Store._meta("tomb", Cloud.tomb); };
  Store.put = async function (c, r) { const out = await Store._put.call(Store, c, r); mark(c); return out; };
  Store.putMany = async function (c, rs) { await Store._putMany.call(Store, c, rs); if (rs.length) mark(c); };
  Store.del = async function (c, id) { await Store._del.call(Store, c, id); if (!Cloud.applying) { bury(c, [id]); mark(c); } };
  Store.clear = async function (c) { const ids = S[c].map(x => x.id); await Store._clear.call(Store, c); if (!Cloud.applying) { bury(c, ids); mark(c); } };
  Store.meta = async function (id, value) {
    if (id === "settings" && !Cloud.applying) { value = { ...value, savedAt: Date.now() }; S.settings.savedAt = value.savedAt; }
    await Store._meta.call(Store, id, value);
    if (id === "settings" || id === "audit") mark(id);
  };
  Store.saveFile = async function (blob, name) { const id = await Store._saveFile.call(Store, blob, name); Cloud.queue(() => Cloud.putFile(id, { blob, name })); return id; };
  Store.getFile = async function (id) {
    const f = await Store._getFile.call(Store, id); if (f || !id) return f;
    const meta = await Cloud.api(`/contents/files/${id}`, { allow404: true }).catch(() => null); if (!meta) return null;
    const r = await fetch(`${Cloud.base()}/contents/files/${id}`, { headers: { Authorization: `Bearer ${Cloud.cfg.token}`, Accept: "application/vnd.github.raw" } });
    const blob = await r.blob();
    if (Store.db) await Store.tx("files", "readwrite", st => st.put({ id, blob, name: id, type: blob.type, at: Date.now() }));
    Cloud.sentFiles.add(id); return { id, blob, name: id, type: blob.type };
  };
}

/* ---------- Settings panel ---------- */
function cloudPanel() {
  const st = Cloud.state, c = Cloud.cfg, pending = Cloud.dirty.size;
  const line = !c ? "Not connected. Data lives only in this browser." : st === "error" ? `Problem: ${esc(Cloud.error)}` : st === "syncing" ? "Syncing…" : pending ? `Saving ${plural(pending, "file")}…` : `Connected to github.com/${esc(c.owner)}/${esc(c.repo)}. Every change is saved as a version.`;
  const email = c && c.mode === "email";
  return panel("Cloud Database (GitHub)", `<p class="hint"><b class="${c && st === "live" ? "ok-t" : st === "error" ? "over" : ""}">${line}</b>${c && Cloud.lastSync ? ` Last checked ${ago(Cloud.lastSync)} ago.` : ""}</p>
    <p class="hint">Data is saved to a private GitHub repository a few seconds after each change. Each save is a commit, so the full history is kept and any earlier version can be restored. The device copy keeps working offline.</p>
    ${email ? `<p class="hint">Signed in as <b>${esc(c.email)}</b> until ${fmtDateTime(c.exp)} (renewed each day the app is used). The GitHub token is kept on the sign-in server, not in this browser.</p>` : ""}
    <div class="row btns">${c ? `<button class="btn" data-cl="sync" type="button">Sync Now</button><button class="btn" data-cl="hist" type="button">Version History</button>` : ""}${email ? `<button class="btn danger" data-cl="out" type="button">Sign Out</button>` : `<button class="btn${c ? "" : " primary"}" data-cl="cfg" type="button">${c ? "Change Connection" : "Connect GitHub"}</button>`}</div>`);
}
function cloudCfgSheet() {
  const c = Cloud.cfg || {};
  openSheet("Connect GitHub", `<div class="fg">
    ${field("GitHub Username", `<input id="gh-owner" value="${esc(c.owner || "")}" autocomplete="off" autocapitalize="off">`)}
    ${field("Private Repository", `<input id="gh-repo" value="${esc(c.repo || "mindbyte-data")}" autocomplete="off" autocapitalize="off">`)}
    ${field("Access Token", `<input id="gh-token" type="password" value="${esc(c.token || "")}" autocomplete="off" placeholder="github_pat_…">`, "full")}</div>
    <p class="hint">Use a fine-grained token limited to this one repository with <b>Contents: Read and write</b>. It is stored only in this browser. Enter it once on each device.</p>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Test and Connect</button>${Cloud.cfg ? `<button class="btn danger" data-a="rm" type="button">Disconnect This Browser</button>` : `<button class="btn" data-close type="button">Cancel</button>`}</div>`, async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "rm") { ["mb_gh_cfg", "mb_gh_shas", "mb_gh_head", "mb_gh_files", "mb_gh_pushed"].forEach(k => localStorage.removeItem(k)); location.reload(); return; }
    const cfg = { owner: $("#gh-owner").value.trim(), repo: $("#gh-repo").value.trim(), token: $("#gh-token").value.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return toast("Username, repository and token are required");
    e.target.disabled = true; e.target.textContent = "Testing…";
    try {
      const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" } });
      const j = await r.json(); if (!r.ok) throw new Error(r.status === 404 ? "Repository not found, or the token cannot see it" : j.message);
      if (!j.private) throw new Error("This repository is public. Use a private repository for your data.");
      if (j.permissions && !j.permissions.push) throw new Error("The token cannot write to this repository");
      lsSet("mb_gh_cfg", { ...cfg, branch: j.default_branch || "main" }); location.reload();
    } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = "Test and Connect"; }
  });
}
async function historySheet() {
  openSheet("Version History", `<p class="hint">Loading…</p>`, null, { wide: true });
  try {
    const L = await Cloud.history();
    $("#sheet .sb").innerHTML = `<p class="hint">Every save is a version. Restoring brings the orders, customers, prices, expenses and workers back to how they were at that moment; the restore is saved as a new version, so it can be undone the same way.</p>
      <ul class="feed log">${L.map(c => `<li><span class="ft"><b>${esc(c.msg.split("\n")[0])}</b><br><span class="sub">${fmtDateTime(c.at)}</span></span><span class="row"><button class="btn sm" data-v="${c.sha}" type="button">Restore Data</button><button class="btn sm" data-vs="${c.sha}" type="button">Restore Settings</button></span></li>`).join("") || `<li class="empty">No versions yet.</li>`}</ul>`;
    sheetH = async e => {
      const vs = e.target.closest("[data-vs]");
      if (vs) { if (await confirmSheet("Restore settings", "Bring the settings back to this version: business details, document numbers, revision terms, lists and WhatsApp message templates? The current settings stay in the history.", "Restore Settings")) { toast("Restoring…"); await Cloud.restoreSettings(vs.dataset.vs); toast(Cloud.state === "error" ? Cloud.error : "Settings restored"); } return; }
      const b = e.target.closest("[data-v]"); if (!b) return;
      if (await confirmSheet("Restore version", "Bring all records back to this version? Your current data stays in the history and can be restored again.", "Restore")) { toast("Restoring…"); await Cloud.restore(b.dataset.v); toast(Cloud.state === "error" ? Cloud.error : "Version restored"); } };
  } catch (e) { $("#sheet .sb").innerHTML = `<p class="hint over">${esc(e.message)}</p>`; }
}
async function cloudAction(a, el) {
  if (/^(pk|bk|sec)-/.test(a)) return securityAction(a, el);
  if (/^nt-/.test(a)) return pushAction(a, el);
  if (a === "cfg") return cloudCfgSheet();
  if (a === "hist") return historySheet();
  if (a === "out") { if (await confirmSheet("Sign out", "Sign out on this device? Changes not yet saved to the cloud stay on this device and are sent after the next sign-in.", "Sign Out")) Auth.signOut(); return; }
  if (a === "sync") { await Cloud.sync(); toast(Cloud.state === "error" ? Cloud.error : "Synced with GitHub"); refresh(); }
}

/* ---------- sign-in with an emailed code (the Cloudflare Worker in worker/) ----------
   With AUTH_URL set, the app opens only after signing in and reaches the cloud database through the worker,
   which holds the GitHub token; the browser keeps only a 30-day session. Empty AUTH_URL: no sign-in, direct token as before. */
const AUTH_URL = "https://mindbyte-auth.mindbyte.workers.dev";
const Auth = {
  session() { const c = lsGet("mb_gh_cfg"); return c && c.mode === "email" && c.exp > Date.now() ? c : null; },
  async post(path, body, token) {
    const r = await fetch(AUTH_URL + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || `Sign-in server error ${r.status}`); e.status = r.status; throw e; }
    return j;
  },
  keep(s) {
    lsSet("mb_gh_cfg", { mode: "email", api: AUTH_URL + "/gh", owner: s.owner, repo: s.repo, branch: s.branch, token: s.token, exp: s.exp, email: s.email });
    lsSet("mb_auth_email", s.email);
    if (Cloud.cfg) Cloud.cfg = lsGet("mb_gh_cfg");
  },
  /* resolves once this device holds a valid session */
  gate() {
    if (!AUTH_URL || this.session()) return Promise.resolve();
    return new Promise(done => this.show(done));
  },
  /* the worker refused the session mid-use: sign in again, then start over with the new session */
  expired() { if (AUTH_URL && !$("#gate")) { localStorage.removeItem("mb_gh_cfg"); this.show(() => location.reload()); } },
  /* a session issued more than a day ago is swapped for a fresh one, so a device in regular use never runs out */
  async renew() {
    const c = this.session(); if (!c || !navigator.onLine || c.exp - Date.now() > 29 * 864e5) return;
    try { this.keep(await this.post("/auth/refresh", {}, c.token)); } catch (e) { if (e.status === 401) this.expired(); }
  },
  signOut() { localStorage.removeItem("mb_gh_cfg"); location.reload(); },
  /* passkeys work only in the online app (https); the file opened from this computer signs in by email or backup code */
  canPasskey: () => !!window.PublicKeyCredential && location.protocol === "https:",
  async passkeyLogin() {
    const o = await this.post("/auth/passkey/options/login");
    const cred = await navigator.credentials.get({ publicKey: { challenge: new TextEncoder().encode(o.challenge), rpId: o.rpId, userVerification: "required", timeout: 60000 } });
    const r = cred.response;
    return this.post("/auth/passkey/login", { id: cred.id, clientDataJSON: bufB64u(r.clientDataJSON), authenticatorData: bufB64u(r.authenticatorData), signature: bufB64u(r.signature) });
  },
  async passkeyAdd(name) {
    const c = this.session(), o = await this.post("/auth/passkey/options/reg", {}, c.token);
    const cred = await navigator.credentials.create({ publicKey: { challenge: new TextEncoder().encode(o.challenge), rp: { id: o.rpId, name: o.rpName },
      user: { id: b64uBuf(o.userId), name: o.userName, displayName: "MINDBYTE" }, pubKeyCredParams: [-7, -8, -257].map(alg => ({ type: "public-key", alg })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" }, excludeCredentials: o.exclude.map(id => ({ type: "public-key", id: b64uBuf(id) })), attestation: "none", timeout: 60000 } });
    const r = cred.response;
    if (!r.getPublicKey) throw new Error("This browser cannot save a passkey for MINDBYTE. Update it, or use Chrome, Edge or Safari.");
    await this.post("/auth/passkey/register", { id: cred.id, clientDataJSON: bufB64u(r.clientDataJSON), publicKey: bufB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), name }, c.token);
  },
  /* sign-in methods shown in Settings; fetched at most once a minute */
  sec: null, secBusy: false,
  async loadSecurity(force) {
    const c = this.session(); if (!c || this.secBusy || (!force && this.sec && Date.now() - this.sec.got < 60000)) return;
    this.secBusy = true;
    try { this.sec = { ...(await this.post("/auth/security", {}, c.token)), got: Date.now() }; } catch (e) { this.sec = { error: e.message, got: Date.now() }; if (e.status === 401) this.expired(); }
    this.secBusy = false;
    const box = $("#secBox"); if (box) box.innerHTML = securityBody();
  },
  show(done) {
    const pk = this.canPasskey();
    document.body.insertAdjacentHTML("beforeend", `<div class="gate" id="gate"><form class="gate-card" novalidate>
      <img src="aset/app/icon-192.png" alt="" width="48" height="48">
      <h1>MINDBYTE Order System</h1>
      <p class="hint" data-g="intro"></p>
      <label data-g="emailbox"><span>Email</span><input id="g-email" type="email" autocomplete="email" autocapitalize="off" value="${esc(lsGet("mb_auth_email") || "")}"></label>
      <label data-g="codebox"><span>6-digit code</span><input id="g-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"></label>
      <label data-g="backbox"><span>Backup code</span><input id="g-back" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="XXXX-XXXX"></label>
      <button class="btn primary" type="submit" data-g="go"></button>
      <button class="btn link" type="button" data-g="again">Send a new code</button>
      <p class="hint over" data-g="msg" role="alert"></p>
      <div class="gate-alt">
        ${pk ? `<button class="btn" type="button" data-g="pk">Sign in with a passkey</button>` : ""}
        <button class="btn link" type="button" data-g="useback">Use a backup code</button>
        <button class="btn link" type="button" data-g="useemail">Sign in with an email code</button>
      </div>
    </form></div>`);
    const g = $("#gate"), f = g.querySelector("form"), q = k => g.querySelector(`[data-g="${k}"]`);
    const INTRO = { email: "Sign in with a code sent to your email.", code: "Enter the code from the email. It works for 10 minutes. Check the Spam folder if it does not arrive within a minute.", backup: "Enter one of your backup codes. Each code works once." };
    let step;
    const say = m => q("msg").textContent = m || "";
    const go = s => {
      step = s; say("");
      q("intro").textContent = INTRO[s];
      q("emailbox").hidden = s === "backup"; q("codebox").hidden = s !== "code"; q("backbox").hidden = s !== "backup"; q("again").hidden = s !== "code";
      q("useback").hidden = s === "backup"; q("useemail").hidden = s !== "backup";
      q("go").textContent = s === "email" ? "Send Code" : "Sign In";
      const fi = { email: "#g-email", code: "#g-code", backup: "#g-back" }[s]; if (s !== "email") $(fi).value = ""; setTimeout(() => $(fi).focus(), 50);
    };
    const busy = (on, label) => { g.querySelectorAll("button").forEach(b => b.disabled = on); if (label) q("go").textContent = label; };
    const finish = s => { this.keep(s); g.remove(); done(); if (s.backupLeft !== undefined) setTimeout(() => toast(`Signed in with a backup code. ${plural(s.backupLeft, "code")} left.`), 800); };
    const net = e => navigator.onLine ? e.message : "No internet connection. Connect and try again.";
    const sendCode = async () => {
      const email = $("#g-email").value.trim(); if (!email) return say("Enter your email address");
      say(""); busy(true, "Sending…");
      try { await this.post("/auth/send", { email }); lsSet("mb_auth_email", email); busy(false); go("code"); }
      catch (e) { busy(false, step === "code" ? "Sign In" : "Send Code"); say(net(e)); }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      if (step === "email") return sendCode();
      const backup = step === "backup", v = backup ? $("#g-back").value.trim() : $("#g-code").value.replace(/\D/g, "");
      if (!backup && v.length !== 6) return say("The code has 6 digits");
      if (backup && v.replace(/[^a-z0-9]/gi, "").length !== 8) return say("A backup code has 8 letters and numbers, like ABCD-EF23");
      say(""); busy(true, "Checking…");
      try { finish(await this.post(backup ? "/auth/backup" : "/auth/verify", backup ? { code: v } : { email: $("#g-email").value.trim(), code: v })); }
      catch (err) { busy(false, "Sign In"); say(net(err)); }
    };
    q("again").onclick = sendCode;
    q("useback").onclick = () => go("backup");
    q("useemail").onclick = () => go("email");
    if (pk) q("pk").onclick = async () => {
      say(""); busy(true);
      try { finish(await this.passkeyLogin()); }
      catch (e) { busy(false, step === "email" ? "Send Code" : "Sign In"); say(e.name === "NotAllowedError" ? "The passkey was cancelled or not found on this device. Try again, or use an email code." : net(e)); }
    };
    $("#g-email").oninput = () => { if (step === "code") go("email"); };
    go("email");
  }
};
const bufB64u = b => { let s = ""; new Uint8Array(b).forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const b64uBuf = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

/* ---------- Settings: sign-in methods (email code, passkeys, backup codes) ---------- */
function securityPanel() {
  if (!AUTH_URL || !Auth.session()) return "";
  Auth.loadSecurity();
  return panel("Sign-in Methods", `<div id="secBox">${securityBody()}</div>`);
}
function securityBody() {
  const c = Auth.session(), x = Auth.sec;
  if (!c) return "";
  if (!x) return `<p class="hint">Loading…</p>`;
  if (x.error) return `<p class="hint over">${esc(x.error)}</p><div class="row btns"><button class="btn" data-cl="sec-reload" type="button">Try Again</button></div>`;
  return `<p class="hint"><b>Email code</b> is always available: codes go to <b>${esc(c.email)}</b>.</p>
    <h3 class="sec-h">Passkeys</h3>
    <p class="hint">Sign in with the fingerprint, face or screen lock of a device instead of waiting for an email. Add one on each phone or computer you use.</p>
    ${x.passkeys.length ? `<ul class="feed">${x.passkeys.map(k => `<li><span class="ft"><b>${esc(k.name)}</b><br><span class="sub">Added ${fmtDate(k.at)} · ${k.used ? `last used ${fmtDateTime(k.used)}` : "not used yet"}</span></span><button class="btn sm danger" data-cl="pk-rm" data-id="${esc(k.id)}" type="button">Remove</button></li>`).join("")}</ul>` : `<p class="hint">No passkeys yet.</p>`}
    ${Auth.canPasskey() ? `<div class="row btns"><button class="btn primary" data-cl="pk-add" type="button">Add a Passkey on This Device</button></div>` : `<p class="hint">Passkeys can be added in the online app: <a href="https://bintanng99.github.io/mindbyte-erp/">bintanng99.github.io/mindbyte-erp</a>.</p>`}
    <h3 class="sec-h">Backup codes</h3>
    <p class="hint">For when email and passkeys are not available. Each code works once. ${x.backupAt ? `<b>${x.backupLeft} of 10 left</b> (created ${fmtDate(x.backupAt)}).` : "<b>None created yet.</b>"}</p>
    <div class="row btns"><button class="btn${x.backupAt ? "" : " primary"}" data-cl="bk-new" type="button">${x.backupAt ? "Create New Backup Codes" : "Create Backup Codes"}</button></div>`;
}
async function securityAction(a, el) {
  const c = Auth.session(); if (!c) return Auth.expired();
  try {
    if (a === "sec-reload") return Auth.loadSecurity(true);
    if (a === "pk-add") {
      const ua = navigator.userAgent, name = /Android/i.test(ua) ? "Android phone" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows computer" : "This device";
      el.disabled = true; await Auth.passkeyAdd(name); toast("Passkey added. Next time choose “Sign in with a passkey”."); return Auth.loadSecurity(true);
    }
    if (a === "pk-rm") {
      const k = Auth.sec.passkeys.find(p => p.id === el.dataset.id);
      if (!await confirmSheet("Remove passkey", `Remove the passkey “${esc(k ? k.name : "")}”? It stops working at once. Also delete it from the device's password manager.`, "Remove", true)) return;
      await Auth.post("/auth/passkey/remove", { id: el.dataset.id }, c.token); toast("Passkey removed"); return Auth.loadSecurity(true);
    }
    if (a === "bk-new") {
      if (Auth.sec.backupAt && !await confirmSheet("New backup codes", "Create 10 new backup codes? The old codes stop working at once.", "Create")) return;
      const { codes } = await Auth.post("/auth/backup/new", {}, c.token), text = codes.join("\n");
      openSheet("Backup Codes", `<p class="lead">Save these codes somewhere safe outside this app, for example printed on paper or in a password manager. <b>They are shown only once.</b></p>
        <pre class="bk-codes">${text}</pre>
        <p class="hint">Each code works once. On the sign-in screen choose “Use a backup code”.</p>
        <div class="row btns"><button class="btn primary" data-a="dl" type="button">${ic("dl")}Download .txt</button><button class="btn" data-a="cp" type="button">Copy</button><button class="btn" data-close type="button">Done</button></div>`,
        e => { const b = e.target.closest("[data-a]")?.dataset.a;
          if (b === "dl") download("MINDBYTE backup codes.txt", new Blob([`MINDBYTE Order System backup codes (${fmtDate(Date.now())})\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
          if (b === "cp") copyText(text, "Codes copied"); });
      return Auth.loadSecurity(true);
    }
  } catch (e) { if (el) el.disabled = false; toast(e.name === "NotAllowedError" ? "Cancelled" : e.name === "InvalidStateError" ? "This device already has a MINDBYTE passkey" : e.message); }
}

/* a redraw held back while typing happens as soon as the field is left */
document.addEventListener("focusout", () => setTimeout(() => { if (refreshSafe.pending && !document.activeElement?.matches?.("#main input, #main textarea") && !$(".wa-box.editing")) { refreshSafe.pending = false; refreshSafe(); } }, 300));

/* ---------- Settings: phone notifications (sent by the worker, see worker/src/push.js) ---------- */
const Push = {
  st: null, mine: null, busy: false,
  can: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:",
  ios: () => /iPhone|iPad/i.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches,
  async load(force) {
    const c = Auth.session(); if (!c || this.busy || (!force && this.st && Date.now() - this.st.got < 60000)) return;
    this.busy = true;
    try { this.st = { ...(await Auth.post("/push/status", {}, c.token)), got: Date.now() }; if (this.can()) { const reg = await navigator.serviceWorker.ready; this.mine = (await reg.pushManager.getSubscription())?.endpoint || null; } }
    catch (e) { this.st = { error: e.message, got: Date.now() }; }
    this.busy = false; const box = $("#pushBox"); if (box) box.innerHTML = pushBody();
  }
};
function pushPanel() { if (!AUTH_URL || !Auth.session()) return ""; Push.load(); return panel("Phone Notifications", `<div id="pushBox">${pushBody()}</div>`); }
function pushBody() {
  const x = Push.st; if (!x) return `<p class="hint">Loading…</p>`;
  if (x.error) return `<p class="hint over">${esc(x.error)}</p><div class="row btns"><button class="btn" data-cl="nt-reload" type="button">Try Again</button></div>`;
  const p = x.prefs, on = { ...p.on }, here = x.devices.some(d => d.endpoint === Push.mine);
  const row = (k, label, hrs) => `<label class="nt-row"><input type="checkbox" data-nt="${k}" ${on[k] ? "checked" : ""}><span>${label}</span>${hrs ? `<input class="nt-h" data-nth="${hrs}" inputmode="numeric" maxlength="3" value="${p[hrs]}"><small>hours</small>` : ""}</label>`;
  const blocked = !Push.can() ? `<p class="hint over">This browser cannot receive notifications here. Use the online app in Chrome, Edge or Safari.</p>`
    : Push.ios() ? `<p class="hint over">On iPhone, first add the app to the Home Screen (Share, then Add to Home Screen), open it from there, then turn notifications on.</p>` : "";
  return `<p class="hint">Alerts arrive on the phone even when the app is closed. The server checks every 15 minutes and sends each alert once.</p>
    ${blocked}
    <div class="row btns">${here ? `<button class="btn" data-cl="nt-off" type="button">Turn Off on This Device</button>` : `<button class="btn primary" data-cl="nt-on" type="button" ${blocked ? "disabled" : ""}>Turn On for This Device</button>`}<button class="btn" data-cl="nt-test" type="button" ${x.devices.length ? "" : "disabled"}>Send a Test</button></div>
    ${x.devices.length ? `<ul class="feed">${x.devices.map(d => `<li><span class="ft"><b>${esc(d.name)}</b>${d.endpoint === Push.mine ? " (this device)" : ""}<br><span class="sub">Since ${fmtDate(d.at)}</span></span></li>`).join("")}</ul>` : `<p class="hint">No device receives alerts yet.</p>`}
    <h3 class="sec-h">Alerts</h3>
    <div class="nt-list">${row("due", "Due date coming up, within", "dueHours")}${row("overdue", "Due date passed")}${row("dp", "Down payment not received after", "dpHours")}${row("final", "Final payment not received after", "finalHours")}${row("close", "Revision period over, ready to close")}</div>
    <div class="row btns"><button class="btn" data-cl="nt-save" type="button">Save Alerts</button></div>`;
}
async function pushAction(a, el) {
  const c = Auth.session(); if (!c) return Auth.expired();
  try {
    if (a === "nt-reload") return Push.load(true);
    if (a === "nt-on") {
      el.disabled = true;
      if (await Notification.requestPermission() !== "granted") throw new Error("Notifications are blocked for this app. Allow them in the browser or phone settings, then try again.");
      const { key } = await Auth.post("/push/key"); if (!key) throw new Error("Notifications are not set up on the server yet");
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBuf(key) });
      const ua = navigator.userAgent, name = /Android/i.test(ua) ? "Android phone" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows computer" : "This device";
      await Auth.post("/push/subscribe", { subscription: sub.toJSON(), name }, c.token); toast("Notifications are on for this device"); return Push.load(true);
    }
    if (a === "nt-off") { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await Auth.post("/push/unsubscribe", { endpoint: sub.endpoint }, c.token); await sub.unsubscribe(); } toast("Notifications are off for this device"); return Push.load(true); }
    if (a === "nt-test") { const r = await Auth.post("/push/test", {}, c.token); return toast(r.sent ? `Test sent to ${plural(r.sent, "device")}` : "No device could be reached. Turn notifications on again on the phone."); }
    if (a === "nt-save") {
      const on = {}; $$("#pushBox [data-nt]").forEach(x => on[x.dataset.nt] = x.checked);
      const prefs = { on }; $$("#pushBox [data-nth]").forEach(x => prefs[x.dataset.nth] = Math.max(1, Math.min(720, toNum(x.value) || 24)));
      await Auth.post("/push/prefs", { prefs }, c.token); toast("Alerts saved"); return Push.load(true);
    }
  } catch (e) { if (el) el.disabled = false; toast(e.message || String(e)); }
}
