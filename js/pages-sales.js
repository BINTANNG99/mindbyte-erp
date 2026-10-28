/* MINDBYTE Order System: Sales pages (dashboard, orders, order form, order detail, calendar). */
"use strict";

/* ===================== DASHBOARD ===================== */
PAGES.dashboard = {
  title: "Dashboard", nav: "dashboard",
  render() {
    const now = new Date(), mk = monthKey(now), pk = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const act = S.orders.filter(isActive), dups = dupMap();
    const rec = receiptsByMonth();
    const inM = rec.get(mk) || 0, inP = rec.get(pk) || 0;
    const owed = sum(act, owedOf);
    const due = act.filter(o => idx(o.status) < idx("minta_lunas") && o.deadline && toDate(o.deadline).getTime() - Date.now() < 48 * 3600e3);
    const late = due.filter(isLate);
    const delta = inP ? Math.round((inM - inP) / inP * 100) : null;
    const target = S.settings.monthlyTarget;
    const kp = `<div class="kpis">
      ${kpi("Active Orders", act.length, `${plural(act.filter(o => o.status === "dikerjakan").length, "in progress", "in progress")}`)}
      ${kpi("Unpaid", rp(owed), `${plural(act.filter(o => owedOf(o) > 0).length, "order")}`)}
      ${kpi(`Received in ${MONTHS[now.getMonth()].slice(0, 3)}`, rp(inM), delta === null ? "no data last month" : `${delta >= 0 ? "+" : ""}${delta}% vs ${MONTHS[(now.getMonth() + 11) % 12].slice(0, 3)}`, delta !== null && delta < 0 ? "down" : delta > 0 ? "up" : "")}
      ${kpi(late.length ? "Overdue" : "Due in 48 Hours", late.length || due.length, late.length ? "past the due date" : "orders in progress", due.length ? "alert" : "")}
    </div>`;
    const at_ = attentionItems();
    const attn = panel(`Needs Attention`, at_.length ? `<ul class="attn">${at_.map(([c, t, d, r]) => `<li class="a-${c}"><a href="#/${r}"><b>${esc(t)}</b><span>${esc(d)}</span></a></li>`).join("")}</ul>` : `<p class="hint">Nothing needs attention right now.</p>`, { right: `<span class="hint">${at_.length ? plural(at_.length, "item") : "all clear"}</span>` });
    const tgt = target ? panel("Monthly Target", `<div class="meter-row"><div class="meter"><i style="width:${Math.min(100, inM / target * 100)}%"></i></div><b>${num(inM / target * 100, 0)}%</b></div><p class="hint">${rp(inM)} of ${rp(target)} received this month${inM < target ? ` · ${rp(target - inM)} to go` : ""}.</p>`) : "";
    const months = lastMonths(12).map(k => ({ label: monthShort(k).split(" ")[0], value: rec.get(k) || 0, hi: k === mk, tip: `${monthLabel(k)}: ${rp(rec.get(k) || 0)}` }));
    const chart = panel("Cash Received, Last 12 Months", colChart(months, { label: "Cash received per month" }), { right: `<a class="btn link" href="#/insights">Insights</a>` });

    const need = act.filter(o => o.status === "menunggu_dp" || o.status === "minta_lunas").sort((a, b) => (at(a, a.status) || 0) - (at(b, b.status) || 0));
    const needRows = need.map(o => { const t = at(o, o.status), old = t && Date.now() - t > 24 * 3600e3;
      return `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r"><div class="amt">${rp(billedNow(o))}</div><div class="sub${old ? " over" : ""}">${ago(t)}</div></td><td class="act">${clientPhone(o) ? `<a class="ib" href="${waLink(clientPhone(o), fillTpl(tplOf("remind"), tplVars(o)))}" target="_blank" rel="noopener" title="Send payment reminder" aria-label="Send payment reminder">${ic("wa")}</a>` : ""}</td></tr>`; }).join("");
    const wip = act.filter(o => o.status === "dikerjakan").sort((a, b) => String(a.deadline || "9").localeCompare(String(b.deadline || "9")));
    const wipRows = wip.map(o => { const lt = isLate(o); return `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r dl${lt ? " over" : ""}">${dueText(o, 1)}<div class="sub${lt ? " over" : ""}">${o.deadline ? untilText(toDate(o.deadline).getTime()) : ""}</div></td></tr>`; }).join("");
    const closable = act.filter(o => o.status === "lunas" && revState(o).why);
    const rv = act.filter(o => o.status === "lunas" && !revState(o).why);
    const revRows = [...rv, ...closable].map(o => { const r = revState(o); return `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r">${r.why ? `<span class="badge b-ok">Ready to close</span>` : `<span class="sub">${r.used}/${r.max} used · ends ${fmtTime(r.end)}</span>`}</td></tr>`; }).join("");
    const dupList = [...dups.keys()].map(id => S.orders.find(o => o.id === id)).filter(Boolean).sort((a, b) => toNum(b.queue) - toNum(a.queue));
    const log = S.orders.flatMap(o => (o.log || []).map(l => ({ ...l, o }))).sort((a, b) => b.at - a.at).slice(0, 8);

    return page("Sales", "Dashboard", `${DAYS[now.getDay()]}, ${fmtDate(now.getTime())}`, `<a class="btn" href="#/estimate">Price Estimate</a><a class="btn primary" href="#/new">New Order</a>`, `
      ${kp}${attn}${tgt}
      ${dupList.length ? `<div class="alertbar"><b>Duplicate order numbers.</b> ${dupList.map(o => `<a href="#/order/${esc(o.id)}">${qfmt(o.queue)} · ${esc(o.project || "order")}</a>`).join(", ")}. Change the number on one of them.</div>` : ""}
      <div class="grid g-main">
        <div class="stack">
          ${panel("Awaiting Payment", `<table class="dt"><tbody>${needRows || emptyRow(4, "No invoices are awaiting payment.")}</tbody></table>`, { flush: true, right: need.length ? `<span class="hint">${rp(sum(need, billedNow))}</span>` : "" })}
          ${panel("In Progress", `<table class="dt"><tbody>${wipRows || emptyRow(3, S.orders.length ? "No orders in progress." : "No orders yet. Start with New Order.")}</tbody></table>`, { flush: true, right: `<span class="hint">by due date</span>` })}
          ${revRows ? panel("Revision Period", `<table class="dt"><tbody>${revRows}</tbody></table>`, { flush: true }) : ""}
        </div>
        <div class="stack">
          ${chart}
          ${panel("Recent Activity", log.length ? `<ul class="feed">${log.map(l => `<li><a href="#/order/${esc(l.o.id)}"><b>${qfmt(l.o.queue)}</b> ${esc(l.text)}</a><span>${ago(l.at)} ago</span></li>`).join("")}</ul>` : `<p class="empty">Changes you make to orders appear here.</p>`)}
        </div>
      </div>`);
  }
};
function receiptsByMonth() { const m = new Map(); S.orders.forEach(o => receipts(o).forEach(r => { const k = monthKey(r.at); m.set(k, (m.get(k) || 0) + r.amount); })); return m; }
function lastMonths(n, end = new Date()) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(end.getFullYear(), end.getMonth() - i, 1))); return out; }

/* ===================== ORDER LIST ===================== */
const OL = { q: "", st: "aktif", cat: "", month: "", pay: "", sort: "queue", dir: -1, limit: 100 };
const OL_STATUS = [["aktif", "All active"], ["menunggu_dp", "Awaiting down payment"], ["dikerjakan", "In progress"], ["minta_lunas", "Awaiting final payment"], ["lunas", "Revision period"], ["selesai", "Completed"], ["batal", "Cancelled"], ["unpaid", "Has balance due"], ["late", "Overdue"], ["semua", "All orders"]];
function filteredOrders() {
  const q = OL.q.trim().toLowerCase();
  let L = S.orders.filter(o => {
    const f = OL.st;
    if (f === "aktif" && !isActive(o)) return false;
    if (f === "unpaid" && !(owedOf(o) > 0)) return false;
    if (f === "late" && !isLate(o)) return false;
    if (!["aktif", "semua", "unpaid", "late"].includes(f) && o.status !== f) return false;
    if (OL.cat && (o.cat || "") !== (OL.cat === "-" ? "" : OL.cat)) return false;
    if (OL.month && !String(o.date || "").startsWith(OL.month)) return false;
    if (OL.pay === "full" && !o.fullPay) return false; if (OL.pay === "dp" && o.fullPay) return false;
    if (q && ![qfmt(o.queue), o.queue, o.project, clientName(o), clientPhone(o), o.notes, o.memo, o.cat, ...(o.items || []).map(i => i.name)].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  const key = { queue: o => toNum(o.queue), date: o => toDate(o.date || o.createdAt).getTime() || 0, due: o => o.deadline ? toDate(o.deadline).getTime() : 9e15, total: o => grandTotal(o), owed: o => owedOf(o), customer: o => clientName(o).toLowerCase() || "~" }[OL.sort];
  L.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * OL.dir || toNum(b.queue) - toNum(a.queue); });
  return L;
}
const orderCats = () => { const s = new Set(S.prices.map(p => p.cat)); S.orders.forEach(o => o.cat && s.add(o.cat)); return [...s]; };
PAGES.orders = {
  title: "Orders", nav: "orders",
  render() {
    const months = [...new Set(S.orders.map(o => String(o.date || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    const th = (k, l, cls = "") => `<th class="${cls}"><button type="button" class="sorth" data-sort="${k}">${l}${OL.sort === k ? (OL.dir < 0 ? " ↓" : " ↑") : ""}</button></th>`;
    return page("Sales", "Orders", `<span id="olCount"></span>`, `<button class="btn" data-a="csv" type="button">${ic("dl")}Export CSV</button><a class="btn" href="#/past">Record Past Order</a><a class="btn primary" href="#/new">New Order</a>`,
      panel(null, `<div class="toolbar">
        <input id="olQ" type="search" placeholder="Search order number, customer, job, notes" value="${esc(OL.q)}">
        <select id="olSt">${sel(OL_STATUS, OL.st)}</select>
        <select id="olCat">${sel([["", "All categories"], ["-", "Uncategorised"], ...orderCats()], OL.cat)}</select>
        <select id="olMonth">${sel([["", "Any month"], ...months.map(m => [m, monthLabel(m)])], OL.month)}</select>
        <select id="olPay">${sel([["", "Any payment"], ["dp", "Down payment"], ["full", "Paid upfront"]], OL.pay)}</select>
      </div><div class="tw"><table class="dt"><thead><tr>${th("queue", "No.")}${th("customer", "Job / Customer")}<th class="wide">Status</th>${th("due", "Due", "wide")}${th("total", "Total", "r wide")}${th("owed", "Balance", "r")}</tr></thead><tbody id="olRows"></tbody></table></div><div id="olMore"></div>`, { flush: true }));
  },
  after() {
    const draw = () => {
      const L = filteredOrders(), dups = dupMap();
      $("#olCount").textContent = `${L.length} of ${plural(S.orders.length, "order")} · ${rp(sum(L.filter(o => o.status !== "batal"), o => grandTotal(o)))} total · ${rp(sum(L, owedOf))} unpaid`;
      /* a column filter needs every row on the table, not only the first 100 */
      const lim = typeof xfActive === "function" && xfActive() ? L.length : OL.limit;
      $("#olRows").innerHTML = L.slice(0, lim).map(o => { const late = isLate(o), ow = owedOf(o);
        return `<tr data-href="order/${esc(o.id)}">${orderCells(o, { dups })}<td class="wide">${badge(o.status)}</td><td class="wide dl${late ? " over" : ""}">${dueText(o, 1)}</td><td class="r wide">${o.noAmount ? `<span class="sub">not recorded</span>` : rp(grandTotal(o))}</td><td class="r${ow > 0 ? " strong" : ""}">${rp(ow)}</td></tr>`; }).join("") || emptyRow(6, S.orders.length ? "No matching orders." : "No orders yet.");
      $("#olMore").innerHTML = L.length > lim ? `<div class="more-row"><button class="btn" data-a="more" type="button">Show ${Math.min(100, L.length - OL.limit)} more</button></div>` : "";
    };
    draw();
    $("#olQ").oninput = e => { OL.q = e.target.value; OL.limit = 100; draw(); };
    [["#olSt", "st"], ["#olCat", "cat"], ["#olMonth", "month"], ["#olPay", "pay"]].forEach(([s, k]) => $(s).onchange = e => { OL[k] = e.target.value; OL.limit = 100; draw(); });
    $("#main").onclick = e => {
      const s = e.target.closest("[data-sort]"); if (s) { const k = s.dataset.sort; if (OL.sort === k) OL.dir *= -1; else { OL.sort = k; OL.dir = ["customer"].includes(k) ? 1 : -1; } refresh(); return; }
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "more") { OL.limit += 100; draw(); }
      if (a === "csv") { const L = filteredOrders(); download(`MINDBYTE Orders ${todayISO()}.csv`, new Blob([toCsv([["Order No.", "Order Date", "Due Date", "Customer", "WhatsApp", "Category", "Source", "Job Description", "Status", "Payment", "DP %", "Total", "Paid", "Balance", "Costs", "Notes"],
        ...L.map(o => [o.queue, o.date, o.deadline ? dueText(o) : "", clientName(o), clientPhone(o), o.cat || "", o.source || "", o.project, ST[o.status].label, o.fullPay ? "Paid upfront" : "Down payment", calc(o).pct, grandTotal(o), paidOf(o), owedOf(o), costOf(o), o.notes || ""])])], { type: "text/csv" }), "CSV downloaded"); }
    };
  }
};

/* ===================== ORDER FORM (new, past, edit) ===================== */
let FORM = null;   /* { mode: "new"|"past"|"edit", id, base } */
function formTitle() { return FORM?.mode === "edit" ? `Edit Order ${qfmt(FORM.base.queue)}` : FORM?.mode === "past" ? "Record Past Order" : "New Order"; }
function openForm(mode, base) {
  FORM = { mode, id: base?.id || null, base: base || {} };
}
PAGES.new = { title: "New Order", nav: "new", parent: "orders", render(cid) { openForm("new", { queue: nextQueue(), date: todayISO(), customerId: cid || null, dpPct: S.settings.dpPct, items: [] }); return formHtml(); }, after: formAfter, bar: formBar };
PAGES.past = { title: "Record Past Order", nav: "orders", parent: "orders", render() { openForm("past", { date: todayISO(), status: "selesai", archived: true, dpPct: S.settings.dpPct, items: [] }); return formHtml(); }, after: formAfter, bar: formBar };
PAGES.edit = {
  title: () => formTitle(), nav: "orders", parent: id => `order/${id}`,
  render(id) { const o = S.orders.find(x => x.id === id); if (!o) { go("orders"); return ""; } openForm("edit", JSON.parse(JSON.stringify(o))); return formHtml(); }, after: formAfter, bar: formBar
};
function formBar() { return `<button class="btn" data-fa="cancel" type="button">Cancel</button><button class="btn primary" data-fa="save" type="button">${FORM?.mode === "edit" ? "Save Changes" : "Save Order"}</button>`; }
function formHtml() {
  const o = FORM.base, c = custById(o.customerId), arch = FORM.mode === "past" || (FORM.mode === "edit" && o.archived);
  const t = o.dueType || "exact";
  const cats = orderCats();
  const timeline = arch && o.status !== "batal" ? panel("Order Timeline", `<p class="hint">Enter the dates on which each stage actually took place. These dates appear on the documents and in the reports.</p>
    <div class="fg">${field("Payment Type", `<select id="a-type">${sel([["dp", "Down payment, then final payment"], ["full", "Paid in full upfront"]], o.fullPay ? "full" : "dp")}</select>`)}
    ${field("Current Status", `<select id="a-status"></select>`)}
    ${FLOW.map(s => `<label data-st="${s}"><span data-l="dp">${STAGE_LABEL[s][0]}</span><span data-l="full">${STAGE_LABEL[s][1] || STAGE_LABEL[s][0]}</span><input type="datetime-local" id="a-${s}" value="${toLocal(at(o, s))}"></label>`).join("")}</div>`) : "";
  return page("Sales · Orders", formTitle(), `Fields marked <span class="req">*</span> are required. The document preview updates as you type.`, "", `
  <div class="grid g-form">
    <div class="stack" id="formCol">
      ${panel("Order", `<div class="fg">
        ${field(`Order Number <span class="req">*</span>`, `<input id="f-queue" inputmode="numeric" value="${o.queue ? qfmt(o.queue) : ""}">`)}
        ${field(`Order Date <span class="req">*</span>`, `<input id="f-date" type="date" value="${esc(o.date || todayISO())}">`)}
        ${field(`Job Description <span class="req">*</span>`, `<input id="f-project" value="${esc(o.project || "")}" placeholder="e.g. Introduction to Economics Paper">`, "full")}
        ${field("Category", `<select id="f-cat">${sel([["", "Uncategorised"], ...cats], o.cat || "")}</select>`)}
        ${field("Order Source", `<select id="f-source">${sel([["", "Not recorded"], ...S.settings.sources], o.source || "")}</select>`)}
        ${field("Due Date Type", `<select id="f-dtype">${sel([["exact", "Exact date and time"], ["est", "Estimated date"], ["range", "Estimated range"]], t)}</select>`)}
        <label id="w-exact"><span>Due Date</span><input id="f-deadline" type="datetime-local" value="${t === "exact" ? esc(o.deadline || "") : ""}"></label>
        <div id="w-est" class="dd2"><label id="w-from"><span>From</span><input id="f-dfrom" type="date" value="${esc(o.deadlineFrom || "")}"></label><label><span id="l-dto">Estimated Date</span><input id="f-dto" type="date" value="${t === "exact" ? "" : esc((o.deadline || "").slice(0, 10))}"></label></div>
      </div>${FORM.mode === "edit" && docsOf(o).length ? `<p class="hint">Changing the order number also changes the numbers on every document of this order (${docsOf(o).map(k => docNo(o, k)).join(", ")}).</p>` : ""}`)}
      ${timeline}
      ${panel("Customer", `<div class="fg">
        ${field("Customer Name", `<input id="f-client" list="custList" autocomplete="off" value="${esc(c?.name || "")}" placeholder="Type to find or add a customer"><span class="cust-hint" id="custHint"></span>`)}
        ${field("WhatsApp Number", `<input id="f-phone" inputmode="tel" value="${esc(c?.phone || "")}" placeholder="08xx">`)}
      </div><datalist id="custList">${S.customers.map(x => `<option value="${esc(x.name)}">${esc(x.phone || "")}</option>`).join("")}</datalist>
      <p class="hint">The name and number are stored once on the customer record, so a change here updates every order of this customer.</p>`)}
      ${panel("Line Items", `<div class="lines" id="items"></div>`, { right: `<button class="btn" id="pickItem" type="button">${ic("tag")}Price List</button><button class="btn" id="addItem" type="button">${ic("plus")}Add Line</button>` })}
      ${panel("Payment", `<div class="fg">
        ${field("Discount (Rp)", `<input id="f-discount" class="money" inputmode="numeric" maxlength="17" placeholder="0" value="${money(o.discount)}">`)}
        ${field("Down Payment (%)", `<input id="f-dp" inputmode="numeric" maxlength="3" value="${o.dpPct ?? S.settings.dpPct}">`)}
      </div><div class="totals" id="sumBox"></div>`)}
      ${panel("Notes", `<div class="fg">
        ${field("Notes to Customer (printed on documents)", `<textarea id="f-notes" placeholder="e.g. .docx format, Times New Roman 12 pt, 1.5 spacing.">${esc(o.notes || "")}</textarea>`, "full")}
        ${field("Internal Memo (never shown to the customer)", `<textarea id="f-memo" placeholder="e.g. worker, files, special agreements">${esc(o.memo || "")}</textarea>`, "full")}
      </div>`)}
    </div>
    <div class="stack sticky-col">
      ${panel("Document Preview", `<div class="seg" id="pvDocs"></div><div class="nota-frame" id="pvFrame"></div>`)}
    </div>
  </div>`);
}
function itemRow(it = {}) {
  const d = document.createElement("div"); d.className = "line";
  if (it.priceId) d.dataset.priceId = it.priceId;
  d.innerHTML = `<label class="ld"><span>Description</span><input class="in-name" value="${esc(it.name || "")}" placeholder="e.g. 15-page paper with references"></label>
    <label><span>Qty</span><input class="in-qty" inputmode="numeric" maxlength="4" value="${esc(it.qty || 1)}"></label>
    <label><span>Unit Price (Rp)</span><input class="in-price money" inputmode="numeric" maxlength="17" value="${money(it.price)}" placeholder="0"></label>
    <button class="btn sq" type="button" data-rm aria-label="Remove line" title="Remove line">${ic("x")}</button>`;
  return d;
}
function readForm() {
  const items = $$("#items .line").map(r => ({ name: r.querySelector(".in-name").value.trim(), qty: toNum(r.querySelector(".in-qty").value) || 1, price: toNum(r.querySelector(".in-price").value), ...(r.dataset.priceId ? { priceId: r.dataset.priceId } : {}) })).filter(i => i.name || i.price);
  const t = $("#f-dtype").value; let due;
  if (t === "exact") due = { dueType: "exact", deadline: $("#f-deadline").value, deadlineFrom: "" };
  else { let a = $("#f-dfrom").value, b = $("#f-dto").value; if (t === "range" && a && !b) b = a; if (a && b && a > b) [a, b] = [b, a]; due = { dueType: t, deadline: b ? b + "T23:59" : "", deadlineFrom: t === "range" ? a : "" }; }
  const dpRaw = $("#f-dp").value.trim();
  const o = { ...FORM.base, queue: toNum($("#f-queue").value), date: $("#f-date").value, ...due, project: $("#f-project").value.trim(), cat: $("#f-cat").value, source: $("#f-source").value,
    items, discount: toNum($("#f-discount").value), dpPct: dpRaw === "" ? S.settings.dpPct : Math.min(100, toNum(dpRaw)), notes: $("#f-notes").value.trim(), memo: $("#f-memo").value.trim() };
  if ($("#a-type")) { const full = $("#a-type").value === "full", status = $("#a-status").value, fl = full ? FLOW.filter(s => s !== "minta_lunas") : FLOW, hist = {};
    fl.filter(s => idx(s) <= idx(status)).forEach(s => { hist[s] = fromLocal($("#a-" + s).value); });
    Object.assign(o, { status, hist, archived: true }); if (full) o.fullPay = true; else delete o.fullPay; }
  if (o.items.length && o.noAmount && calc(o).total) delete o.noAmount;
  return o;
}
/* the customer typed on the form, resolved to a record (existing by name, or a new one to create) */
function formCustomer() {
  const name = $("#f-client").value.trim().replace(/\s+/g, " "), phone = $("#f-phone").value.trim();
  if (!name) return null;
  const ex = S.customers.find(c => normName(c.name) === normName(name));
  return ex ? { ...ex, phone: phone || ex.phone, _new: false, _changed: (phone && phone !== ex.phone) || ex.name !== name, name } : { id: uid("c"), name, phone, note: "", source: $("#f-source").value, _new: true };
}
function formPreviewOrder() { const o = readForm(), c = formCustomer(); const tmp = { ...o, customerId: c ? c.id : null, hist: o.hist || {}, status: o.status || "menunggu_dp" };
  if (c && c._new) S.customers.push(c); return [tmp, () => { if (c && c._new) S.customers = S.customers.filter(x => x !== c); }]; }
let pvKind = null;
function drawPreview() {
  if (!$("#pvFrame")) return;
  const [o, undoTmp] = formPreviewOrder();
  try {
    if (!o.items.length) o.items = [{ name: "", qty: 1, price: 0 }];
    if (FORM.mode === "new") o.hist = { menunggu_dp: Date.now() };
    const ks = FORM.mode === "new" ? ["dp"] : docsOf(o).length ? docsOf(o) : ["dp"];
    if (!ks.includes(pvKind)) pvKind = ks[ks.length - 1];
    $("#pvDocs").innerHTML = ks.map(k => `<button type="button" data-k="${k}" aria-pressed="${k === pvKind}">${DOC[k].title}</button>`).join("");
    mountNota($("#pvFrame"), o, pvKind);
  } finally { undoTmp(); }
  const c = calc(readForm());
  $("#sumBox").innerHTML = `<div><span>Subtotal</span><span>${rp(c.sub)}</span></div>${c.sub !== c.total ? `<div><span>Discount</span><span>−${rp(c.sub - c.total)}</span></div>` : ""}<div class="t"><span>Total</span><span>${rp(c.total)}</span></div><div class="d"><span>Down Payment (${c.pct}%)</span><span>${rp(c.dp)}</span></div><div><span>Balance Due</span><span>${rp(c.rest)}</span></div>`;
}
function syncDue() { const t = $("#f-dtype").value; $("#w-exact").hidden = t !== "exact"; $("#w-est").hidden = t === "exact"; $("#w-from").hidden = t !== "range"; $("#l-dto").textContent = t === "range" ? "To" : "Estimated Date"; }
function renderArch() {
  if (!$("#a-type")) return;
  const full = $("#a-type").value === "full", fl = full ? FLOW.filter(s => s !== "minta_lunas") : FLOW, s = $("#a-status"), keep = s.value || FORM.base.status;
  s.innerHTML = fl.map(x => `<option value="${x}">${x === "dikerjakan" && full ? "In Progress (paid in full)" : x === "lunas" && full ? "Delivered, Revision Period" : ST[x].label}</option>`).join("");
  s.value = fl.includes(keep) ? keep : "selesai";
  $$("#formCol [data-st]").forEach(l => { const st = l.dataset.st; l.hidden = !fl.includes(st) || idx(st) > idx(s.value); });
  $$("#formCol [data-l]").forEach(x => x.hidden = (x.dataset.l === "full") !== full);
}
function custHint() {
  const name = $("#f-client").value.trim(), h = $("#custHint"), c = S.customers.find(x => normName(x.name) === normName(name));
  if (!name) { h.textContent = ""; return; }
  if (c) { const n = custStats(c).count - (FORM.base.customerId === c.id ? 1 : 0); h.textContent = n > 0 ? `Existing customer · ${plural(n, "other order")}` : "Existing customer"; h.className = "cust-hint ok"; }
  else { h.textContent = "New customer, will be added on save"; h.className = "cust-hint"; }
}
function formAfter() {
  const box = $("#items"); (FORM.base.items && FORM.base.items.length ? FORM.base.items : [{}]).forEach(i => box.append(itemRow(i)));
  syncDue(); renderArch(); custHint();
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(drawPreview, 120); };
  $("#formCol").addEventListener("input", later);
  $("#formCol").addEventListener("change", e => { if (e.target.id === "f-dtype") syncDue(); if (e.target.id === "a-type" || e.target.id === "a-status") renderArch(); later(); });
  $("#f-client").addEventListener("input", () => { custHint(); const c = S.customers.find(x => normName(x.name) === normName($("#f-client").value)); if (c && !$("#f-phone").value) $("#f-phone").value = c.phone || ""; });
  $("#f-queue").addEventListener("blur", e => { const n = toNum(e.target.value); e.target.value = n ? qfmt(n) : ""; });
  box.addEventListener("click", e => { if (e.target.closest("[data-rm]")) { e.target.closest(".line").remove(); if (!box.children.length) box.append(itemRow()); later(); } });
  $("#addItem").onclick = () => { box.append(itemRow()); box.lastElementChild.querySelector(".in-name").focus(); later(); };
  $("#pickItem").onclick = () => pickPrice(p => { addLine({ name: p.name + (p.unit ? ` (per ${p.unit})` : ""), qty: 1, price: p.price, priceId: p.id }); if (!$("#f-cat").value) $("#f-cat").value = p.cat; later(); });
  $("#pvDocs").onclick = e => { const b = e.target.closest("[data-k]"); if (b) { pvKind = b.dataset.k; drawPreview(); } };
  $("#abarIn").onclick = e => { const a = e.target.closest("[data-fa]")?.dataset.fa; if (a === "cancel") go(FORM.mode === "edit" ? `order/${FORM.id}` : "orders"); if (a === "save") submitForm(); };
  /* prefill from an estimate */
  if (window.__prefill) { const p = window.__prefill; window.__prefill = null; addLine(p.item); if (p.project && !$("#f-project").value) $("#f-project").value = p.project; if (p.cat) $("#f-cat").value = p.cat; if (p.due) { $("#f-dtype").value = "exact"; $("#f-deadline").value = p.due; syncDue(); } }
  drawPreview();
}
function addLine(it) { const rows = $$("#items .line"), blank = rows.find(r => !r.querySelector(".in-name").value.trim() && !toNum(r.querySelector(".in-price").value)), n = itemRow(it); if (blank) blank.replaceWith(n); else $("#items").append(n); }
async function submitForm() {
  const o = readForm(), mode = FORM.mode, arch = !!$("#a-type");
  const bad = (msg, el) => { toast(msg); if (el) $(el)?.focus(); return false; };
  if (!o.queue) return bad("Order number is required", "#f-queue");
  if (!o.project) return bad("Job description is required", "#f-project");
  if (!o.items.length || (!calc(o).total && !o.noAmount)) return bad("Add at least one line item with a price");
  const bi = o.items.findIndex(i => i.price > MAX_PRICE), mi = o.items.findIndex(i => i.qty > MAX_QTY);
  if (bi >= 0) return bad(`Line ${bi + 1}: unit price may not exceed ${rp(MAX_PRICE)}`);
  if (mi >= 0) return bad(`Line ${mi + 1}: quantity may not exceed ${MAX_QTY}`);
  if (calc(o).sub > MAX_TOTAL) return bad(`Order total may not exceed ${rp(MAX_TOTAL)}`);
  if ((o.discount || 0) > calc(o).sub) return bad("Discount may not exceed the subtotal", "#f-discount");
  const clash = S.orders.find(x => toNum(x.queue) === o.queue && x.id !== FORM.id);
  if (clash) return bad(`Order number ${qfmt(o.queue)} is already used by "${clash.project}"`, "#f-queue");
  if (arch) { let last = 0;
    for (const [s, t] of Object.entries(o.hist)) {
      if (!t) return bad(`Enter the date for "${stageLabel(o, s)}"`, "#a-" + s);
      if (t < last) return bad("Timeline dates must be in chronological order", "#a-" + s);
      if (t > Date.now() + 60e3) return bad("Timeline dates cannot be in the future", "#a-" + s); last = t; } }
  const c = formCustomer();
  try {
    if (c && (c._new || c._changed)) { const { _new, _changed, ...rec } = c; await saveCustomer(rec); }
    const now = Date.now(); let rec;
    if (mode === "edit") {
      const prev = S.orders.find(x => x.id === FORM.id); pushUndo(prev);
      rec = await saveOrder({ ...o, customerId: c ? c.id : null }, describeEdit(prev, { ...o, customerId: c ? c.id : null }));
      toast("Order updated");
    } else {
      rec = { ...o, id: uid("o"), customerId: c ? c.id : null, createdAt: now, revs: [], log: [] };
      if (arch) { rec.createdAt = rec.hist.menunggu_dp || now; } else { rec.status = "menunggu_dp"; rec.hist = { menunggu_dp: now }; }
      rec = await saveOrder(rec, arch ? "Past order recorded" : "Order created, down payment invoice issued");
      toast(arch ? "Past order recorded" : "Order saved. Send the Down Payment Invoice to the customer.");
    }
    FORM = null; go(`order/${rec.id}`);
  } catch (e) { toast("Could not save: " + (e.message || e)); }
}
/* plain-language summary of what changed, for the activity log */
function describeEdit(a, b) {
  const ch = [];
  if (a.queue !== b.queue) ch.push(`order number ${qfmt(a.queue)} → ${qfmt(b.queue)}`);
  if (a.project !== b.project) ch.push("job description");
  if (a.customerId !== b.customerId) ch.push(`customer → ${custById(b.customerId)?.name || "none"}`);
  if (calc(a).total !== calc(b).total) ch.push(`total ${rp(calc(a).total)} → ${rp(calc(b).total)}`);
  else if (JSON.stringify(a.items) !== JSON.stringify(b.items)) ch.push("line items");
  if ((a.dpPct ?? 50) !== (b.dpPct ?? 50)) ch.push(`down payment ${a.dpPct}% → ${b.dpPct}%`);
  if (a.deadline !== b.deadline || a.dueType !== b.dueType) ch.push(`due date → ${dueText(b, 1)}`);
  if (a.date !== b.date) ch.push(`order date → ${fmtShort(b.date)}`);
  if ((a.cat || "") !== (b.cat || "")) ch.push(`category → ${b.cat || "none"}`);
  if ((a.notes || "") !== (b.notes || "")) ch.push("notes");
  if ((a.memo || "") !== (b.memo || "")) ch.push("internal memo");
  if (JSON.stringify(a.hist) !== JSON.stringify(b.hist)) ch.push("timeline");
  return ch.length ? "Edited: " + ch.join(", ") : "Saved without changes";
}
function pickPrice(onPick) {
  const draw = q => { q = q.toLowerCase().trim(); const L = [...S.prices].sort((a, b) => a.sort - b.sort).filter(p => !q || [p.code, p.name, p.cat, p.group].join(" ").toLowerCase().includes(q));
    let lastCat = ""; $("#pkList").innerHTML = L.map(p => { const h = p.cat !== lastCat ? `<div class="msec">${esc(p.cat)}</div>` : ""; lastCat = p.cat; return h + `<a data-pick="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.group || p.note || "")}</small></span><span class="pr">${priceTxt(p)}</span></a>`; }).join("") || `<p class="empty">No matching services.</p>`; };
  openSheet("Pick from Price List", `<input id="pkQ" placeholder="Search services" autocomplete="off"><nav class="mlist pick" id="pkList"></nav>`, e => { const a = e.target.closest("[data-pick]"); if (!a) return; const p = S.prices.find(x => x.id === a.dataset.pick); if (p) { onPick(p); closeSheet(); toast("Line added from the price list"); } });
  draw(""); $("#pkQ").oninput = e => draw(e.target.value);
}

/* ===================== ORDER DETAIL ===================== */
/* the WhatsApp message that goes with each timeline stage */
const STAGE_MSG = { menunggu_dp: "dp", dikerjakan: "ko", minta_lunas: "pl", lunas: "kw", selesai: "done" };
let ODOC = { id: null, kind: null };
PAGES.order = {
  title: id => { const o = S.orders.find(x => x.id === id); return o ? `Order ${qfmt(o.queue)}` : "Order"; }, nav: "orders", parent: "orders",
  render(id) {
    const o = S.orders.find(x => x.id === id); if (!o) return page("Sales · Orders", "Order not found", "", `<a class="btn" href="#/orders">Back to Orders</a>`, "");
    const c = calc(o), cu = custOf(o), batal = o.status === "batal", si = effIdx(o), owed = owedOf(o), cost = costOf(o), dups = dupMap().get(o.id) || [];
    const ks = [...docsOf(o), ...extrasOf(o).map(x => "x:" + x.id)]; if (ODOC.id !== o.id || !ks.includes(ODOC.kind)) ODOC = { id: o.id, kind: ks.includes(ST[eff(o)].doc) ? ST[eff(o)].doc : ks[ks.length - 1] };
    const h = S.hist[o.id];
    const steps = (batal ? flowOf(o).filter(s => idx(s) <= si) : flowOf(o)).map(s => { const i = idx(s), done = batal || i < si || o.status === "selesai";
      return `<li class="${done ? "done" : i === si ? "cur" : ""}"><span class="dot">${done ? ic("chk") : ""}</span><span class="lb">${stageLabel(o, s)}</span>${(done || i === si) && !batal && STAGE_MSG[s] ? `<button class="btn sm st-copy" data-o="copystage" data-k="${s}" type="button" title="Copy the WhatsApp message for this stage">${ic("copy")}Copy</button>` : ""}${at(o, s) ? `<span class="tm">${fmtDateTime(at(o, s))}</span>` : ""}</li>`; }).join("") + (batal ? `<li class="cur"><span class="dot"></span><span class="lb">Cancelled</span><span class="tm">${fmtDateTime(o.cancel && o.cancel.at)}</span></li>` : "");
    let note = "";
    if (o.status === "lunas" && at(o, "lunas")) { const r = revState(o); note = Date.now() < r.end ? `Revision period runs until ${fmtDateTime(r.end)} (${r.used}/${r.max} used).` : `The revision period ended on ${fmtDateTime(r.end)}. The order can be closed.`; }
    if (batal) { const cc = o.cancel || {}, got = o.fullPay ? c.total : c.dp; note = [cc.reason ? `Reason: ${esc(cc.reason)}.` : "", cc.rule === "refund" ? `The payment of ${rp(got)} was refunded.` : cc.rule === "hangus" ? `The payment of ${rp(got)} was forfeited under the terms.` : "No payment had been received."].filter(Boolean).join(" "); }
    if (isLate(o)) note = `Overdue: the due date was ${dueText(o)}.`;
    const nextBtn = actOf(o) ? `<button class="btn primary" data-o="next" type="button">${actOf(o)}</button>` : "";
    const fullBtn = o.status === "menunggu_dp" ? `<button class="btn" data-o="full" type="button">Confirm Full Payment Received</button>` : "";
    const status = panel("Status", `<ol class="steps">${steps}</ol>${note ? `<div class="note${isLate(o) ? " warn" : ""}">${note}</div>` : ""}${nextBtn || fullBtn ? `<div class="stack-s">${nextBtn}${fullBtn}</div>` : ""}`,
      { right: `<button class="ib" data-o="undo" type="button" title="Undo last change" aria-label="Undo" ${h && h.u.length ? "" : "disabled"}>${ic("undo")}</button><button class="ib" data-o="redo" type="button" title="Redo" aria-label="Redo" ${h && h.r.length ? "" : "disabled"}>${ic("redo")}</button><button class="ib" data-o="timeline" type="button" title="Edit timeline" aria-label="Edit timeline">${ic("edit")}</button>` });
    const summary = panel("Summary", `<dl class="kv">
      <dt>Customer</dt><dd>${cu ? `<a href="#/customer/${esc(cu.id)}">${esc(cu.name)}</a>` : `<button class="linkbtn" data-o="setcust" type="button">Add customer</button>`}</dd>
      <dt>WhatsApp</dt><dd>${cu?.phone ? `<a href="${waLink(cu.phone)}" target="_blank" rel="noopener">${esc(cu.phone)}</a>` : "-"}</dd>
      <dt>Order Date</dt><dd>${fmtDate(o.date)}</dd><dt>Due Date</dt><dd class="${isLate(o) ? "due" : ""}">${dueText(o)}</dd>
      <dt>Category</dt><dd>${esc(o.cat || "-")}</dd><dt>Source</dt><dd>${esc(o.source || "-")}</dd>
      <div class="sep"></div>
      <dt>${extrasOf(o).length ? "Original Order" : "Total"}</dt><dd>${o.noAmount ? "Not recorded" : rp(c.total)}</dd>
      ${extrasOf(o).length ? `<dt>Revisions &amp; Add-ons (${extrasOf(o).length})</dt><dd>${rp(extraTotal(o))}</dd><dt>Grand Total</dt><dd><b>${rp(grandTotal(o))}</b></dd>` : ""}
      ${o.fullPay ? `<dt>Payment Terms</dt><dd>Paid in full</dd>` : c.dp ? `<dt>Down Payment (${c.pct}%)</dt><dd>${rp(c.dp)}</dd>` : `<dt>Payment Terms</dt><dd>Payable on completion</dd>`}
      <dt>${batal ? "Net Received" : "Amount Paid"}</dt><dd>${rp(paidOf(o))}</dd><dt>Balance Due</dt><dd class="${owed ? "due" : ""}">${rp(owed)}</dd>
      ${extraOwed(o) ? `<dt>Of which unpaid add-ons</dt><dd class="due">${rp(extraOwed(o))}</dd>` : ""}
      ${cost ? `<div class="sep"></div><dt>Costs (internal)</dt><dd>${rp(cost)}</dd><dt>Gross Margin</dt><dd>${rp(grandTotal(o) - cost)} · ${grandTotal(o) ? num((grandTotal(o) - cost) / grandTotal(o) * 100, 0) : 0}%</dd>` : ""}
      </dl>`, { right: `<a class="ib" href="#/edit/${esc(o.id)}" title="Edit order" aria-label="Edit order">${ic("edit")}</a>` });
    const pslots = [["dp", o.fullPay ? "Full Payment" : "Down Payment"], ...(si >= idx("minta_lunas") && !o.fullPay ? [["pl", "Final Payment"]] : [])];
    const proofs = panel("Proof of Payment", pslots.map(([k, l]) => { const p = (o.proofs || {})[k];
      return `<div class="proof">${p ? `<button type="button" class="th" data-o="viewproof" data-k="${k}" aria-label="View ${l} proof"><img data-file="${esc(p.fileId)}" alt=""></button>` : `<span class="th">None</span>`}<div><b>${l}</b><span>${p ? `Uploaded ${fmtDateTime(p.at)}` : "No proof attached"}</span></div><div class="row">${p ? `<button class="ib" data-o="delproof" data-k="${k}" type="button" title="Remove" aria-label="Remove proof">${ic("trash")}</button>` : ""}<button class="btn" data-o="proof" data-k="${k}" type="button">${p ? "Replace" : "Upload"}</button></div></div>`; }).join(""));
    const r = revState(o);
    const revs = batal ? "" : panel("Revisions &amp; Add-ons", `<div class="meter-txt"><span>Free minor revisions used <b>${r.used}/${r.max}</b></span>${r.end ? `<span>Until <b>${fmtDateTime(r.end)}</b></span>` : ""}</div>
      ${(o.revs || []).map((v, i) => { const t = REV_TYPE[v.type || "minor"], paid = t.paid && v.fee > 0;
        return `<div class="rev-item t-${v.type || "minor"}"><span class="badge ${paid ? (v.paidAt ? "b-ok" : "b-menunggu_dp") : "b-gry"}">${t.short}</span><div>${esc(v.note || "-")}<span>${fmtDateTime(v.at)}${paid ? ` · ${rp(v.fee)} · ${v.paidAt ? `paid ${fmtShort(v.paidAt)}` : "<b class='over'>unpaid</b>"}` : " · free"}</span></div>
          <div class="row">${paid && !v.paidAt ? `<button class="btn sm" data-o="payx" data-i="${i}" type="button">Mark Paid</button>` : ""}<button class="ib" data-o="editrev" data-i="${i}" type="button" aria-label="Edit">${ic("edit")}</button></div></div>`; }).join("") || `<p class="hint">Nothing recorded yet. Minor revisions are free; major revisions and additions within the same scope are charged on top of the order.</p>`}
      ${r.why && o.status !== "lunas" ? "" : r.why ? `<p class="hint">${r.why} Paid changes can still be added.</p>` : ""}
      <div class="row btns"><button class="btn" data-o="addrev" data-t="minor" type="button">${ic("plus")}Minor Revision (Free)</button><button class="btn" data-o="addrev" data-t="major" type="button">${ic("plus")}Major Revision (Paid)</button><button class="btn primary" data-o="addrev" data-t="addon" type="button">${ic("plus")}Add Extra Work (Paid)</button></div>`);
    const exps = S.expenses.filter(x => x.orderId === o.id).sort((a, b) => String(b.date).localeCompare(a.date));
    const expP = panel("Costs", `${exps.map(x => `<button class="li" data-o="exp" data-id="${esc(x.id)}" type="button"><span><b>${esc(x.cat)}</b><small>${fmtShort(x.date)}${x.note ? " · " + esc(x.note) : ""}</small></span><span class="m">${rp(x.amount)}</span></button>`).join("") || `<p class="hint">No costs recorded for this order.</p>`}<button class="btn" data-o="addexp" type="button">${ic("plus")}Record Cost</button>`);
    const memo = panel("Internal Memo", `<textarea id="o-memo" placeholder="Only visible to you">${esc(o.memo || "")}</textarea><p class="hint" id="memoState">Saved automatically.</p>`);
    const log = panel("Activity", (o.log || []).length ? `<ul class="feed">${[...o.log].reverse().slice(0, 30).map(l => `<li><span class="ft">${esc(l.text)}</span><span>${fmtShort(l.at)}, ${fmtTime(l.at)}</span></li>`).join("")}</ul>` : `<p class="hint">No changes recorded yet.</p>`);
    const more = [`<a class="btn" href="#/edit/${esc(o.id)}">${ic("edit")}Edit Order</a>`, `<button class="btn" data-o="dupl" type="button">${ic("dup")}Duplicate as New Order</button>`];
    if (batal) more.push(`<button class="btn" data-o="restore" type="button">Restore Order</button>`);
    else { if (prevOf(o)) more.push(`<button class="btn" data-o="back" type="button">Revert to Previous Status</button>`); if (idx(o.status) < idx("lunas")) more.push(`<button class="btn danger" data-o="cancel" type="button">Cancel Order</button>`); }
    if (batal) more.push(`<button class="btn" data-o="editcancel" type="button">Edit Cancellation</button>`);
    more.push(`<button class="btn danger" data-o="del" type="button">${ic("trash")}Delete Order</button>`);
    const docLabel = k => { const x = extraOfKind(o, k); return x ? `${REV_TYPE[x.type].short} ${extrasOf(o).indexOf(x) + 1} ${x.paidAt ? "Receipt" : "Invoice"}` : DOC[k].title; };
    const docs = panel("Customer Documents", `<div class="seg">${ks.map(k => `<button type="button" data-o="doc" data-k="${k}" aria-pressed="${k === ODOC.kind}">${docLabel(k)}</button>`).join("")}</div>
      ${ks.length ? `<div class="nota-frame" id="oFrame"></div>
      <div class="row btns"><button class="btn primary" data-o="png" type="button">${ic("dl")}Download PNG</button><button class="btn" data-o="pdf" type="button">${ic("dl")}Download PDF</button><button class="btn" data-o="share" type="button">${ic("wa")}Send via WhatsApp</button><button class="btn" data-o="copy" type="button">${ic("copy")}Copy Message</button></div>
      <p class="hint">On a phone, Send via WhatsApp shares the PNG together with the message. On a computer it opens the chat with the message; attach the downloaded PNG.</p>` : `<p class="hint">No documents for this order.</p>`}`);
    return page("Sales · Orders", `Order ${qfmt(o.queue)}`, `${esc(o.project || "")}`, `${badge(o.status)}${o.archived ? ` <span class="badge b-gry">Past order</span>` : ""}`, `
      ${dups.length ? `<div class="alertbar"><b>Duplicate order number.</b> ${qfmt(o.queue)} is also used by ${dups.map(x => `<a href="#/order/${esc(x.id)}">${esc(x.project || "another order")}</a>`).join(", ")}.</div>` : ""}
      <div class="grid g-detail g-order">
        <div class="stack">${docs}${ks.length || o.status === "selesai" ? panel("WhatsApp Message", `<div class="wa-box" id="oWa"></div>`) : ""}${memo}${log}</div>
        <div class="stack">${status}${summary}${assignPanel(o)}${proofs}${revs}${expP}${panel(null, `<div class="row btns">${more.join("")}</div>`)}</div>
      </div>`);
  },
  after(id) {
    const o = S.orders.find(x => x.id === id); if (!o) return;
    if ($("#oFrame")) mountNota($("#oFrame"), o, ODOC.kind);
    if ($("#oWa")) waMount($("#oWa"), { order: o, kind: ODOC.kind });
    $$("img[data-file]").forEach(async i => { const u = await fileUrl(i.dataset.file); if (u) i.src = u; });
    let t = 0; $("#o-memo").oninput = e => { clearTimeout(t); $("#memoState").textContent = "Saving…"; t = setTimeout(async () => { const cur = S.orders.find(x => x.id === id); await Store.put("orders", { ...cur, memo: e.target.value.trim(), updatedAt: Date.now() }); $("#memoState").textContent = "Saved automatically."; }, 600); };
    $("#main").onclick = e => { const b = e.target.closest("[data-o]"); if (b) orderAction(b.dataset.o, b, id); };
  }
};
/* apply a change to the open order with undo, log and re-render */
async function commit(prev, next, msg, logText) {
  pushUndo(prev);
  try { await saveOrder(next, logText || msg); refresh(); toast(msg, () => stepHist(prev.id, -1)); return true; }
  catch (e) { S.hist[prev.id].u.pop(); toast("Could not save: " + (e.message || e)); return false; }
}
async function stepHist(id, dir) {
  const h = histOf(id), from = dir < 0 ? h.u : h.r, to = dir < 0 ? h.r : h.u; if (!from.length) return;
  const cur = S.orders.find(x => x.id === id), p = from.pop(); to.push(strip(cur)); Store.meta("hist", S.hist);
  await saveOrder(p, dir < 0 ? "Change undone" : "Change redone"); refresh(); toast(dir < 0 ? "Change undone" : "Change redone");
}
function withStatus(o, s, extra = {}) {
  const n = { ...o, ...extra, status: s, hist: { ...o.hist } };
  if (idx(s) > idx(o.status)) n.hist[s] = Date.now();
  else { FLOW.slice(idx(s) + 1).forEach(x => delete n.hist[x]); if (s === "menunggu_dp") { delete n.fullPay; delete n.dpPaid; } }
  return n;
}
async function orderAction(a, b, id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const k = b.dataset.k;
  if (a === "doc") { ODOC.kind = k; refresh(); return; }
  if (a === "undo") return stepHist(id, -1);
  if (a === "redo") return stepHist(id, 1);
  if (a === "next" && o.status === "menunggu_dp" && calc(o).asked > 0) return dpSheet(o);
  if (a === "next") { const n = nextOf(o); if (!n) return; b.disabled = true; const nx = withStatus(o, n); ODOC.kind = ST[n].doc; return commit(o, nx, n === "selesai" ? "Order closed" : `Status: ${ST[n].label}`); }
  if (a === "full") { b.disabled = true; ODOC.kind = "ko"; return commit(o, withStatus(o, "dikerjakan", { fullPay: true }), "Full payment recorded"); }
  if (a === "back") { const p = prevOf(o); if (await confirmSheet("Revert status", `Revert the status to "${ST[p].label}"? The date of the current stage will be removed from the timeline.`, "Revert")) commit(o, withStatus(o, p), "Status reverted", `Status reverted to ${ST[p].label}`); return; }
  if (a === "restore") { const n = { ...o, status: o.cancel?.from || "menunggu_dp", hist: { ...o.hist } }; delete n.hist.batal; delete n.cancel; return commit(o, n, "Order restored"); }
  if (a === "cancel" || a === "editcancel") return cancelSheet(o, a === "editcancel");
  if (a === "del") { if (await confirmSheet("Delete order", `Permanently delete order ${qfmt(o.queue)} (${esc(o.project)})? Linked costs stay in Expenses without an order.`, "Delete", true)) { await deleteOrder(id); toast("Order deleted"); go("orders"); } return; }
  if (a === "dupl") { window.__dupl = o; go("new"); return; }
  if (a === "timeline") return timelineSheet(o);
  if (a === "copystage") return copyText(waText(o, STAGE_MSG[k]), `Message copied: ${stageLabel(o, k)}`);
  if (a === "setcust") { go(`edit/${id}`); return; }
  if (a === "png" || a === "pdf" || a === "share" || a === "copy") {
    if (a === "copy") return copyText(waText(o, ODOC.kind), "Message copied");
    b.disabled = true;
    try {
      if (a === "png") await notaPng(o, ODOC.kind);
      if (a === "pdf") await notaPdf(o, ODOC.kind);
      if (a === "share") { const shared = matchMedia("(pointer:coarse)").matches && await notaShare(o, ODOC.kind); if (!shared) window.open(waLink(clientPhone(o), waText(o, ODOC.kind)), "_blank", "noopener"); }
    } catch (e) { toast(e.message || "Could not create the document"); } finally { b.disabled = false; }
    return;
  }
  if (a === "proof") {
    const f = await pickFile("image/*,application/pdf"); if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast("Maximum file size is 20 MB");
    try { const fid = await Store.saveFile(f, f.name); const old = (o.proofs || {})[k]; const n = { ...o, proofs: { ...(o.proofs || {}), [k]: { fileId: fid, type: f.type, name: f.name, at: Date.now() } } };
      await commit(o, n, "Proof of payment saved"); if (old) Store.delFile(old.fileId); } catch (e) { toast(e.message || "Could not save the file"); }
    return;
  }
  if (a === "delproof") { if (!await confirmSheet("Remove proof", "Remove this proof of payment?", "Remove", true)) return; const n = { ...o, proofs: { ...(o.proofs || {}) } }; delete n.proofs[k]; return commit(o, n, "Proof removed"); }
  if (a === "viewproof") { const p = o.proofs[k]; const u = await fileUrl(p.fileId); if (!u) return toast("File not found on this device");
    if (p.type === "application/pdf") { window.open(u, "_blank"); return; }
    openSheet(p.name || "Proof of payment", `<img class="proof-big" src="${u}" alt=""><a class="btn" href="${u}" download="${esc(p.name || "proof")}">${ic("dl")}Download</a>`); return; }
  if (a === "addrev" || a === "editrev") return revSheet(o, a === "editrev" ? Number(b.dataset.i) : -1, b.dataset.t);
  if (a === "payx") { const i = Number(b.dataset.i), v = o.revs[i]; const revs = o.revs.map((x, j) => j === i ? { ...x, paidAt: Date.now() } : x); ODOC.kind = "x:" + v.id;
    return commit(o, { ...o, revs }, `${REV_TYPE[v.type].short} payment recorded`, `${REV_TYPE[v.type].short} paid: ${rp(v.fee)} (${v.note})`); }
  if (a === "addexp") return editExp(null, o);
  if (a === "assign") return assignSheet(o);
  if (a === "paywk") { if (await confirmSheet("Pay worker", `Record a payment of ${rp(o.assign.fee)} to ${esc(workerById(o.assign.workerId)?.name)} today? It is added to Expenses as Worker Pay.`, "Record Payment")) { await payWorker(o); refresh(); toast("Worker payment recorded"); } return; }
  if (a === "exp") return editExp(S.expenses.find(x => x.id === b.dataset.id));
}
/* confirming the down payment asks what actually came in: customers sometimes pay more (or less) than asked.
   A different amount is kept as dpPaid, so the confirmation, receipt, final invoice and reports use the real figure;
   the full amount (or more) counts as paid in full. */
function dpSheet(o) {
  const c = calc(o);
  openSheet(`Confirm Down Payment · Order ${qfmt(o.queue)}`, `<div class="fg">${field("Amount Received (Rp)", `<input id="dpAmt" class="money" inputmode="numeric" maxlength="17" value="${money(c.asked)}">`, "full")}</div>
    <p class="hint" id="dpInfo"></p>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Confirm Payment</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
      if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
      const amt = toNum($("#dpAmt").value); if (!amt) return toast("Enter the amount received");
      closeSheet(); ODOC.kind = "ko";
      if (amt >= c.total) return commit(o, withStatus(o, "dikerjakan", { fullPay: true }), "Full payment recorded", `Full payment received: ${rp(amt)}`);
      const n = withStatus(o, "dikerjakan"); if (amt !== c.asked) n.dpPaid = amt; else delete n.dpPaid;
      commit(o, n, `Down payment recorded: ${rp(amt)}`, `Down payment received: ${rp(amt)}${amt !== c.asked ? ` (asked ${rp(c.asked)})` : ""}`);
    });
  const info = () => { const a = toNum($("#dpAmt").value);
    $("#dpInfo").textContent = !a ? `Asked: ${rp(c.asked)} (${c.askedPct}%).` : a >= c.total ? `This covers the full ${rp(c.total)}: the order will be marked as paid in full.`
      : `Asked: ${rp(c.asked)} (${c.askedPct}%). Received ${rp(a)} = ${num(a / c.total * 100, 1)}%, balance after this: ${rp(c.total - a)}.${a > c.asked ? " The extra counts toward the balance." : a < c.asked ? " Less than asked: the rest moves to the final payment." : ""}`; };
  $("#dpAmt").oninput = info; info();
}
function cancelSheet(o, editing) {
  const paid = effIdx(o) >= idx("dikerjakan"), cc = o.cancel || {};
  openSheet(editing ? "Edit Cancellation" : `Cancel Order ${qfmt(o.queue)}`, `<div class="fg">
    ${field("Reason", `<input id="cxReason" value="${esc(cc.reason || "")}" placeholder="e.g. Cancelled by the customer">`, "full")}
    ${editing ? field("Cancelled On", `<input id="cxAt" type="datetime-local" value="${toLocal(cc.at)}">`, "full") : ""}
    ${paid ? `<div class="full stack-s"><label class="radio"><input type="radio" name="cxRule" value="hangus" ${cc.rule !== "refund" ? "checked" : ""}>Payment of ${rp(paidOf({ ...o, status: o.cancel?.from || o.status }))} is forfeited</label><label class="radio"><input type="radio" name="cxRule" value="refund" ${cc.rule === "refund" ? "checked" : ""}>Payment is refunded to the customer</label></div>` : ""}
  </div><div class="row btns"><button class="btn danger-solid" data-a="ok" type="button">${editing ? "Save" : "Cancel Order"}</button><button class="btn" data-close type="button">Back</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    const now = Date.now(), rule = paid ? ($('input[name="cxRule"]:checked') || {}).value || "hangus" : null;
    const when = editing ? fromLocal($("#cxAt").value) || cc.at : now;
    const n = { ...o, status: "batal", hist: { ...o.hist, batal: when }, cancel: { at: when, from: editing ? cc.from : o.status, reason: $("#cxReason").value.trim(), rule } };
    closeSheet(); commit(o, n, editing ? "Cancellation updated" : "Order cancelled");
  });
}
/* edit every stage date, the payment type and the current status of any order */
function timelineSheet(o) {
  const rows = () => { const full = $("#tl-type").value === "full", st = $("#tl-status").value, fl = full ? FLOW.filter(s => s !== "minta_lunas") : FLOW;
    $("#tl-status").innerHTML = fl.map(s => `<option value="${s}">${ST[s].label}</option>`).join(""); $("#tl-status").value = fl.includes(st) ? st : fl[fl.length - 1];
    const cur = $("#tl-status").value;
    $$("#tlRows [data-st]").forEach(l => { const s = l.dataset.st; l.hidden = !fl.includes(s) || idx(s) > idx(cur); l.querySelector("span").textContent = STAGE_LABEL[s][full ? 1 : 0] || ST[s].label; }); };
  openSheet(`Timeline · Order ${qfmt(o.queue)}`, `<p class="hint">Correct any date or the current status. Documents, reports and the dashboard follow these dates.</p>
    <div class="fg">${field("Payment Type", `<select id="tl-type">${sel([["dp", "Down payment, then final payment"], ["full", "Paid in full upfront"]], o.fullPay ? "full" : "dp")}</select>`)}
    ${field("Current Status", `<select id="tl-status">${o.status === "batal" ? "" : `<option value="${o.status}">${ST[o.status].label}</option>`}</select>`)}</div>
    <div class="fg" id="tlRows">${FLOW.map(s => `<label data-st="${s}"><span></span><input type="datetime-local" id="tl-${s}" value="${toLocal(at(o, s))}"></label>`).join("")}</div>
    ${o.status === "batal" ? `<p class="hint">This order is cancelled. Restore it first to change its status.</p>` : ""}
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save Timeline</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    const full = $("#tl-type").value === "full", status = o.status === "batal" ? "batal" : $("#tl-status").value, fl = full ? FLOW.filter(s => s !== "minta_lunas") : FLOW;
    const upto = status === "batal" ? effIdx(o) : idx(status), hist = {}; let last = 0;
    for (const s of fl.filter(x => idx(x) <= upto)) { const t = fromLocal($("#tl-" + s).value);
      if (!t) { toast(`Enter the date for "${STAGE_LABEL[s][full ? 1 : 0] || ST[s].label}"`); $("#tl-" + s).focus(); return; }
      if (t < last) { toast("Dates must be in chronological order"); $("#tl-" + s).focus(); return; } last = t; hist[s] = t; }
    if (o.hist.batal) hist.batal = o.hist.batal;
    const n = { ...o, status, hist }; if (full) n.fullPay = true; else delete n.fullPay;
    closeSheet(); commit(o, n, "Timeline updated");
  }, { noFocus: true });
  if (o.status === "batal") { $("#tl-status").disabled = true; $("#tl-type").disabled = true; $$("#tlRows [data-st]").forEach(l => { const s = l.dataset.st; l.hidden = !flowOf(o).includes(s) || idx(s) > effIdx(o); l.querySelector("span").textContent = stageLabel(o, s); }); }
  else { rows(); $("#tl-type").onchange = rows; $("#tl-status").onchange = rows; }
}
/* one entry on the same order: minor revision (free), major revision (paid) or additional work (paid) */
function revSheet(o, i, type) {
  const v = i >= 0 ? { type: "minor", fee: 0, paidAt: null, ...o.revs[i] } : { id: uid("r"), at: Date.now(), note: "", type: type || "minor", fee: 0, paidAt: null }, r = revState(o);
  const ph = { minor: "e.g. Fix the reference list format", major: "e.g. Rewrite chapter 2 following the new supervisor's direction", addon: "e.g. Add 5 more pages to the discussion, same topic" };
  openSheet(i >= 0 ? REV_TYPE[v.type].label : `Record ${REV_TYPE[v.type].label}`, `
    ${i < 0 && v.type === "minor" && r.why ? `<div class="note warn">${r.why} Consider recording it as a major revision.</div>` : ""}
    <div class="fg">
      ${field("Type", `<select id="rvType">${sel(Object.entries(REV_TYPE).map(([k, t]) => [k, `${t.label}${t.paid ? " (paid)" : " (free)"}`]), v.type)}</select>`, "full")}
      ${field("What the customer asked for", `<textarea id="rvNote" placeholder="${ph[v.type]}">${esc(v.note)}</textarea>`, "full")}
      <label class="paid-only"><span>Fee (Rp)</span><input id="rvFee" class="money" inputmode="numeric" maxlength="15" value="${money(v.fee)}" placeholder="0"></label>
      ${field("Requested On", `<input id="rvAt" type="datetime-local" value="${toLocal(v.at)}">`)}
      <label class="paid-only"><span>Payment</span><select id="rvPaid">${sel([["0", "Not paid yet"], ["1", "Paid"]], v.paidAt ? "1" : "0")}</select></label>
      <label class="paid-only" id="rvPaidAtW"><span>Paid On</span><input id="rvPaidAt" type="datetime-local" value="${toLocal(v.paidAt || Date.now())}"></label>
    </div>
    <p class="hint paid-only">The fee is added on top of the original order and gets its own invoice and receipt. The order's earlier payments stay as they were. A different title, topic or focus should be a new order instead.</p>
    <p class="hint" id="rvPick"><button class="linkbtn" data-a="pick" type="button">Take the fee from the price list</button></p>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button>${i >= 0 ? `<button class="btn danger" data-a="del" type="button">Delete</button>` : `<button class="btn" data-close type="button">Cancel</button>`}</div>`, async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "pick") return pickPrice(p => { const back = { t: $("#rvType").value, n: $("#rvNote").value }; revSheet(o, i, back.t); $("#rvNote").value = back.n || p.name; $("#rvFee").value = money(p.price); sync(); });
    const revs = [...(o.revs || [])];
    if (a === "del") { revs.splice(i, 1); closeSheet(); return commit(o, { ...o, revs }, `${REV_TYPE[v.type].short} deleted`); }
    const t = $("#rvType").value, paidKind = REV_TYPE[t].paid, note = $("#rvNote").value.trim(), fee = paidKind ? toNum($("#rvFee").value) : 0;
    if (!note) return toast("Describe what the customer asked for");
    if (paidKind && !fee) return toast("Enter the fee, or record it as a minor revision");
    if (fee > MAX_PRICE) return toast(`Fee may not exceed ${rp(MAX_PRICE)}`);
    const paidAt = paidKind && $("#rvPaid").value === "1" ? fromLocal($("#rvPaidAt").value) || Date.now() : null;
    const rec = { id: v.id || uid("r"), type: t, note, fee, paidAt, at: fromLocal($("#rvAt").value) || Date.now() };
    if (i >= 0) revs[i] = rec; else revs.push(rec); revs.sort((x, y) => x.at - y.at);
    if (paidKind) ODOC.kind = "x:" + rec.id;
    closeSheet(); commit(o, { ...o, revs }, i >= 0 ? `${REV_TYPE[t].short} updated` : `${REV_TYPE[t].label} recorded${fee ? ` (${rp(fee)})` : ""}`,
      `${i >= 0 ? "Updated" : "Recorded"} ${REV_TYPE[t].label.toLowerCase()}: ${note}${fee ? `, ${rp(fee)}${paidAt ? ", paid" : ", unpaid"}` : ""}`);
  }, { noFocus: true });
  const sync = () => { const paidKind = REV_TYPE[$("#rvType").value].paid; $$("#sheet .paid-only").forEach(x => x.hidden = !paidKind); $("#rvPick").hidden = !paidKind; $("#rvPaidAtW").hidden = !paidKind || $("#rvPaid").value !== "1"; $("#rvNote").placeholder = ph[$("#rvType").value]; };
  $("#rvType").onchange = sync; $("#rvPaid").onchange = sync; sync();
}
/* "Duplicate as New Order": the new-order page picks this up once */
const _newRender = PAGES.new.render;
PAGES.new.render = function (cid) {
  const html = _newRender(cid);
  if (window.__dupl) { const d = window.__dupl; window.__dupl = null; Object.assign(FORM.base, { project: d.project, customerId: d.customerId, items: JSON.parse(JSON.stringify(d.items || [])), cat: d.cat, source: d.source, notes: d.notes, discount: d.discount, dpPct: d.dpPct ?? S.settings.dpPct }); return formHtml(); }
  return html;
};

/* ===================== CALENDAR ===================== */
const CAL = { y: null, m: 0, sel: null, scope: "act" };
PAGES.calendar = {
  title: "Calendar", nav: "calendar",
  render() {
    if (CAL.y === null) { const d = new Date(); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); }
    const all = CAL.scope === "all", ev = new Map();
    S.orders.forEach(o => { if (!o.deadline || o.status === "batal" || (!all && !isActive(o))) return; const k = String(o.deadline).slice(0, 10); if (!ev.has(k)) ev.set(k, []); ev.get(k).push(o); });
    ev.forEach(L => L.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)) || toNum(a.queue) - toNum(b.queue)));
    const first = new Date(CAL.y, CAL.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(CAL.y, CAL.m + 1, 0).getDate(), today = todayISO();
    const cls = o => (isLate(o) ? " late" : idx(o.status) >= idx("minta_lunas") ? " done" : "") + (o.dueType && o.dueType !== "exact" ? " est" : "");
    let g = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<div class="dow">${x}</div>`).join("");
    for (let i = 0; i < Math.ceil((lead + days) / 7) * 7; i++) { const d = new Date(CAL.y, CAL.m, 1 - lead + i), k = isoDate(d), L = ev.get(k) || [];
      g += `<button type="button" class="d${d.getMonth() !== CAL.m ? " out" : ""}${k === today ? " today" : ""}${k === CAL.sel ? " sel" : ""}" data-day="${k}" aria-label="${fmtDate(k)}${L.length ? `, ${plural(L.length, "order")} due` : ""}"><span class="n">${d.getDate()}</span>${L.slice(0, 2).map(o => `<span class="ev${cls(o)}">${qfmt(o.queue)}</span>`).join("")}${L.length > 2 ? `<span class="more">+${L.length - 2}</span>` : ""}</button>`; }
    const mk = `${CAL.y}-${pad(CAL.m + 1)}`;
    const list = CAL.sel ? (ev.get(CAL.sel) || []) : [...ev.entries()].filter(([k]) => k.startsWith(mk)).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, L]) => L);
    const rows = list.map(o => { const lt = isLate(o); return `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="wide">${badge(o.status)}</td><td class="r dl${lt ? " over" : ""}">${dueText(o, 1)}</td></tr>`; }).join("");
    return page("Sales", "Calendar", "Due dates of your orders", `<select id="calScope" class="auto">${sel([["act", "Active orders"], ["all", "All orders"]], CAL.scope)}</select>`, `
      ${panel(`${MONTHS[CAL.m]} ${CAL.y}`, `<div class="cal">${g}</div><div class="legend"><span><i class="ev"></i>In progress</span><span><i class="ev late"></i>Overdue</span><span><i class="ev done"></i>Delivered</span><span><i class="ev est"></i>Estimated date</span></div>`,
        { right: `<button class="btn sm" data-c="today" type="button">Today</button><button class="ib" data-c="prev" type="button" aria-label="Previous month">${ic("left")}</button><button class="ib" data-c="next" type="button" aria-label="Next month">${ic("right")}</button>` })}
      ${panel(CAL.sel ? `Due on ${fmtDate(CAL.sel)}` : `Due in ${MONTHS[CAL.m]} ${CAL.y}`, `<table class="dt"><tbody>${rows || emptyRow(4, CAL.sel ? "Nothing is due on this day." : "Nothing is due this month.")}</tbody></table>`,
        { flush: true, right: `<span class="hint">${list.length ? plural(list.length, "order") : ""}</span>${CAL.sel ? `<button class="btn link" data-c="all" type="button">Whole month</button>` : ""}` })}`);
  },
  after() {
    $("#calScope").onchange = e => { CAL.scope = e.target.value; refresh(); };
    $("#main").onclick = e => {
      const d = e.target.closest("[data-day]"); if (d) { const k = d.dataset.day; CAL.sel = CAL.sel === k ? null : k; if (CAL.sel) { const x = toDate(k); CAL.y = x.getFullYear(); CAL.m = x.getMonth(); } refresh(); return; }
      const c = e.target.closest("[data-c]")?.dataset.c; if (!c) return;
      if (c === "prev" || c === "next") { const x = new Date(CAL.y, CAL.m + (c === "next" ? 1 : -1), 1); CAL.y = x.getFullYear(); CAL.m = x.getMonth(); CAL.sel = null; }
      if (c === "today") { CAL.y = null; CAL.sel = todayISO(); }
      if (c === "all") CAL.sel = null;
      refresh();
    };
  }
};
