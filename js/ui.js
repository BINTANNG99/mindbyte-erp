/* MINDBYTE Order System: shell, routing, shared UI pieces and charts. */
"use strict";

/* ---------- icons ---------- */
const ICONS = {
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h.01M12 19h.01"/>',
  rep: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/>',
  set: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chk: '<path d="M5 12l5 5L20 7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  wa: '<path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  dl: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  board: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
  worker: '<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M9 14l3 3 3-3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
};
const ic = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* ---------- navigation model ---------- */
const NAV = [
  ["Sales", [["dashboard", "dash", "Dashboard"], ["pipeline", "board", "Pipeline"], ["orders", "list", "Orders"], ["calendar", "cal", "Calendar"], ["customers", "users", "Customers"]]],
  ["Operations", [["workers", "worker", "Workers"]]],
  ["Pricing", [["prices", "tag", "Price List"], ["estimate", "calc", "Price Estimate"]]],
  ["Finance", [["receivables", "inbox", "Receivables"], ["cashbook", "book", "Cash Book"], ["expenses", "wallet", "Expenses"], ["pnl", "rep", "Profit & Loss"], ["reports", "doc", "Monthly Report"], ["insights", "chart", "Insights"]]],
  ["System", [["ai", "spark", "AI Assistant"], ["activity", "clock", "Activity Log"], ["settings", "set", "Settings"]]]
];
const BNAV = [["dashboard", "dash", "Home"], ["pipeline", "board", "Pipeline"], ["new", "plus", "New"], ["orders", "list", "Orders"]];
const PAGES = {};      /* route name -> { title, crumb, nav, render(args) } */
let ROUTE = { name: "dashboard", args: [] };

function parseHash() { const p = (location.hash || "#/dashboard").replace(/^#\/?/, "").split("/").map(decodeURIComponent).filter(Boolean); return { name: p[0] || "dashboard", args: p.slice(1) }; }
function go(path) { const h = "#/" + path; if (location.hash === h) render(); else location.hash = h; }
function back(fallback) { if (history.length > 1 && document.referrer !== undefined && window.__navCount > 1) history.back(); else go(fallback); }
window.__navCount = 0;
addEventListener("hashchange", () => { window.__navCount++; closeSheet(); render(); });

function render() {
  ROUTE = parseHash();
  const p = PAGES[ROUTE.name] || PAGES.dashboard;
  const main = $("#main");
  main.onclick = null; $("#abarIn").onclick = null; CHARTS.length = 0;
  const html = p.render(...ROUTE.args);
  if (html !== undefined) main.innerHTML = html;
  /* entrance animation only when arriving at a page, not when the same page re-renders after an edit */
  if (!render.keepScroll) main.firstElementChild?.classList.add("enter");
  /* in-app Back on every sub-page: iPhone home-screen apps have no browser back button */
  if (p.parent) { const ph = $(".ph > div:first-child", main); if (ph) { const par = typeof p.parent === "function" ? p.parent(...ROUTE.args) : p.parent;
    ph.insertAdjacentHTML("afterbegin", `<button class="backbtn" type="button" data-back="${esc(par)}" aria-label="Back">${ic("left")}<span>Back</span></button>`); } }
  p.after && p.after(...ROUTE.args);
  const nav = typeof p.nav === "function" ? p.nav(...ROUTE.args) : p.nav || ROUTE.name;
  $$("[data-route]").forEach(a => a.toggleAttribute("aria-current", a.dataset.route === nav));
  const inMore = !BNAV.some(b => b[0] === nav);
  $("#bMore").toggleAttribute("aria-current", inMore);
  $("#modName").textContent = typeof p.title === "function" ? p.title(...ROUTE.args) : p.title;
  document.title = `${$("#modName").textContent} · ${S.settings.business}`;
  renderActionBar(p.bar ? p.bar(...ROUTE.args) : "");
  if (!render.keepScroll) scrollTo(0, 0); render.keepScroll = false;
  requestAnimationFrame(fitAll);
}
/* re-render the current page after data changed, keeping scroll and focus-free state */
function refresh() { render.keepScroll = true; render(); updateStoreInfo(); }

function shellHtml() {
  const side = NAV.map(([sec, items]) => `<div class="sec">${sec}</div>` + items.map(([r, i, l]) => `<a href="#/${r}" data-route="${r}">${ic(i)}${l}</a>`).join("")).join("");
  return `
  <header class="appbar"><div class="in">
    <a href="#/dashboard" class="brand"><img src="aset/ikon-nota.jpg" alt=""><span class="name" id="bizName">MINDBYTE</span></a>
    <span class="mod" id="modName"></span>
    <button class="appbtn" id="qsBtn" type="button" title="Search (Ctrl+K)" aria-label="Search">${ic("search")}<span class="qs-k">Search</span></button>
    <button class="appbtn" id="installBtn" type="button" hidden title="Install as an app on this device">${ic("dl")}<span class="qs-k">Install App</span></button>
    <button class="appbtn" id="themeBtn" type="button" title="Switch theme" aria-label="Switch theme">${ic("moon")}</button>
    <span class="sync" id="storeInfo"></span>
  </div></header>
  <div class="shell">
    <nav class="side" aria-label="Menu"><a href="#/new" class="btn primary side-new">${ic("plus")}New Order</a>${side}</nav>
    <main id="main"></main>
  </div>
  <nav class="bnav" aria-label="Menu">${BNAV.map(([r, i, l]) => `<a href="#/${r}" data-route="${r}">${ic(i)}${l}</a>`).join("")}<a id="bMore" href="#" role="button">${ic("more")}More</a></nav>
  <div class="abar" id="abar" hidden><div class="in" id="abarIn"></div></div>
  <div class="toast" id="toast" hidden></div>
  <div class="sheet" id="sheet" hidden></div>
  <div class="tip" id="tip" hidden></div>
  <input type="file" id="fileIn" hidden>`;
}
function renderActionBar(html) { $("#abarIn").innerHTML = html || ""; $("#abar").hidden = !html; $(".bnav").hidden = !!html; document.body.classList.toggle("has-abar", !!html); }
function updateStoreInfo() {
  const el = $("#storeInfo"); if (!el) return;
  const days = S.settings.lastBackup ? Math.floor((Date.now() - S.settings.lastBackup) / 864e5) : null;
  /* cloud (GitHub) status wins over the device-only status */
  if (typeof Cloud !== "undefined" && Cloud.cfg) {
    const pending = Cloud.dirty.size, st = Cloud.state;
    el.textContent = !navigator.onLine ? "Offline, will sync" : st === "error" ? "Sync problem" : st === "syncing" || pending ? "Saving…" : "Saved to cloud";
    el.classList.toggle("warn", !navigator.onLine || st === "error");
    el.title = st === "error" ? Cloud.error : `github.com/${Cloud.cfg.owner}/${Cloud.cfg.repo}`;
    $("#bizName").textContent = S.settings.business || "MINDBYTE"; return;
  }
  el.textContent = Store.mode === "device" ? (days === null || days > 7 ? "Backup due" : "Saved on device") : Store.mode === "local" ? "Browser storage" : "Not saved";
  el.classList.toggle("warn", days === null || days > 7);
  el.title = days === null ? "No backup downloaded yet. Settings → Data Backup." : `Last backup ${plural(days, "day")} ago`;
  $("#bizName").textContent = S.settings.business || "MINDBYTE";
}

/* ---------- page skeleton helpers (one spacing scale, one structure for every page) ---------- */
const page = (crumb, title, sub, actions, body) => `<section class="view">
  <div class="ph"><div><div class="crumb">${esc(crumb)}</div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions ? `<div class="ph-act">${actions}</div>` : ""}</div>
  ${body}</section>`;
const panel = (title, body, opt = {}) => `<div class="panel${opt.cls ? " " + opt.cls : ""}"${opt.id ? ` id="${opt.id}"` : ""}>${title !== null ? `<div class="hd"><h2>${title}</h2>${opt.right ? `<div class="hd-r">${opt.right}</div>` : ""}</div>` : ""}${opt.flush ? body : `<div class="bd">${body}</div>`}</div>`;
const kpi = (label, value, sub, cls = "") => `<div class="kpi ${cls}"><div class="l">${label}</div><div class="v">${value}</div>${sub !== undefined ? `<div class="s">${sub}</div>` : ""}</div>`;
const badge = s => `<span class="badge b-${s}">${ST[s].short}</span>`;
const emptyRow = (cols, msg) => `<tr class="er"><td colspan="${cols}" class="empty">${msg}</td></tr>`;
const sel = (opts, v) => opts.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(val) === String(v ?? "") ? " selected" : ""}>${esc(lab)}</option>`; }).join("");
const field = (label, input, cls = "") => `<label class="${cls}"><span>${label}</span>${input}</label>`;
const money = v => v ? Number(v).toLocaleString("id-ID") : "";
/* order row used by every list (orders, dashboard, calendar, customer, reports) */
function orderCells(o, opts = {}) {
  const c = calc(o), late = isLate(o), dup = opts.dups && opts.dups.has(o.id);
  const who = clientName(o);
  return `<td class="no">${qfmt(o.queue)}</td>
    <td><div class="nm">${esc(o.project || "Untitled order")}${dup ? ` <span class="badge b-dup">Duplicate no.</span>` : ""}</div><div class="sub">${esc(who || "No customer")}${o.cat ? ` · ${esc(o.cat)}` : ""}</div><div class="nar">${badge(o.status)}${opts.due !== false && o.deadline ? ` <span class="sub${late ? " over" : ""}">${dueText(o, 1)}</span>` : ""}</div></td>`;
}

/* ---------- toast ---------- */
function toast(msg, undo) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t);
  if (undo) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Undo"; b.onclick = () => { t.hidden = true; undo(); }; t.append(b); }
  toast._t = setTimeout(() => t.hidden = true, undo ? 9000 : 2800);
}

/* ---------- sheet: menus, pickers and small forms ---------- */
let sheetH = null;
function openSheet(title, body, onClick, opt = {}) {
  const s = $("#sheet");
  s.innerHTML = `<div class="sp${opt.wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sh"><h2>${esc(title)}</h2><button class="ib" data-close type="button" aria-label="Close">${ic("x")}</button></div><div class="sb">${body}</div></div>`;
  s.hidden = false; sheetH = onClick || null; document.body.classList.add("locked");
  const f = s.querySelector("input:not([type=hidden]):not([readonly]),textarea,select"); if (f && !opt.noFocus && matchMedia("(min-width:900px)").matches) f.focus();
}
function closeSheet() { const s = $("#sheet"); if (!s || s.hidden) return; s.hidden = true; s.innerHTML = ""; sheetH = null; document.body.classList.remove("locked"); }
/* a yes/no inside the sheet; resolves true when confirmed */
function confirmSheet(title, text, yes = "Confirm", danger) {
  return new Promise(res => {
    openSheet(title, `<p class="lead">${text}</p><div class="row btns"><button class="btn ${danger ? "danger-solid" : "primary"}" data-a="yes" type="button">${esc(yes)}</button><button class="btn" data-a="no" type="button">Cancel</button></div>`,
      e => { const a = e.target.closest("[data-a]")?.dataset.a; if (a === "yes") { closeSheet(); res(true); } if (a === "no") { closeSheet(); res(false); } });
    const s = $("#sheet"); const obs = new MutationObserver(() => { if (s.hidden) { obs.disconnect(); res(false); } }); obs.observe(s, { attributes: true, attributeFilter: ["hidden"] });
  });
}
function pickFile(accept) {
  return new Promise(res => { const f = $("#fileIn"); f.value = ""; f.accept = accept || ""; f.onchange = () => res(f.files[0] || null); f.click(); });
}

/* ---------- money inputs: format on blur ---------- */
document.addEventListener("focusout", e => { if (e.target.matches("input.money")) { const n = toNum(e.target.value); e.target.value = n ? n.toLocaleString("id-ID") : ""; } });

/* ---------- download & copy ---------- */
function download(name, blob, ok = "Downloaded") {
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(ok); }
  catch (e) { toast("Downloading is not possible here"); }
}
async function copyText(text, ok = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand("copy"); toast(ok); } catch (_) { toast("Could not copy automatically"); } ta.remove(); }
}
const csvCell = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = rows => "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\n");

/* ---------- charts: single-series SVG, hairline grid, 4px rounded data-ends, hover tooltip ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
/* column chart. data: [{label, value, tip, hi}] ; opt: {fmt, axis, height, cls, maxLabels}
   Returned as a placeholder; drawCharts() draws it at the panel's real pixel width so text never stretches. */
const CHARTS = [];
function colChart(data, opt = {}) {
  CHARTS.push({ data, opt });
  return `<div class="chart ${opt.cls || ""}" data-chart="${CHARTS.length - 1}" style="height:${opt.height || 180}px"></div>`;
}
function drawCharts() {
  $$("[data-chart]").forEach(el => { const c = CHARTS[el.dataset.chart]; if (!c || !el.clientWidth) return;
    if (el._w === el.clientWidth) return; el._w = el.clientWidth; el.innerHTML = colSvg(c.data, c.opt, el.clientWidth); });
}
function colSvg(data, opt, W) {
  const H = opt.height || 180, padT = 12, padB = 24, padL = 48, n = data.length || 1;
  opt = { ...opt, maxLabels: Math.min(opt.maxLabels || 12, Math.max(3, Math.floor((W - padL) / 34))) };
  const vals = data.map(d => d.value), max = niceMax(Math.max(0, ...vals)), min = Math.min(0, ...vals), lo = min < 0 ? -niceMax(-min) : 0;
  const ih = H - padT - padB, y = v => padT + ih * (max - v) / (max - lo), band = (W - padL) / n, bw = Math.min(24, band * 0.62);
  /* count charts (opt.axis given) only get whole-number ticks */
  const ticks = [lo, lo + (max - lo) / 2, max].filter((v, i, a) => a.indexOf(v) === i && (!opt.axis || Number.isInteger(v)));
  const fmt = opt.axis || rpShort;
  const grid = ticks.map(t => `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${padL - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${esc(fmt(t))}</text>`).join("");
  const every = Math.ceil(n / (opt.maxLabels || 12));
  const bars = data.map((d, i) => {
    const x = padL + band * i + (band - bw) / 2, v = d.value, y0 = y(0), y1 = y(v), h = Math.abs(y0 - y1), top = Math.min(y0, y1), r = Math.min(4, h);
    const path = h < 0.5 ? "" : v >= 0
      ? `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${y0}Z`
      : `M${x},${y0}V${top + h - r}Q${x},${top + h} ${x + r},${top + h}H${x + bw - r}Q${x + bw},${top + h} ${x + bw},${top + h - r}V${y0}Z`;
    return `<g class="cb${d.hi ? " hi" : ""}${v < 0 ? " neg" : ""}" data-tip="${esc(d.tip || `${d.label}: ${(opt.fmt || rp)(v)}`)}"><rect x="${padL + band * i}" y="${padT}" width="${band}" height="${ih}" class="hit"/>${path ? `<path d="${path}"/>` : ""}${i % every === 0 || i === n - 1 ? `<text x="${x + bw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${esc(d.label)}</text>` : ""}</g>`;
  }).join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || "Chart")}">${grid}<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="base"/>${bars}</svg>`;
}
/* horizontal bars with labels and values in text tokens; data: [{label, value, sub, href}] */
function hBars(data, opt = {}) {
  const max = Math.max(1, ...data.map(d => d.value));
  if (!data.length) return `<p class="empty">${opt.empty || "No data yet."}</p>`;
  return `<div class="hbars">${data.map(d => `<${d.href ? `a href="${d.href}"` : "div"} class="hb" data-tip="${esc(d.tip || "")}"><div class="hb-t"><span class="hb-l">${esc(d.label)}</span><span class="hb-v">${(opt.fmt || rp)(d.value)}${d.sub ? ` <small>${esc(d.sub)}</small>` : ""}</span></div><div class="hb-track"><i style="width:${Math.max(1.5, d.value / max * 100)}%"></i></div></${d.href ? "a" : "div"}>`).join("")}</div>`;
}
/* hover tooltip for any [data-tip] mark */
document.addEventListener("pointerover", e => { const g = e.target.closest("[data-tip]"); const t = $("#tip"); if (!t) return; if (!g || !g.dataset.tip) { t.hidden = true; return; } t.textContent = g.dataset.tip; t.hidden = false; });
document.addEventListener("pointermove", e => { const t = $("#tip"); if (!t || t.hidden) return; const w = t.offsetWidth; t.style.left = Math.min(innerWidth - w - 8, Math.max(8, e.clientX - w / 2)) + "px"; t.style.top = (e.clientY - t.offsetHeight - 12) + "px"; });
document.addEventListener("pointerleave", () => { const t = $("#tip"); if (t) t.hidden = true; }, true);

/* KPI values stay on one line; a row of tiles shares one font size, shrunk only as far as the longest value needs */
function fitKpis() {
  $$(".kpis").forEach(g => { const vs = $$(".kpi .v", g); if (!vs.length || !g.offsetParent) return; vs.forEach(v => v.style.fontSize = "");
    let f = parseFloat(getComputedStyle(vs[0]).fontSize); while (f > 12 && vs.some(v => v.scrollWidth > v.clientWidth + .5)) { f -= .5; vs.forEach(v => v.style.fontSize = f + "px"); } });
}
function fitAll() { fitKpis(); drawCharts(); if (window.fitNota) fitNota(); }
addEventListener("resize", () => requestAnimationFrame(fitAll));

/* ---------- theme ---------- */
function applyTheme() { const t = S.settings.theme; if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); $("#themeBtn").innerHTML = ic(dark ? "sun" : "moon"); }

/* ---------- quick search (Ctrl+K): orders, customers, services ---------- */
function quickSearch() {
  const draw = q => {
    q = q.trim().toLowerCase(); const out = [];
    if (q) {
      S.orders.filter(o => [qfmt(o.queue), o.queue, o.project, clientName(o), o.notes, o.memo].join(" ").toLowerCase().includes(q)).sort((a, b) => toNum(b.queue) - toNum(a.queue)).slice(0, 8)
        .forEach(o => out.push(`<a href="#/order/${esc(o.id)}"><span><b>Order ${qfmt(o.queue)} · ${esc(o.project || "")}</b><small>${esc(clientName(o) || "No customer")} · ${ST[o.status].label}</small></span><span class="pr">${rp(grandTotal(o))}</span></a>`));
      S.customers.filter(c => (c.name + " " + (c.phone || "")).toLowerCase().includes(q)).slice(0, 5)
        .forEach(c => out.push(`<a href="#/customer/${esc(c.id)}"><span><b>${esc(c.name)}</b><small>Customer${c.phone ? " · " + esc(c.phone) : ""}</small></span><span class="pr">${plural(custStats(c).count, "order")}</span></a>`));
      S.prices.filter(p => [p.name, p.cat, p.group, p.code].join(" ").toLowerCase().includes(q)).slice(0, 5)
        .forEach(p => out.push(`<a href="#/prices/${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.cat)}${p.group ? " · " + esc(p.group) : ""}</small></span><span class="pr">${priceTxt(p)}</span></a>`));
    }
    $("#qsList").innerHTML = out.join("") || `<p class="empty">${q ? "Nothing found." : "Type an order number, customer name, job or service."}</p>`;
  };
  openSheet("Search", `<input id="qsQ" placeholder="Order number, customer, job, service…" autocomplete="off"><nav class="mlist pick" id="qsList"></nav>`, e => { if (e.target.closest("a")) closeSheet(); });
  $("#qsQ").oninput = e => draw(e.target.value); draw(""); $("#qsQ").focus();
}
const priceTxt = p => !p.price ? "See note" : (p.max && p.max > p.price ? `${rpShort(p.price)}–${rpShort(p.max)}` : rp(p.price)) + (p.unit ? ` / ${esc(p.unit)}` : "");

/* ---------- global wiring ---------- */
function wireShell() {
  $("#qsBtn").onclick = quickSearch;
  $("#themeBtn").onclick = async () => { const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches); await saveSettings({ theme: dark ? "light" : "dark" }); applyTheme(); };
  $("#bMore").onclick = e => { e.preventDefault(); const cur = $("[data-route][aria-current]")?.dataset.route;
    openSheet("Menu", NAV.map(([sec, items]) => `<div class="msec">${sec}</div><nav class="mlist">${items.map(([r, i, l]) => `<a href="#/${r}"${r === cur ? ' aria-current="page"' : ""}>${ic(i)}${l}</a>`).join("")}</nav>`).join(""), e => { if (e.target.closest("a")) closeSheet(); }); };
  $("#sheet").addEventListener("click", e => { if (e.target.id === "sheet" || e.target.closest("[data-close]")) { closeSheet(); return; } if (sheetH) sheetH(e); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheet();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); quickSearch(); }
  });
  document.addEventListener("click", e => { const b = e.target.closest("[data-back]"); if (!b) return;
    if (window.__navCount > 0) history.back(); else go(b.dataset.back); });
  /* rows link to their record */
  document.addEventListener("click", e => {
    const tr = e.target.closest("tr[data-href]"); if (tr && !e.target.closest("a,button,input,select")) { go(tr.dataset.href); return; }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
  /* Chrome/Edge offer installation through this event; the button appears only when installing is possible */
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); window.__install = e; $("#installBtn").hidden = false; });
  addEventListener("appinstalled", () => { window.__install = null; $("#installBtn").hidden = true; toast("Installed. Open MINDBYTE from your home screen or app list."); });
  $("#installBtn").onclick = async () => { const e = window.__install; if (!e) return; e.prompt(); await e.userChoice.catch(() => null); window.__install = null; $("#installBtn").hidden = true; };
  addEventListener("online", updateStoreInfo); addEventListener("offline", updateStoreInfo);
}
