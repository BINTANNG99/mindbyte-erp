/* MINDBYTE Order System: Customers, Price List, Price Estimate. */
"use strict";

/* ===================== CUSTOMERS ===================== */
const CU = { q: "", sort: "recent", seg: "" };
PAGES.customers = {
  title: "Customers", nav: "customers",
  render() {
    const all = S.customers.map(c => ({ c, s: custStats(c) }));
    const rep = all.filter(x => x.s.count > 1).length, paid = sum(all, x => x.s.paid), owed = sum(all, x => x.s.owed);
    const noCust = S.orders.filter(o => !o.customerId).length;
    return page("Sales", "Customers", `${plural(all.length, "customer")} · ${plural(noCust, "order")} without a customer`, `<button class="btn" data-a="csv" type="button">${ic("dl")}Export CSV</button><button class="btn primary" data-a="add" type="button">${ic("plus")}Add Customer</button>`, `
      <div class="kpis">${kpi("Customers", all.length)}${kpi("Repeat Customers", rep, all.length ? `${num(rep / all.length * 100, 0)}% of customers` : "")}${kpi("Total Paid", rp(paid))}${kpi("Unpaid", rp(owed), "", owed ? "alert" : "")}</div>
      ${panel(null, `<div class="toolbar"><input id="cuQ" type="search" placeholder="Search name, WhatsApp number, notes" value="${esc(CU.q)}">
        <select id="cuSeg">${sel([["", "All customers"], ["repeat", "Repeat customers"], ["owing", "With balance due"], ["nophone", "Without WhatsApp number"]], CU.seg)}</select>
        <select id="cuSort">${sel([["recent", "Latest order first"], ["orders", "Most orders"], ["paid", "Highest total paid"], ["name", "Name, A to Z"]], CU.sort)}</select></div>
        <div class="tw"><table class="dt"><thead><tr><th>Orders</th><th>Customer</th><th class="wide">Last Order</th><th class="r">Total Paid</th></tr></thead><tbody id="cuRows"></tbody></table></div>`, { flush: true })}`);
  },
  after() {
    const draw = () => {
      const q = CU.q.toLowerCase().trim();
      const L = S.customers.map(c => ({ c, s: custStats(c) })).filter(({ c, s }) => (!q || [c.name, c.phone, c.note].join(" ").toLowerCase().includes(q))
        && (CU.seg !== "repeat" || s.count > 1) && (CU.seg !== "owing" || s.owed > 0) && (CU.seg !== "nophone" || !c.phone))
        .sort((a, b) => CU.sort === "orders" ? b.s.count - a.s.count || b.s.last - a.s.last : CU.sort === "paid" ? b.s.paid - a.s.paid : CU.sort === "name" ? a.c.name.localeCompare(b.c.name, "id") : b.s.last - a.s.last);
      $("#cuRows").innerHTML = L.map(({ c, s }) => `<tr data-href="customer/${esc(c.id)}"><td class="no">${s.count}×</td><td><div class="nm">${esc(c.name)}${s.count > 1 ? ` <span class="badge b-ok">Repeat</span>` : ""}${s.owed ? ` <span class="badge b-menunggu_dp">Owes ${rpShort(s.owed)}</span>` : ""}</div><div class="sub">${esc(c.phone || "No WhatsApp number")}</div><div class="nar sub">Last order ${fmtShort(s.last)}</div></td><td class="wide">${fmtShort(s.last)}</td><td class="r">${rp(s.paid)}</td></tr>`).join("")
        || emptyRow(4, S.customers.length ? "No matching customers." : "No customers yet. Customers are added from the order form or with Add Customer.");
    };
    draw();
    $("#cuQ").oninput = e => { CU.q = e.target.value; draw(); };
    $("#cuSort").onchange = e => { CU.sort = e.target.value; draw(); };
    $("#cuSeg").onchange = e => { CU.seg = e.target.value; draw(); };
    $("#main").onclick = e => { const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "add") editCustomer(null);
      if (a === "csv") download(`MINDBYTE Customers ${todayISO()}.csv`, new Blob([toCsv([["Name", "WhatsApp", "Source", "Orders", "Total Billed", "Total Paid", "Balance Due", "First Order", "Last Order", "Notes"],
        ...S.customers.map(c => { const s = custStats(c); return [c.name, c.phone, c.source || "", s.count, s.billed, s.paid, s.owed, s.first ? isoDate(new Date(s.first)) : "", s.last ? isoDate(new Date(s.last)) : "", c.note || ""]; })])], { type: "text/csv" }), "CSV downloaded"); };
  }
};
PAGES.customer = {
  title: id => custById(id)?.name || "Customer", nav: "customers", parent: "customers",
  render(id) {
    const c = custById(id); if (!c) return page("Sales · Customers", "Customer not found", "", `<a class="btn" href="#/customers">Back to Customers</a>`, "");
    const s = custStats(c), L = [...s.orders].sort((a, b) => toNum(b.queue) - toNum(a.queue));
    const avg = s.count ? s.billed / s.count : 0;
    const cats = new Map(); L.forEach(o => { if (o.status !== "batal") cats.set(o.cat || "Uncategorised", (cats.get(o.cat || "Uncategorised") || 0) + grandTotal(o)); });
    return page("Sales · Customers", c.name, `Customer since ${fmtDate(s.first || c.createdAt)}`, `${c.phone ? `<a class="btn" href="${waLink(c.phone)}" target="_blank" rel="noopener">${ic("wa")}WhatsApp</a>` : ""}<button class="btn" data-a="edit" type="button">${ic("edit")}Edit</button><a class="btn primary" href="#/new/${esc(c.id)}">New Order</a>`, `
      <div class="kpis">${kpi("Orders", s.count)}${kpi("Total Paid", rp(s.paid))}${kpi("Average Order", rp(avg))}${kpi("Balance Due", rp(s.owed), "", s.owed ? "alert" : "")}</div>
      <div class="grid g-detail">
        <div class="stack">${panel("Orders", `<table class="dt"><tbody>${L.map(o => `<tr data-href="order/${esc(o.id)}">${orderCells(o)}<td class="r">${o.noAmount ? `<span class="sub">-</span>` : rp(grandTotal(o))}<div class="sub">${fmtShort(o.date)}</div></td></tr>`).join("") || emptyRow(3, "No orders yet.")}</tbody></table>`, { flush: true })}</div>
        <div class="stack">
          ${panel("Details", `<dl class="kv"><dt>Name</dt><dd>${esc(c.name)}</dd><dt>WhatsApp</dt><dd>${c.phone ? `<a href="${waLink(c.phone)}" target="_blank" rel="noopener">${esc(c.phone)}</a>` : "-"}</dd><dt>Source</dt><dd>${esc(c.source || "-")}</dd><dt>First Order</dt><dd>${fmtDate(s.first)}</dd><dt>Last Order</dt><dd>${fmtDate(s.last)}</dd></dl>${c.note ? `<div class="note">${esc(c.note)}</div>` : ""}`, { right: `<button class="ib" data-a="edit" type="button" aria-label="Edit customer">${ic("edit")}</button>` })}
          ${panel("Spending by Category", hBars([...cats].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))))}
          ${panel(null, `<div class="row btns"><button class="btn" data-a="merge" type="button">Merge with Another Customer</button><button class="btn danger" data-a="del" type="button">${ic("trash")}Delete Customer</button></div>`)}
        </div>
      </div>`);
  },
  after(id) {
    $("#main").onclick = async e => { const a = e.target.closest("[data-a]")?.dataset.a; const c = custById(id); if (!a || !c) return;
      if (a === "edit") editCustomer(c);
      if (a === "del") { const n = custStats(c).count; if (await confirmSheet("Delete customer", `Delete ${esc(c.name)}?${n ? ` ${plural(n, "order")} will stay, without a customer.` : ""}`, "Delete", true)) { await deleteCustomer(id); toast("Customer deleted"); go("customers"); } }
      if (a === "merge") mergeSheet(c);
    };
  }
};
function editCustomer(c) {
  const isNew = !c; c = c || { name: "", phone: "", source: "", note: "" };
  openSheet(isNew ? "Add Customer" : "Edit Customer", `<div class="fg">
    ${field("Name", `<input id="cu-name" value="${esc(c.name)}">`, "full")}
    ${field("WhatsApp Number", `<input id="cu-phone" inputmode="tel" value="${esc(c.phone || "")}" placeholder="08xx">`)}
    ${field("Source", `<select id="cu-src">${sel([["", "Not recorded"], ...S.settings.sources], c.source || "")}</select>`)}
    ${field("Notes", `<textarea id="cu-note" placeholder="e.g. university, major, preferences">${esc(c.note || "")}</textarea>`, "full")}</div>
    ${isNew ? "" : `<p class="hint">Changes apply to all ${plural(custStats(c).count, "order")} and their documents.</p>`}
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    const name = $("#cu-name").value.trim().replace(/\s+/g, " "); if (!name) { toast("Name is required"); return; }
    const clash = S.customers.find(x => normName(x.name) === normName(name) && x.id !== c.id);
    if (clash) { toast(`"${clash.name}" already exists. Use Merge to combine them.`); return; }
    const rec = await saveCustomer({ ...c, id: c.id || uid("c"), name, phone: $("#cu-phone").value.trim(), source: $("#cu-src").value, note: $("#cu-note").value.trim() });
    audit(`Customer ${name} ${isNew ? "added" : "updated"}`, `customer/${rec.id}`);
    closeSheet(); toast(isNew ? "Customer added" : "Customer updated"); if (isNew) go(`customer/${rec.id}`); else refresh();
  });
}
function mergeSheet(c) {
  const others = S.customers.filter(x => x.id !== c.id).sort((a, b) => a.name.localeCompare(b.name, "id"));
  openSheet(`Merge ${c.name}`, `<p class="hint">All orders of the customer you pick move to <b>${esc(c.name)}</b>, then that customer is removed. Use this when one person was saved twice.</p>
    <input id="mgQ" placeholder="Search customers" autocomplete="off"><nav class="mlist pick" id="mgList"></nav>`, async e => {
    const a = e.target.closest("[data-m]"); if (!a) return; const from = custById(a.dataset.m);
    if (await confirmSheet("Merge customers", `Move ${plural(custStats(from).count, "order")} of ${esc(from.name)} to ${esc(c.name)} and remove ${esc(from.name)}?`, "Merge")) { await mergeCustomers(c.id, from.id); toast("Customers merged"); refresh(); }
  });
  const draw = q => { q = q.toLowerCase(); $("#mgList").innerHTML = others.filter(x => !q || (x.name + " " + x.phone).toLowerCase().includes(q)).slice(0, 50).map(x => `<a data-m="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc(x.phone || "")}</small></span><span class="pr">${plural(custStats(x).count, "order")}</span></a>`).join("") || `<p class="empty">No other customers.</p>`; };
  draw(""); $("#mgQ").oninput = e => draw(e.target.value);
}

/* ===================== PRICE LIST ===================== */
const PR = { q: "", cat: "" };
const priceCats = () => { const s = []; [...S.prices].sort((a, b) => a.sort - b.sort).forEach(p => { if (!s.includes(p.cat)) s.push(p.cat); }); return s; };
function priceUsage() { const m = new Map(); S.orders.forEach(o => (o.items || []).forEach(i => { if (i.priceId) m.set(i.priceId, (m.get(i.priceId) || 0) + 1); })); return m; }
PAGES.prices = {
  title: "Price List", nav: "prices",
  render(openId) {
    const cs = priceCats();
    return page("Pricing", "Price List", `<span id="prCount"></span>`, `<button class="btn" data-a="copy" type="button">${ic("copy")}Copy as Text</button><button class="btn" data-a="csv" type="button">${ic("dl")}CSV</button><button class="btn" data-a="cat" type="button">${ic("plus")}Add Category</button><button class="btn primary" data-a="add" type="button">${ic("plus")}Add Service</button>`, `
      <div class="note"><b>Internal reference</b> taken from "Price List Twitter". Prices are starting prices; "To" is the usual upper limit. Changing a price here does not change orders already made.
        <ul class="plain">${(window.MB_PRICE_NOTES || []).map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
      ${panel(null, `<div class="toolbar"><input id="prQ" type="search" placeholder="Search services" value="${esc(PR.q)}"><select id="prCat">${sel([["", "All categories"], ...cs], PR.cat)}</select></div>
        <div class="tw pe-wrap"><table class="dt pe"><colgroup><col class="c-mv"><col class="c-cat"><col class="c-grp"><col class="c-name"><col class="c-mn"><col class="c-mn"><col class="c-unit"><col class="c-note"><col class="c-act"></colgroup>
          <thead><tr><th></th><th>Category</th><th>Group</th><th>Service</th><th class="r">From (Rp)</th><th class="r">To (Rp)</th><th>Unit</th><th>Note</th><th></th></tr></thead><tbody id="prRows"></tbody></table></div>
        <datalist id="pe-cats">${cs.map(c => `<option value="${esc(c)}">`).join("")}</datalist><datalist id="pe-grps">${[...new Set(S.prices.map(p => p.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join("")}</datalist>
        <p class="hint pe-hint">Click any cell to edit it; the change is saved when you leave the cell or press Enter (Esc cancels). Use the arrows to change the order, + to add a row below, and the bin to delete. Every column can be filtered with ▾.</p>`, { flush: true })}`);
  },
  after(openId) {
    const use = priceUsage(), ordered = () => [...S.prices].sort((a, b) => (a.sort || 0) - (b.sort || 0)), isMoney = f => f === "price" || f === "max";
    const show = (p, f) => isMoney(f) ? money(p[f]) : p[f] || "";
    const cell = (p, f, cls = "", extra = "") => `<input class="pe-in ${cls}" data-f="${f}" value="${esc(show(p, f))}" title="${esc(show(p, f))}" ${extra} aria-label="${f}">`;
    const draw = () => {
      const q = PR.q.toLowerCase().trim();
      const L = ordered().filter(p => (!PR.cat || p.cat === PR.cat) && (!q || [p.code, p.name, p.group, p.cat, p.note].join(" ").toLowerCase().includes(q)));
      $("#prCount").textContent = `${L.length} of ${plural(S.prices.length, "service")} in ${plural(priceCats().length, "category", "categories")}`;
      let last = null;
      $("#prRows").innerHTML = L.map(p => { const n = use.get(p.id), first = p.cat !== last; last = p.cat;
        return `<tr data-pid="${esc(p.id)}" class="${first ? "pe-first" : ""}">
          <td class="pe-mv"><button class="ib" data-pa="up" type="button" aria-label="Move up" title="Move up"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button><button class="ib" data-pa="down" type="button" aria-label="Move down" title="Move down"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></td>
          <td>${cell(p, "cat", "", 'list="pe-cats"')}</td><td>${cell(p, "group", "", 'list="pe-grps" placeholder="-"')}</td>
          <td>${cell(p, "name", "pe-name")}${n ? `<div class="sub">Used in ${plural(n, "order")}</div>` : ""}</td>
          <td>${cell(p, "price", "money r", 'inputmode="numeric" maxlength="17" placeholder="0"')}</td><td>${cell(p, "max", "money r", 'inputmode="numeric" maxlength="17" placeholder="-"')}</td>
          <td>${cell(p, "unit", "", 'placeholder="-"')}</td><td>${cell(p, "note", "", 'placeholder="-"')}</td>
          <td class="pe-act"><button class="ib" data-pa="below" type="button" aria-label="Add a row below" title="Add a row below">${ic("plus")}</button><button class="ib" data-pa="del" type="button" aria-label="Delete" title="Delete">${ic("trash")}</button></td></tr>`; }).join("")
        || emptyRow(9, S.prices.length ? "No matching services." : "The price list is empty. Add a service.");
    };
    /* a new row goes right after `after` (or at the end of its category) with a sort value between its neighbours */
    const addRow = async (after, patch = {}) => {
      const L = ordered(), cat = patch.cat ?? after?.cat ?? PR.cat ?? "";
      const prev = after && S.prices.includes(after) ? after : [...L].reverse().find(x => x.cat === cat) || L[L.length - 1], i = prev ? L.indexOf(prev) : -1, next = L[i + 1];
      const sort = prev ? (next ? ((prev.sort || 0) + (next.sort || 0)) / 2 : (prev.sort || 0) + 1) : 1;
      const rec = { id: uid("p"), cat: cat || "New category", group: patch.group ?? after?.group ?? "", code: "", name: patch.name || "New service", price: 0, max: 0, unit: patch.unit ?? after?.unit ?? "", note: "", sort, createdAt: Date.now(), updatedAt: Date.now() };
      await Store.put("prices", rec); audit(`Service ${rec.name} added to ${rec.cat}`, "prices");
      if (PR.cat && PR.cat !== rec.cat) { PR.cat = ""; $("#prCat").value = ""; }
      draw(); const inp = $(`tr[data-pid="${rec.id}"] .pe-name`); if (inp) { inp.scrollIntoView({ block: "center" }); inp.focus(); inp.select(); }
    };
    /* one cell → one saved field; bad input is refused and the old value comes back */
    const save = async inp => {
      const tr = inp.closest("tr[data-pid]"), p = S.prices.find(x => x.id === tr?.dataset.pid); if (!p) return;
      const f = inp.dataset.f, v = isMoney(f) ? toNum(inp.value) : inp.value.trim(), back = msg => { toast(msg); inp.value = show(p, f); };
      if (v === (isMoney(f) ? p[f] || 0 : p[f] || "")) { inp.value = show(p, f); return; }
      if (f === "name" && !v) return back("Service name is required");
      if (f === "cat" && !v) return back("Category is required");
      if (isMoney(f) && v > MAX_PRICE) return back(`A price may not exceed ${rp(MAX_PRICE)}`);
      if (f === "max" && v && v <= (p.price || 0)) return back("\"To\" must be higher than \"From\", or empty for a single price");
      const patch = { [f]: v }; if (f === "price" && p.max && p.max <= v) patch.max = 0;
      await Store.put("prices", { ...p, ...patch, updatedAt: Date.now() });
      audit(`Price list: ${f === "name" ? `${p.name} renamed to ${v}` : `${p.name}, ${{ cat: "category", group: "group", price: "price", max: "upper price", unit: "unit", note: "note" }[f]} ${isMoney(f) ? `→ ${v ? rp(v) : "none"}` : `→ ${v || "empty"}`}`}`, "prices");
      inp.value = inp.title = show({ ...p, ...patch }, f);
      inp.classList.add("pe-saved"); setTimeout(() => inp.classList.remove("pe-saved"), 900);
      if (f === "cat" || patch.max === 0) draw();
    };
    draw();
    $("#prQ").oninput = e => { PR.q = e.target.value; draw(); };
    $("#prCat").onchange = e => { PR.cat = e.target.value; draw(); };
    const rows = $("#prRows");
    rows.addEventListener("change", e => { if (e.target.matches(".pe-in")) save(e.target); });
    rows.addEventListener("keydown", e => {
      if (!e.target.matches(".pe-in")) return;
      if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
      if (e.key === "Escape") { const p = S.prices.find(x => x.id === e.target.closest("tr").dataset.pid); e.target.value = show(p, e.target.dataset.f); e.target.blur(); }
    });
    $("#main").onclick = async e => {
      const b = e.target.closest("[data-pa]");
      if (b) {
        const p = S.prices.find(x => x.id === b.closest("tr").dataset.pid); if (!p) return;
        if (b.dataset.pa === "below") return addRow(p);
        if (b.dataset.pa === "del") { const old = { ...p }; await Store.del("prices", p.id); audit(`Service ${p.name} deleted from the price list`, "prices"); draw(); toast(`${p.name} deleted`, async () => { await Store.put("prices", old); draw(); }); return; }
        /* move = swap places with the row above or below (it may cross into the neighbouring category) */
        const L = ordered(), i = L.indexOf(p), j = b.dataset.pa === "up" ? i - 1 : i + 1, o = L[j]; if (!o) return;
        const a = p.sort || 0, c = o.sort || 0, now = Date.now();
        await Store.putMany("prices", [{ ...p, sort: c, cat: o.cat, updatedAt: now }, { ...o, sort: a === c ? a + (j > i ? -0.001 : 0.001) : a, updatedAt: now }]);
        draw(); $(`tr[data-pid="${p.id}"] [data-pa="${b.dataset.pa}"]`)?.focus(); return;
      }
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "add") return addRow(null);
      if (a === "cat") return openSheet("Add Category", `<div class="fg">${field("Category Name", `<input id="pc-name" placeholder="e.g. Jasa Desain">`, "full")}${field("First Service", `<input id="pc-svc" placeholder="e.g. Desain logo">`, "full")}</div>
        <div class="row btns"><button class="btn primary" data-a="ok" type="button">Add</button><button class="btn" data-close type="button">Cancel</button></div>`, async ev => {
          if (ev.target.closest("[data-a]")?.dataset.a !== "ok") return;
          const cat = $("#pc-name").value.trim(), svc = $("#pc-svc").value.trim(); if (!cat) return toast("Category name is required");
          if (priceCats().some(c => c.toLowerCase() === cat.toLowerCase())) return toast("This category already exists");
          closeSheet(); const L = ordered(); await addRow(L[L.length - 1] || null, { cat, group: "", unit: "", name: svc || "New service" });
        });
      if (a === "copy") copyText(priceListText(), "Price list copied");
      if (a === "csv") download(`MINDBYTE Price List ${todayISO()}.csv`, new Blob([toCsv([["Code", "Category", "Group", "Service", "Price", "Up To", "Unit", "Note"], ...ordered().map(p => [p.code || "", p.cat, p.group || "", p.name, p.price, p.max || "", p.unit || "", p.note || ""])])], { type: "text/csv" }), "CSV downloaded");
    };
    if (openId) { const tr = $(`tr[data-pid="${CSS.escape(openId)}"]`); if (tr) { tr.scrollIntoView({ block: "center" }); tr.querySelector(".pe-name")?.focus(); } }
  }
};
/* the list as plain text, ready to paste into X or WhatsApp */
function priceListText() {
  const k = n => n >= 1e6 ? num(n / 1e6) + "jt" : n >= 1000 ? num(n / 1000) + "k" : String(n);
  let out = [], cat = null, grp = null;
  [...S.prices].sort((a, b) => a.sort - b.sort).forEach(p => {
    if (p.cat !== cat) { cat = p.cat; grp = null; out.push("", cat.toUpperCase()); }
    if ((p.group || "") !== grp) { grp = p.group || ""; if (grp) out.push(`★ ${grp}`); }
    out.push(p.price ? `- ${p.name}: ${k(p.price)}${p.max && p.max > p.price ? "–" + k(p.max) : ""}${p.unit ? "/" + p.unit : ""}` : `- ${p.name}${p.note ? ": " + p.note : ""}`);
  });
  return out.join("\n").trim();
}
function editPrice(p) {
  const isNew = !p; p = p || { cat: PR.cat || "", group: "", code: "", name: "", price: 0, max: 0, unit: "", note: "" };
  const n = priceUsage().get(p.id) || 0;
  openSheet(isNew ? "Add Service" : "Edit Service", `<div class="fg">
    ${field("Service Name", `<input id="pe-name" value="${esc(p.name)}">`, "full")}
    ${field("Category", `<input id="pe-cat" list="pe-cats" value="${esc(p.cat)}" autocomplete="off">`)}<datalist id="pe-cats">${priceCats().map(c => `<option value="${esc(c)}">`).join("")}</datalist>
    ${field("Group (optional)", `<input id="pe-grp" value="${esc(p.group || "")}" placeholder="e.g. Materi dari customer">`)}
    ${field("Starting Price (Rp)", `<input id="pe-price" class="money" inputmode="numeric" maxlength="17" value="${money(p.price)}" placeholder="0">`)}
    ${field("Up To (Rp, optional)", `<input id="pe-max" class="money" inputmode="numeric" maxlength="17" value="${money(p.max)}" placeholder="single price">`)}
    ${field("Unit", `<input id="pe-unit" value="${esc(p.unit)}" placeholder="e.g. halaman">`)}
    ${field("Code", `<input id="pe-code" value="${esc(p.code || "")}" maxlength="12">`)}
    ${field("Note", `<textarea id="pe-note">${esc(p.note || "")}</textarea>`, "full")}</div>
    ${n ? `<p class="hint">Used in ${plural(n, "order")}. Those orders keep the price they were made with.</p>` : ""}
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button>${isNew ? `<button class="btn" data-close type="button">Cancel</button>` : `<button class="btn danger" data-a="del" type="button">Delete</button>`}</div>`, async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "del") { const old = { ...p }; await Store.del("prices", p.id); audit(`Service ${p.name} deleted from the price list`); closeSheet(); refresh(); toast("Service deleted", async () => { await Store.put("prices", old); refresh(); }); return; }
    const name = $("#pe-name").value.trim(), price = toNum($("#pe-price").value), max = toNum($("#pe-max").value), cat = $("#pe-cat").value.trim();
    if (!name) return toast("Service name is required"); if (!cat) return toast("Category is required"); if (!price && !$("#pe-note").value.trim()) return toast("Enter a price, or a note for a rule without a price");
    if (max && max < price) return toast("'Up to' must be higher than the starting price");
    const sameCat = S.prices.filter(x => x.cat === cat);
    const rec = { ...p, id: p.id || uid("p"), name, cat, group: $("#pe-grp").value.trim(), price, max: max > price ? max : 0, unit: $("#pe-unit").value.trim(), code: $("#pe-code").value.trim(), note: $("#pe-note").value.trim(),
      sort: p.sort ?? (sameCat.length ? Math.max(...sameCat.map(x => x.sort)) + 0.01 : Math.max(0, ...S.prices.map(x => x.sort || 0)) + 1), updatedAt: Date.now(), createdAt: p.createdAt || Date.now() };
    await Store.put("prices", rec); audit(`Service ${name} ${isNew ? "added" : `updated (${priceTxt(rec)})`}`, `prices/${rec.id}`); closeSheet(); refresh(); toast(isNew ? "Service added" : "Service updated");
  });
}

/* ===================== PRICE ESTIMATE ===================== */
const EST = { svc: "", qty: 1, diff: "1.3", q: "", paid: "", due: "", wpay: "", margin: 40, basis: "auto", pos: "0" };
const STOP = new Set("dan yang untuk dengan dari pada ini itu atau per the of and for with jasa buat bikin tugas pembuatan pengerjaan halaman lembar".split(" "));
const toks = s => [...new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)))];
const tokHit = (t, W) => W.has(t) || (t.length >= 5 && [...W].some(w => w.length >= 5 && (w.startsWith(t) || t.startsWith(w))));
function similar(q) { const T = toks(q); if (!T.length) return [];
  return S.orders.filter(o => o.status !== "batal" && !o.noAmount && calc(o).total > 0).map(o => { const W = new Set(toks([o.project, ...(o.items || []).map(i => i.name)].join(" "))); const hit = T.filter(t => tokHit(t, W)).length; return { o, hit, s: hit / T.length }; })
    .filter(x => x.hit && x.s >= .5).sort((a, b) => b.s - a.s || toNum(b.o.queue) - toNum(a.o.queue)); }
const roundPrice = n => n >= 10000 ? Math.round(n / 5000) * 5000 : Math.round(n / 500) * 500;
const hrs = h => h < 1 ? plural(Math.max(1, Math.round(h * 60)), "minute") : h < 48 ? `${num(h)} hours` : `${num(h / 24)} days`;
PAGES.estimate = {
  title: "Price Estimate", nav: "estimate",
  render() {
    if (!EST.paid) EST.paid = toLocal(Date.now());
    const g = new Map(); [...S.prices].sort((a, b) => a.sort - b.sort).forEach(p => { if (!g.has(p.cat)) g.set(p.cat, []); g.get(p.cat).push(p); });
    const svc = `<option value="">None, estimate from past orders</option>` + [...g].map(([c, ps]) => `<optgroup label="${esc(c)}">${ps.map(p => `<option value="${esc(p.id)}"${p.id === EST.svc ? " selected" : ""}>${esc(p.group ? p.group + " · " : "")}${esc(p.name)} · ${priceTxt(p)}</option>`).join("")}</optgroup>`).join("");
    return page("Pricing", "Price Estimate", "Combines the price list, past orders, difficulty and deadline.", "", `
      <div class="grid g-detail">
        <div class="stack">
          ${panel("Job", `<div class="fg" id="estForm">
            ${field("Service from Price List", `<select id="est-svc">${svc}</select>`, "full")}
            ${field("Quantity", `<input id="est-qty" inputmode="numeric" maxlength="4" value="${esc(EST.qty)}">`)}
            ${field("Position in Price Range", `<select id="est-pos">${sel([["0", "Starting price"], ["0.5", "Middle of range"], ["1", "Top of range"]], EST.pos)}</select>`)}
            ${field("Difficulty", `<select id="est-diff">${sel([["1", "Easy (×1,0)"], ["1.3", "Medium (×1,3)"], ["1.6", "Hard (×1,6)"]], EST.diff)}</select>`)}
            ${field("Price Basis", `<select id="est-basis">${sel([["auto", "Automatic"], ["list", "Price list"], ["med", "Past orders, median"], ["avg", "Past orders, average"], ["worker", "Worker pay + margin"]], EST.basis)}</select>`)}
            ${field("Keywords to Match Past Orders", `<input id="est-q" value="${esc(EST.q)}" placeholder="e.g. makalah, ppt, jurnal sinta" autocomplete="off">`, "full")}
            ${field("Down Payment Time", `<input id="est-paid" type="datetime-local" value="${esc(EST.paid)}">`)}
            ${field("Due Date", `<input id="est-due" type="datetime-local" value="${esc(EST.due)}">`)}
            ${field("Worker Pay (Rp, optional)", `<input id="est-wpay" class="money" inputmode="numeric" maxlength="15" value="${esc(EST.wpay)}" placeholder="0">`)}
            ${field("Margin (%)", `<input id="est-margin" inputmode="numeric" maxlength="2" value="${esc(EST.margin)}">`)}
          </div><p class="hint">Automatic uses the price list first, then the median of similar past orders, then worker pay. Rush applies when the time from down payment to due date is under 24 hours: premium = (24 − hours) ÷ 24, so a 0-hour job doubles.</p>`)}
        </div>
        <div class="stack">${panel("Suggested Price", `<div id="estRes"></div>`)}${panel("Price References", `<dl class="kv" id="estCmp"></dl>`)}</div>
      </div>
      ${panel("Similar Past Orders", `<table class="dt"><tbody id="estRows"></tbody></table>`, { flush: true, right: `<span class="hint" id="estSimN"></span>` })}`);
  },
  after() {
    $("#estForm").addEventListener("input", calcEst);
    $("#estForm").addEventListener("change", e => { if (e.target.id === "est-svc") { const p = S.prices.find(x => x.id === e.target.value), qi = $("#est-q"); if (p && (!qi.value.trim() || qi.value === qi.dataset.auto)) { qi.value = p.name; qi.dataset.auto = p.name; } } calcEst(); });
    $("#main").onclick = e => { if (e.target.id !== "estOrder" || !lastEst) return; window.__prefill = lastEst; go("new"); };
    calcEst();
  }
};
let lastEst = null;
function calcEst() {
  Object.assign(EST, { svc: $("#est-svc").value, qty: $("#est-qty").value, pos: $("#est-pos").value, diff: $("#est-diff").value, q: $("#est-q").value, paid: $("#est-paid").value, due: $("#est-due").value, wpay: $("#est-wpay").value, margin: $("#est-margin").value, basis: $("#est-basis").value });
  const p = S.prices.find(x => x.id === EST.svc), qty = Math.min(9999, Math.max(1, toNum(EST.qty) || 1)), pos = Number(EST.pos) || 0;
  const unit = p ? p.price + ((p.max || p.price) - p.price) * pos : 0;
  const sim = similar(EST.q.trim()), tot = sim.map(x => calc(x.o).total);
  const wp = Math.min(MAX_PRICE, toNum(EST.wpay)), mg = Math.min(90, toNum(EST.margin));
  const B = { list: unit * qty, med: median(tot), avg: tot.length ? sum(tot) / tot.length : 0, worker: wp ? wp / (1 - mg / 100) : 0 };
  const LB = { list: "Price list", med: "Past orders, median", avg: "Past orders, average", worker: "Worker pay + margin" };
  let k = EST.basis; if (k === "auto") k = B.list ? "list" : B.med ? "med" : B.worker ? "worker" : "";
  const diff = Number(EST.diff) || 1, dl = $("#est-diff").selectedOptions[0].textContent.split(" (")[0];
  const t0 = EST.paid ? fromLocal(EST.paid) : Date.now(), t1 = EST.due ? fromLocal(EST.due) : 0, W = t1 ? (t1 - t0) / 3600e3 : null;
  $("#estCmp").innerHTML = `<dt>Price list${p && qty > 1 ? ` × ${qty}` : ""}</dt><dd>${B.list ? rp(B.list) : "-"}</dd>${p && p.max ? `<dt>Price list range</dt><dd>${rp(p.price * qty)} – ${rp(p.max * qty)}</dd>` : ""}<dt>Past orders, median</dt><dd>${tot.length ? rp(B.med) : "-"}</dd><dt>Past orders, average</dt><dd>${tot.length ? rp(B.avg) : "-"}</dd><dt>Past orders, range</dt><dd>${tot.length ? `${rp(Math.min(...tot))} – ${rp(Math.max(...tot))}` : "-"}</dd><dt>Worker pay + ${mg}% margin</dt><dd>${B.worker ? rp(B.worker) : "-"}</dd>`;
  $("#estSimN").textContent = EST.q.trim() ? `${plural(sim.length, "match", "matches")}${sim.length > 20 ? ", latest 20 shown" : ""}` : "";
  $("#estRows").innerHTML = sim.slice(0, 20).map(({ o }) => `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r">${rp(calc(o).total)}<div class="sub">${fmtShort(o.date)}</div></td></tr>`).join("") || emptyRow(3, EST.q.trim() ? "No past orders match these keywords. Try fewer or broader words." : "Enter keywords, or pick a service, to find similar past orders.");
  lastEst = null;
  if (!k || !B[k]) { $("#estRes").innerHTML = `<p class="hint">${k ? `There is no ${LB[k].toLowerCase()} figure for this job yet. Choose another price basis.` : "Pick a service, enter keywords that match past orders, or enter the worker pay."}</p>`; return; }
  if (W !== null && W <= 0) { $("#estRes").innerHTML = `<p class="hint over">The due date must be after the down payment time.</p>`; return; }
  const r = W !== null && W < 24 ? (24 - W) / 24 : 0, base = B[k], d1 = base * diff, fin = d1 * (1 + r), sug = roundPrice(fin);
  lastEst = { item: { name: p ? p.name + (qty > 1 ? ` (${qty}${p.unit ? " " + p.unit : "×"})` : "") : EST.q, qty: 1, price: sug, ...(p ? { priceId: p.id } : {}) }, project: p ? p.name : EST.q, cat: p ? p.cat : "", due: EST.due };
  $("#estRes").innerHTML = `<div class="hero">${rp(sug)}<small>Rounded to the nearest ${sug >= 10000 ? "Rp 5.000" : "Rp 500"}</small></div>
    <div class="totals full"><div><span>${LB[k]}</span><span>${rp(base)}</span></div><div><span>Difficulty: ${dl} ×${num(diff)}</span><span>${rp(d1)}</span></div><div><span>${W === null ? "No due date entered" : r ? `Rush: ${hrs(W)} after payment, +${num(r * 100)}%` : `Normal: ${hrs(W)} after payment`}</span><span>${rp(fin)}</span></div><div class="t"><span>Suggested Price</span><span>${rp(sug)}</span></div></div>
    <button class="btn primary" id="estOrder" type="button">Create Order at This Price</button>`;
}
