/* MINDBYTE Order System: Excel-style column filters for every table with a header row.
   Each header gets a ▾ button: sort, search, tick the values to show, and a from–to range for numbers and dates.
   Filters combine across columns, work on what the table shows, and stay per page and table while the app is open.
   Tables redraw often (search box, sync), so filters are re-applied after every redraw. */
"use strict";

const XF = { st: {}, busy: false, all: false };   /* all: the open page draws every row (set once a menu is opened) */
const xfTables = () => $$("#main table.dt").filter(t => t.tHead && t.tBodies[0]);
const xfKey = t => `${ROUTE.name}:${xfTables().indexOf(t)}`;
const xfActive = () => XF.all || Object.keys(XF.st).some(k => k.startsWith(ROUTE.name + ":"));
const xfRows = t => [...t.tBodies[0].rows].filter(r => !r.classList.contains("xf-none") && r.cells.length > 1);
function xfText(td) { if (!td) return ""; const inp = td.querySelector("input, select, textarea"); if (inp) return inp.value.trim(); /* editable tables filter on the value in the cell */ const nm = td.querySelector(".nm, .badge"); return (nm ? nm.textContent : td.textContent).replace(/\s+/g, " ").trim(); }
/* "Rp 450.000", "3.069", "−25.000" → number; anything else → null */
function xfNum(v) { const s = v.replace(/^Rp\s*/i, "").replace("−", "-").trim(); return /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : null; }
/* "28 Oct 2026, 12:00", "31 October 2026, 09:00 WIB", "Est. 30 November 2026" → time; else null */
function xfDate(v) { if (!/\d{4}/.test(v)) return null; const t = Date.parse(v.replace(/^Est\.\s*/, "").replace(/\s*WIB$/, "").replace(/,\s*(\d\d:\d\d)/, " $1")); return isNaN(t) ? null : t; }
function xfType(vals) {
  /* only values with a digit decide; placeholders such as "not recorded" or "-" must not turn a money column into text */
  const L = vals.filter(v => /\d/.test(v)); if (!L.length) return "text";
  if (L.filter(v => xfNum(v) !== null).length >= L.length * .8) return "num";
  if (L.filter(v => xfDate(v) !== null).length >= L.length * .8) return "date";
  return "text";
}
const xfVal = (v, type) => type === "num" ? xfNum(v) : type === "date" ? xfDate(v) : null;
function xfPass(td, c) {
  const v = xfText(td);
  if (c.vals && !c.vals.includes(v)) return false;
  if (c.min != null || c.max != null) { const x = xfVal(v, c.type); if (x === null || (c.min != null && x < c.min) || (c.max != null && x > c.max)) return false; }
  return true;
}
function xfCmp(a, b, type) {
  if (type !== "text") { const x = xfVal(a, type), y = xfVal(b, type); if (x !== null && y !== null) return x - y; if (x === null) return y === null ? 0 : 1; return -1; }
  return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
}

/* add the ▾ buttons and apply the saved filter of every table on the page */
function xfRefresh() {
  if (XF.busy) return; XF.busy = true;
  try { xfTables().forEach(t => { xfHeads(t); xfApply(t); }); } finally { XF.busy = false; xfObs.takeRecords(); }
}
function xfHeads(t) {
  const f = XF.st[xfKey(t)] || { cols: {} };
  [...t.tHead.rows[0].cells].forEach((th, i) => {
    let b = th.querySelector(".xf-btn");
    if (!b && !th.textContent.trim()) return;   /* columns without a heading (buttons, handles) get no filter */
    if (!b) { th.classList.add("xf-th"); th.insertAdjacentHTML("beforeend", `<button class="xf-btn" type="button" data-xf="${i}" aria-label="Filter and sort this column" title="Filter and sort">▾</button>`); b = th.querySelector(".xf-btn"); }
    b.classList.toggle("on", !!f.cols[i] || !!(f.sort && f.sort[0] === i));
  });
}
function xfApply(t) {
  const key = xfKey(t), f = XF.st[key], body = t.tBodies[0], rows = xfRows(t), after = t.closest(".tw") || t;
  body.querySelector(".xf-none")?.remove();
  if (after.nextElementSibling?.classList.contains("xf-note")) after.nextElementSibling.remove();
  rows.forEach(r => r.hidden = false);
  if (!f) return;
  let shown = 0;
  rows.forEach(r => { r.hidden = Object.entries(f.cols).some(([i, c]) => !xfPass(r.cells[i], c)); if (!r.hidden) shown++; });
  if (f.sort) { const [i, dir, type] = f.sort; rows.sort((a, b) => xfCmp(xfText(a.cells[i]), xfText(b.cells[i]), type) * dir).forEach(r => body.append(r)); }
  if (!shown && rows.length) body.insertAdjacentHTML("beforeend", `<tr class="xf-none"><td colspan="${t.tHead.rows[0].cells.length}" class="empty">No rows match the filters.</td></tr>`);
  const n = Object.keys(f.cols).length;
  after.insertAdjacentHTML("afterend", `<div class="xf-note"><span>${n ? `Filtered by ${plural(n, "column")}` : "Sorted"} · showing ${shown} of ${plural(rows.length, "row")}</span><button class="btn link sm" type="button" data-xfclear="${esc(key)}">Clear Filters</button></div>`);
}

/* the filter menu of one column */
function xfMenu(t, i, btn) {
  xfClose();
  /* the value list must cover every row, so a page that draws only the first 100 redraws them all first */
  if (ROUTE.name === "orders" && !XF.all) { const n = xfTables().indexOf(t); XF.all = true; refresh(); return requestAnimationFrame(() => { const t2 = xfTables()[n]; if (t2) xfMenu(t2, i, t2.tHead.rows[0].cells[i].querySelector(".xf-btn") || btn); }); }
  const key = xfKey(t), f = XF.st[key] || { cols: {} }, c = f.cols[i] || {};
  /* values offered = rows that pass the other columns' filters (as in Excel) */
  const others = Object.entries(f.cols).filter(([j]) => +j !== i);
  const rows = xfRows(t).filter(r => others.every(([j, cc]) => xfPass(r.cells[j], cc)));
  const vals = rows.map(r => xfText(r.cells[i])), type = xfType(vals);
  const count = new Map(); vals.forEach(v => count.set(v, (count.get(v) || 0) + 1));
  const uniq = [...count.keys()].sort((a, b) => xfCmp(a, b, type));
  const label = t.tHead.rows[0].cells[i].textContent.replace("▾", "").replace(/[↑↓]/g, "").trim() || "Column";
  const pad = n => String(n).padStart(2, "0"), fmtR = v => { if (v == null) return ""; if (type !== "date") return String(v); const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const sortL = type === "num" ? ["Smallest → Largest", "Largest → Smallest"] : type === "date" ? ["Oldest → Newest", "Newest → Oldest"] : ["Sort A → Z", "Sort Z → A"];
  document.body.insertAdjacentHTML("beforeend", `<div class="xf-pop" id="xfPop" role="dialog" aria-label="Filter ${esc(label)}">
    <div class="xf-hd"><b>${esc(label)}</b><button class="ib" type="button" data-x="close" aria-label="Close">${ic("x")}</button></div>
    <div class="xf-sort"><button class="btn sm" type="button" data-x="asc">${sortL[0]}</button><button class="btn sm" type="button" data-x="desc">${sortL[1]}</button></div>
    ${type !== "text" ? `<div class="xf-range"><label><span>From</span><input id="xfMin" type="${type === "date" ? "date" : "text"}" inputmode="numeric" value="${fmtR(c.min)}"></label><label><span>To</span><input id="xfMax" type="${type === "date" ? "date" : "text"}" inputmode="numeric" value="${fmtR(c.max)}"></label></div>` : ""}
    <input id="xfQ" type="search" placeholder="Search values" autocomplete="off">
    <label class="xf-all"><input type="checkbox" id="xfAll"><span>(Select all)</span></label>
    <div class="xf-list" id="xfList">${uniq.map(v => `<label><input type="checkbox" value="${esc(v)}" ${!c.vals || c.vals.includes(v) ? "checked" : ""}><span>${esc(v || "(blank)")}</span><small>${count.get(v)}</small></label>`).join("") || `<p class="hint">No values.</p>`}</div>
    <div class="xf-ft"><button class="btn" type="button" data-x="clear">Clear</button><button class="btn primary" type="button" data-x="ok">Apply</button></div>
  </div>`);
  const pop = $("#xfPop"), boxes = () => [...pop.querySelectorAll("#xfList input")], seen = () => boxes().filter(x => !x.closest("label").hidden);
  const syncAll = () => { const b = seen(); $("#xfAll").checked = b.length > 0 && b.every(x => x.checked); };
  syncAll();
  /* under the header on wide screens; on phones it sits at the bottom like a sheet (CSS) */
  if (matchMedia("(min-width: 640px)").matches) { const r = btn.getBoundingClientRect(), w = pop.offsetWidth; pop.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - pop.offsetHeight - 8)) + "px"; pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px"; }
  /* typing in the search box shows only matching values, ticked, as Excel does */
  $("#xfQ").oninput = e => { const q = e.target.value.toLowerCase(); boxes().forEach(x => { const hit = x.value.toLowerCase().includes(q); x.closest("label").hidden = !hit; if (q) x.checked = hit; }); syncAll(); };
  $("#xfAll").onchange = e => seen().forEach(x => x.checked = e.target.checked);
  $("#xfList").onchange = syncAll;
  const save = nf => { if (!Object.keys(nf.cols).length && !nf.sort) delete XF.st[key]; else XF.st[key] = nf; xfClose(); xfRefresh(); xfAfterChange(); };
  pop.onclick = e => {
    const a = e.target.closest("[data-x]")?.dataset.x; if (!a) return;
    if (a === "close") return xfClose();
    const nf = { cols: { ...f.cols }, sort: f.sort };
    if (a === "asc" || a === "desc") { nf.sort = [i, a === "asc" ? 1 : -1, type]; return save(nf); }
    if (a === "clear") { delete nf.cols[i]; if (nf.sort && nf.sort[0] === i) nf.sort = null; return save(nf); }
    const all = boxes(), on = all.filter(x => x.checked).map(x => x.value), nc = { type };
    if (on.length < all.length) nc.vals = on;
    const rd = id => { const el = $(id); if (!el || !el.value.trim()) return null; return type === "date" ? Date.parse(el.value + (id === "#xfMax" ? "T23:59:59" : "T00:00")) : toNum(el.value); };
    nc.min = rd("#xfMin"); nc.max = rd("#xfMax");
    if (nc.vals || nc.min != null || nc.max != null) nf.cols[i] = nc; else delete nf.cols[i];
    save(nf);
  };
  setTimeout(() => { if (matchMedia("(min-width: 900px)").matches) $("#xfQ")?.focus(); }, 30);
}
function xfClose() { $("#xfPop")?.remove(); }
/* pages that draw only part of a long list (Orders shows 100 at a time) draw everything while a filter is on */
function xfAfterChange() { if (ROUTE.name === "orders") refresh(); }

document.addEventListener("click", e => {
  const b = e.target.closest(".xf-btn");
  if (b) { e.preventDefault(); e.stopPropagation(); return xfMenu(b.closest("table"), +b.dataset.xf, b); }
  const c = e.target.closest("[data-xfclear]");
  if (c) { e.stopPropagation(); delete XF.st[c.dataset.xfclear]; xfRefresh(); xfAfterChange(); return; }
  if (!e.target.closest("#xfPop")) xfClose();
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") xfClose(); });
addEventListener("hashchange", () => { xfClose(); XF.all = false; });
const xfObs = new MutationObserver(() => { if (!XF.busy) { cancelAnimationFrame(xfRefresh.f); xfRefresh.f = requestAnimationFrame(xfRefresh); } });
xfObs.observe(document.body, { childList: true, subtree: true });
