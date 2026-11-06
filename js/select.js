/* MINDBYTE Order System: one look for every choice.
   Every <select> gets a button and a list drawn in the app's own style. The native select stays in the page, hidden,
   holding the value and firing "change" exactly as before, so no page code changes. Every <input list="…"> gets the same
   list as suggestions while typing, instead of the browser's own datalist popup. */
"use strict";

const csLabel = sel => sel.options[sel.selectedIndex]?.textContent || "";
function csSync(sel) { const b = sel._cs; if (!b) return; b.firstChild.textContent = csLabel(sel) || "-"; b.title = csLabel(sel); b.disabled = sel.disabled; }
function csEnhance(sel) {
  if (sel.multiple || sel._cs || sel.closest(".cs-skip")) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "cs-btn " + sel.className.replace(/\bcs-native\b/g, "");
  b.setAttribute("aria-haspopup", "listbox"); b.innerHTML = "<span></span>";
  if (sel.id) b.dataset.for = sel.id;
  sel.classList.add("cs-native"); sel.tabIndex = -1; sel.after(b); sel._cs = b; b._sel = sel; csSync(sel);
}
/* code that sets .value or .selectedIndex directly keeps the button label right */
["value", "selectedIndex"].forEach(p => { const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, p);
  Object.defineProperty(HTMLSelectElement.prototype, p, { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); csSync(this); } }); });

/* ---------- the list (shared by selects and suggestion inputs) ---------- */
let CSP = null;   /* { pop, owner, kind: "sel" | "sug" } */
function csClose(focusBack) { if (!CSP) return; const o = CSP.owner; CSP.pop.remove(); o.removeAttribute?.("aria-expanded"); CSP = null; if (focusBack) o.focus(); }
function csPlace(pop, anchor) {
  if (matchMedia("(max-width: 639px)").matches && pop.classList.contains("cs-sheetable")) { pop.classList.add("cs-sheet"); return; }
  const r = anchor.getBoundingClientRect(), w = Math.max(r.width, 220); pop.style.minWidth = w + "px"; pop.style.maxWidth = Math.max(w, 360) + "px";
  const below = innerHeight - r.bottom - 12, above = r.top - 12, h = Math.min(pop.scrollHeight, 360);
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px";
  if (below >= Math.min(h, 200) || below >= above) { pop.style.top = r.bottom + 4 + "px"; pop.style.maxHeight = Math.min(360, below) + "px"; }
  else { const mh = Math.min(360, above); pop.style.maxHeight = mh + "px"; pop.style.top = Math.max(8, r.top - 4 - Math.min(h, mh)) + "px"; }
}
const csOpts = pop => [...pop.querySelectorAll(".cs-opt:not([hidden]):not([disabled])")];
function csMove(pop, dir) { const L = csOpts(pop), i = L.indexOf(document.activeElement); const n = L[i < 0 ? (dir > 0 ? 0 : L.length - 1) : Math.max(0, Math.min(L.length - 1, i + dir))]; n?.focus(); n?.scrollIntoView({ block: "nearest" }); }

function csOpen(sel) {
  csClose(); if (sel.disabled) return;
  const b = sel._cs, rows = [];
  [...sel.children].forEach(ch => { if (ch.tagName === "OPTGROUP") { rows.push(`<div class="cs-h">${esc(ch.label)}</div>`); [...ch.children].forEach(o => rows.push(o)); } else rows.push(ch); });
  const many = sel.options.length > 8;
  const pop = document.createElement("div"); pop.className = "cs-pop cs-sheetable"; pop.setAttribute("role", "listbox");
  pop.innerHTML = `${many ? `<input class="cs-q" type="search" placeholder="Search" autocomplete="off">` : ""}<div class="cs-list">${rows.map(o => typeof o === "string" ? o
    : `<button type="button" class="cs-opt${o.selected ? " on" : ""}" role="option" aria-selected="${o.selected}" data-i="${o.index}" ${o.disabled ? "disabled" : ""}><span>${esc(o.textContent)}</span>${o.selected ? ic("chk") : ""}</button>`).join("")}</div>`;
  document.body.append(pop); CSP = { pop, owner: b, kind: "sel" }; b.setAttribute("aria-expanded", "true");
  csPlace(pop, b);
  const cur = pop.querySelector(".cs-opt.on"); cur?.scrollIntoView({ block: "center" });
  const q = pop.querySelector(".cs-q");
  if (q) { q.oninput = () => { const t = q.value.toLowerCase().trim(); pop.querySelectorAll(".cs-opt").forEach(x => x.hidden = !!t && !x.textContent.toLowerCase().includes(t));
      pop.querySelectorAll(".cs-h").forEach(h => { let n = h.nextElementSibling, any = false; while (n && !n.classList.contains("cs-h")) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; }); };
    if (matchMedia("(min-width: 900px)").matches) q.focus(); else (cur || csOpts(pop)[0])?.focus({ preventScroll: true }); }
  else (cur || csOpts(pop)[0])?.focus({ preventScroll: true });
  pop.onclick = e => { const o = e.target.closest(".cs-opt"); if (o) csPick(sel, +o.dataset.i); };
  pop.onkeydown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); csMove(pop, e.key === "ArrowDown" ? 1 : -1); }
    else if (e.key === "Enter" && e.target.classList.contains("cs-q")) { e.preventDefault(); const f = csOpts(pop)[0]; if (f) csPick(sel, +f.dataset.i); }
    else if (e.key === "Escape") { e.preventDefault(); csClose(true); }
    else if (e.key === "Tab") csClose();
  };
}
function csPick(sel, i) {
  const changed = sel.selectedIndex !== i; sel.selectedIndex = i; csClose(true);
  if (changed) { sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); }
}

/* ---------- suggestions for inputs with a list ---------- */
function sugEnhance(inp) { const id = inp.getAttribute("list"); if (!id || inp.dataset.list) return; inp.dataset.list = id; inp.removeAttribute("list"); inp.setAttribute("autocomplete", "off"); }
function sugShow(inp, all) {
  const dl = document.getElementById(inp.dataset.list); if (!dl) return;
  const t = all ? "" : inp.value.toLowerCase().trim();
  const L = [...dl.options].filter(o => o.value && (!t || o.value.toLowerCase().includes(t) || o.textContent.toLowerCase().includes(t)) && o.value !== inp.value).slice(0, 60);
  if (!L.length) { if (CSP?.owner === inp) csClose(); return; }
  let pop = CSP?.owner === inp ? CSP.pop : null;
  if (!pop) { csClose(); pop = document.createElement("div"); pop.className = "cs-pop cs-sug"; pop.setAttribute("role", "listbox"); document.body.append(pop); CSP = { pop, owner: inp, kind: "sug" };
    pop.onmousedown = e => e.preventDefault();   /* keep the focus in the input */
    pop.onclick = e => { const o = e.target.closest(".cs-opt"); if (o) sugPick(inp, o.dataset.v); };
    pop.onkeydown = e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); csMove(pop, e.key === "ArrowDown" ? 1 : -1); }
      if (e.key === "Enter" && e.target.classList.contains("cs-opt")) { e.preventDefault(); sugPick(inp, e.target.dataset.v); }
      if (e.key === "Escape") { e.preventDefault(); csClose(true); } }; }
  pop.innerHTML = `<div class="cs-list">${L.map(o => `<button type="button" class="cs-opt" role="option" data-v="${esc(o.value)}" tabindex="-1"><span>${esc(o.value)}</span>${o.textContent && o.textContent !== o.value ? `<small>${esc(o.textContent)}</small>` : ""}</button>`).join("")}</div>`;
  csPlace(pop, inp);
}
function sugPick(inp, v) { inp.value = v; csClose(); inp.focus(); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }

/* ---------- wiring ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest(".cs-btn"); if (b) { e.preventDefault(); if (CSP?.owner === b) return csClose(); return csOpen(b._sel); }
  if (CSP && !e.target.closest(".cs-pop") && e.target !== CSP.owner) csClose();
});
document.addEventListener("keydown", e => {
  const b = e.target.closest?.(".cs-btn");
  if (b && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); return csOpen(b._sel); }
  const inp = e.target.matches?.("input[data-list]") ? e.target : null;
  if (inp && e.key === "ArrowDown") { e.preventDefault(); if (CSP?.owner !== inp) sugShow(inp, true); if (CSP) csMove(CSP.pop, 1); }
  if (inp && e.key === "Escape" && CSP?.owner === inp) { e.preventDefault(); csClose(); }
});
document.addEventListener("focusin", e => { if (e.target.matches?.("input[data-list]")) sugShow(e.target, true); else if (CSP?.kind === "sug" && !e.target.closest(".cs-pop")) csClose(); });
document.addEventListener("input", e => { if (e.target.matches?.("input[data-list]")) sugShow(e.target); });
document.addEventListener("focusout", e => { if (CSP?.kind === "sug" && e.target === CSP.owner) setTimeout(() => { if (CSP?.kind === "sug" && document.activeElement !== CSP.owner && !CSP.pop.contains(document.activeElement)) csClose(); }, 120); });
addEventListener("scroll", e => { if (CSP && !CSP.pop.contains(e.target)) csClose(); }, true);
addEventListener("resize", () => csClose());
addEventListener("hashchange", () => csClose());
/* new selects and list inputs are enhanced as pages draw; option changes refresh the label */
function csScan(root) { root.querySelectorAll("select").forEach(csEnhance); root.querySelectorAll("input[list]").forEach(sugEnhance); }
new MutationObserver(recs => { for (const r of recs) {
  const s = r.target.closest?.("select"); if (s) csSync(s);
  r.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.tagName === "SELECT") csEnhance(n); else if (n.tagName === "INPUT" && n.hasAttribute("list")) sugEnhance(n); else if (!n.classList?.contains("cs-pop")) csScan(n); });
} }).observe(document.documentElement, { childList: true, subtree: true });
csScan(document);
