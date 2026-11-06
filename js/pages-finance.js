/* MINDBYTE Order System: Monthly Report, Insights (charts), Expenses. */
"use strict";

const monthExp = k => S.expenses.filter(x => String(x.date || "").startsWith(k)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
const expOrder = x => x.orderId ? S.orders.find(o => o.id === x.orderId) : null;
const expByMonth = () => { const m = new Map(); S.expenses.forEach(x => { const k = String(x.date || "").slice(0, 7); if (k) m.set(k, (m.get(k) || 0) + (x.amount || 0)); }); return m; };

/* ===================== MONTHLY REPORT ===================== */
let REP_M = null;
function repData(k) {
  const [y, m] = k.split("-").map(Number);
  const rcv = []; S.orders.forEach(o => receipts(o).forEach(r => { if (monthKey(r.at) === k) rcv.push({ ...r, o }); })); rcv.sort((a, b) => a.at - b.at);
  const ord = S.orders.filter(o => String(o.date || "").startsWith(k)).sort((a, b) => toNum(a.queue) - toNum(b.queue));
  const done = S.orders.filter(o => at(o, "lunas") && monthKey(at(o, "lunas")) === k).length;
  const cancelled = S.orders.filter(o => o.status === "batal" && o.cancel && o.cancel.at && monthKey(o.cancel.at) === k).length;
  const inc = sum(rcv, r => r.amount), exp = monthExp(k), expTot = sum(exp, x => x.amount);
  const days = new Date(y, m, 0).getDate(), daily = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), value: 0 }));
  rcv.forEach(r => { daily[new Date(r.at).getDate() - 1].value += r.amount; });
  daily.forEach(d => d.tip = `${d.label} ${MONTHS[m - 1].slice(0, 3)}: ${rp(d.value)}`);
  return { k, label: monthLabel(k), rcv, ord, done, cancelled, inc, exp, expTot, net: inc - expTot, nilai: sum(ord.filter(o => o.status !== "batal"), o => grandTotal(o)), owed: sum(S.orders.filter(isActive), owedOf), daily };
}
PAGES.reports = {
  title: "Monthly Report", nav: "reports",
  render() {
    REP_M = REP_M || todayISO().slice(0, 7);
    const r = repData(REP_M);
    const [y, m] = REP_M.split("-").map(Number), prevK = monthKey(new Date(y, m - 2, 1)), nextK = monthKey(new Date(y, m, 1));
    const pr = repData(prevK), d = pr.inc ? Math.round((r.inc - pr.inc) / pr.inc * 100) : null;
    return page("Finance", "Monthly Report", `Period: ${r.label}`, `<button class="ib" data-r="prev" type="button" aria-label="Previous month">${ic("left")}</button><input id="repMonth" type="month" class="auto" value="${REP_M}"><button class="ib" data-r="next" type="button" aria-label="Next month" ${nextK > todayISO().slice(0, 7) ? "disabled" : ""}>${ic("right")}</button><button class="btn" data-r="xlsx" type="button">${ic("dl")}Excel</button>`, `
      <div class="kpis k3">
        ${kpi("Cash Received", rp(r.inc), d === null ? plural(r.rcv.length, "transaction") : `${d >= 0 ? "+" : ""}${d}% vs ${MONTHS[(m + 10) % 12].slice(0, 3)}`, d !== null && d < 0 ? "down" : d > 0 ? "up" : "")}
        ${kpi("New Orders", r.ord.length, `worth ${rp(r.nilai)}`)}
        ${kpi("Paid Orders", r.done, `${r.cancelled} cancelled`)}
        ${kpi("Expenses", rp(r.expTot), plural(r.exp.length, "entry", "entries"))}
        ${kpi("Net Profit", rp(r.net), r.inc ? `${num(r.net / r.inc * 100, 0)}% margin` : "receipts minus expenses", r.net < 0 ? "alert" : "")}
        ${kpi("Unpaid Now", rp(r.owed), "all active orders")}
      </div>
      ${panel("Cash Received per Day", colChart(r.daily, { maxLabels: 16, label: "Cash received per day", height: 160 }))}
      <div class="grid g-2">
        ${panel("Cash Receipts", `<table class="dt"><tbody>${r.rcv.map(x => `<tr data-href="order/${esc(x.o.id)}"><td class="no">${qfmt(x.o.queue)}</td><td><div class="nm">${x.kind}</div><div class="sub">${esc(clientName(x.o) || x.o.project || "")} · ${fmtShort(x.at)}</div></td><td class="r${x.amount < 0 ? " over" : ""}">${rp(x.amount)}</td></tr>`).join("") || emptyRow(3, "No receipts in this period.")}</tbody></table>`, { flush: true, right: `<span class="hint">${r.rcv.length ? rp(r.inc) : ""}</span>` })}
        ${panel("New Orders", `<table class="dt"><tbody>${r.ord.map(o => `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r">${o.noAmount ? "-" : rp(grandTotal(o))}</td></tr>`).join("") || emptyRow(3, "No orders in this period.")}</tbody></table>`, { flush: true, right: `<span class="hint">${r.ord.length ? plural(r.ord.length, "order") : ""}</span>` })}
      </div>
      ${panel("Expenses", `<table class="dt"><tbody>${r.exp.map(x => `<tr data-exp="${esc(x.id)}"><td class="no">${fmtShort(x.date).split(" ").slice(0, 2).join(" ")}</td><td><div class="nm">${esc(x.cat)}</div><div class="sub">${esc(x.note || "")}${expOrder(x) ? ` · Order ${qfmt(expOrder(x).queue)}` : ""}</div></td><td class="r">${rp(x.amount)}</td></tr>`).join("") || emptyRow(3, "No expenses in this period.")}</tbody></table>`, { flush: true, right: `<a class="btn link" href="#/expenses">Expenses</a>` })}`);
  },
  after() {
    $("#repMonth").onchange = e => { if (e.target.value) { REP_M = e.target.value; refresh(); } };
    $("#main").onclick = e => {
      const tr = e.target.closest("tr[data-exp]"); if (tr) { editExp(S.expenses.find(x => x.id === tr.dataset.exp)); return; }
      const a = e.target.closest("[data-r]")?.dataset.r; if (!a) return;
      const [y, m] = REP_M.split("-").map(Number);
      if (a === "prev") { REP_M = monthKey(new Date(y, m - 2, 1)); refresh(); }
      if (a === "next") { REP_M = monthKey(new Date(y, m, 1)); refresh(); }
      if (a === "xlsx") exportReport(repData(REP_M));
    };
  }
};
function exportReport(r) {
  if (!window.XLSX) { toast("The Excel module needs internet. Try again when online."); return; }
  const wb = XLSX.utils.book_new(), add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add([[`${S.settings.business} Monthly Report`], ["Period", r.label], [], ["Cash received", r.inc], ["Transactions", r.rcv.length], ["New orders", r.ord.length], ["Value of new orders", r.nilai], ["Paid orders", r.done], ["Cancelled orders", r.cancelled], ["Expenses", r.expTot], ["Net profit", r.net], ["Unpaid (all active orders)", r.owed], [], ["Generated", fmtDateTime(Date.now())]], "Summary");
  add([["Date", "Order No.", "Customer", "Job Description", "Type", "Amount"], ...r.rcv.map(x => [fmtDate(x.at), toNum(x.o.queue), clientName(x.o), x.o.project || "", x.kind, x.amount]), [], ["", "", "", "", "Total", r.inc]], "Cash Receipts");
  add([["Order No.", "Order Date", "Due Date", "Customer", "WhatsApp", "Category", "Job Description", "Status", "Total", "Paid", "Balance"], ...r.ord.map(o => [toNum(o.queue), fmtDate(o.date), o.deadline ? dueText(o) : "", clientName(o), clientPhone(o), o.cat || "", o.project || "", ST[o.status].label, grandTotal(o), paidOf(o), owedOf(o)])], "Orders");
  add([["Date", "Category", "Order No.", "Note", "Amount"], ...[...r.exp].reverse().map(x => [fmtDate(x.date), x.cat || "", expOrder(x) ? toNum(expOrder(x).queue) : "", x.note || "", x.amount]), [], ["", "", "", "Total", r.expTot]], "Expenses");
  download(`${S.settings.business} Report ${r.label}.xlsx`, new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Report downloaded");
}

/* ===================== INSIGHTS ===================== */
let INS_N = 12;
PAGES.insights = {
  title: "Insights", nav: "insights",
  render() {
    const allMonths = [...new Set([...S.orders.map(o => String(o.date || "").slice(0, 7)), ...S.expenses.map(x => String(x.date || "").slice(0, 7))].filter(Boolean))].sort();
    const n = INS_N === 0 ? Math.max(1, monthsBetween(allMonths[0] || todayISO().slice(0, 7), todayISO().slice(0, 7))) : INS_N;
    const months = lastMonths(n), set = new Set(months);
    const rec = receiptsByMonth(), exp = expByMonth();
    const inPeriod = o => set.has(String(o.date || "").slice(0, 7));
    const P = S.orders.filter(inPeriod), valued = P.filter(o => o.status !== "batal" && !o.noAmount && grandTotal(o) > 0);
    const totalIn = sum(months, k => rec.get(k) || 0), totalExp = sum(months, k => exp.get(k) || 0);
    const cnt = new Map(), aov = new Map(); P.forEach(o => { const k = String(o.date).slice(0, 7); cnt.set(k, (cnt.get(k) || 0) + 1); });
    months.forEach(k => { const L = valued.filter(o => String(o.date).startsWith(k)); aov.set(k, L.length ? sum(L, o => grandTotal(o)) / L.length : 0); });
    const lbl = k => n > 12 ? monthShort(k) : monthShort(k).split(" ")[0];
    const series = (m, f = rp) => months.map(k => ({ label: lbl(k), value: m.get ? (m.get(k) || 0) : m(k), tip: `${monthLabel(k)}: ${f(m.get ? (m.get(k) || 0) : m(k))}` }));
    const byCat = new Map(); valued.forEach(o => { const c = o.cat || "Uncategorised"; byCat.set(c, (byCat.get(c) || 0) + grandTotal(o)); });
    const bySrc = new Map(); P.forEach(o => { const s = o.source || "Not recorded"; bySrc.set(s, (bySrc.get(s) || 0) + 1); });
    const byCust = new Map(); S.orders.forEach(o => { if (!o.customerId) return; const v = sum(receipts(o).filter(r => set.has(monthKey(r.at))), r => r.amount); if (v) byCust.set(o.customerId, (byCust.get(o.customerId) || 0) + v); });
    const wd = Array(7).fill(0); P.forEach(o => { wd[(new Date(at(o, "menunggu_dp") || o.createdAt).getDay() + 6) % 7]++; });
    const hr = Array(24).fill(0); P.forEach(o => { const t = at(o, "menunggu_dp"); if (t && !o.archived) hr[new Date(t).getHours()]++; });
    const svc = new Map(); P.forEach(o => (o.items || []).forEach(i => { if (i.priceId) svc.set(i.priceId, (svc.get(i.priceId) || 0) + i.qty * i.price); }));
    const delivered = P.map(onTime).filter(v => v !== null), ontime = delivered.filter(Boolean).length;
    const payH = P.filter(o => at(o, "menunggu_dp") && at(o, "dikerjakan") && !o.archived).map(o => (at(o, "dikerjakan") - at(o, "menunggu_dp")) / 3600e3);
    const custIds = new Set(P.map(o => o.customerId).filter(Boolean)), repeat = [...custIds].filter(id => S.orders.filter(o => o.customerId === id).length > 1).length;
    const canc = P.filter(o => o.status === "batal").length;
    const noData = P.filter(o => o.noAmount).length;
    return page("Finance", "Insights", `${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}${noData ? ` · ${plural(noData, "past order")} without a recorded amount are left out of money figures` : ""}`,
      `<div class="seg inline">${[[6, "6 months"], [12, "12 months"], [24, "24 months"], [0, "All time"]].map(([v, l]) => `<button type="button" data-n="${v}" aria-pressed="${v === INS_N}">${l}</button>`).join("")}</div>`, `
      <div class="kpis">
        ${kpi("Cash Received", rp(totalIn), `${rp(totalIn / months.length)} per month`)}
        ${kpi("Net Profit", rp(totalIn - totalExp), totalExp ? `after ${rp(totalExp)} expenses` : "no expenses recorded", totalIn - totalExp < 0 ? "alert" : "")}
        ${kpi("Orders", P.length, `${num(P.length / months.length)} per month`)}
        ${kpi("Average Order", rp(valued.length ? sum(valued, o => grandTotal(o)) / valued.length : 0), `median ${rp(median(valued.map(o => grandTotal(o))))}`)}
      </div>
      <div class="kpis">
        ${kpi("On-Time Delivery", delivered.length ? `${num(ontime / delivered.length * 100, 0)}%` : "-", delivered.length ? `${ontime} of ${delivered.length} delivered on time` : "no delivery dates yet")}
        ${kpi("Time to Down Payment", payH.length ? hrs(median(payH)) : "-", payH.length ? "median, invoice to payment" : "needs live orders")}
        ${kpi("Repeat Customers", custIds.size ? `${num(repeat / custIds.size * 100, 0)}%` : "-", `${repeat} of ${plural(custIds.size, "customer")}`)}
        ${kpi("Cancelled", P.length ? `${num(canc / P.length * 100, 0)}%` : "-", plural(canc, "order"), canc ? "alert" : "")}
      </div>
      <div class="grid g-2 g-many">
        ${panel("Cash Received per Month", colChart(series(rec), { label: "Cash received per month" }))}
        ${panel("Net Profit per Month", colChart(series(k => (rec.get(k) || 0) - (exp.get(k) || 0)), { label: "Net profit per month", cls: "c-alt" }))}
        ${panel("New Orders per Month", colChart(series(cnt, v => plural(v, "order")), { axis: v => num(v, 0), label: "New orders per month", cls: "c-neu" }))}
        ${panel("Average Order Value per Month", colChart(series(aov), { label: "Average order value", cls: "c-neu" }))}
        ${panel("Revenue by Category", hBars([...byCat].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value, sub: `${num(value / Math.max(1, sum([...byCat.values()])) * 100, 0)}%` })), { empty: "Assign categories to orders to see this." }))}
        ${panel("Top Customers by Payments", hBars([...byCust].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ label: custById(id)?.name || "-", value, href: `#/customer/${id}` })), { empty: "No customer payments in this period." }))}
        ${panel("Orders by Source", hBars([...bySrc].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), { fmt: v => plural(v, "order") }))}
        ${panel("Top Services from the Price List", hBars([...svc].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ label: S.prices.find(p => p.id === id)?.name || "Removed service", value })), { empty: "Lines added with the Price List button appear here." }))}
        ${panel("Orders by Weekday", colChart(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((l, i) => ({ label: l, value: wd[i], tip: `${DAYS[(i + 1) % 7]}: ${plural(wd[i], "order")}` })), { axis: v => num(v, 0), height: 150, cls: "c-neu", label: "Orders by weekday" }))}
        ${panel("Orders by Hour", colChart(hr.map((v, h) => ({ label: pad(h), value: v, tip: `${pad(h)}:00–${pad(h)}:59: ${plural(v, "order")}` })), { axis: v => num(v, 0), height: 150, maxLabels: 8, cls: "c-neu", label: "Orders by hour of day" }))}
      </div>`);
  },
  after() { $("#main").onclick = e => { const b = e.target.closest("[data-n]"); if (b) { INS_N = Number(b.dataset.n); refresh(); } }; }
};
function monthsBetween(a, b) { const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1) + 1; }

/* ===================== EXPENSES ===================== */
let EXP_M = null;
PAGES.expenses = {
  title: "Expenses", nav: "expenses",
  render() {
    EXP_M = EXP_M || todayISO().slice(0, 7);
    const L = monthExp(EXP_M), tot = sum(L, x => x.amount), inc = receiptsByMonth().get(EXP_M) || 0, net = inc - tot;
    const byCat = new Map(); L.forEach(x => byCat.set(x.cat || "Other", (byCat.get(x.cat || "Other") || 0) + x.amount));
    const em = expByMonth(), months = lastMonths(12).map(k => ({ label: monthShort(k).split(" ")[0], value: em.get(k) || 0, hi: k === EXP_M, tip: `${monthLabel(k)}: ${rp(em.get(k) || 0)}` }));
    return page("Finance", "Expenses", `Period: ${monthLabel(EXP_M)} · internal only, never shown on customer documents`, `<input id="expMonth" type="month" class="auto" value="${EXP_M}"><button class="btn primary" data-x="add" type="button">${ic("plus")}Add Expense</button>`, `
      <div class="kpis">${kpi("Expenses", rp(tot))}${kpi("Cash Received", rp(inc))}${kpi("Net Profit", rp(net), "", net < 0 ? "alert" : "")}${kpi("Profit Margin", inc ? num(net / inc * 100, 0) + "%" : "-")}</div>
      <div class="grid g-2">
        ${panel("Expenses per Month", colChart(months, { label: "Expenses per month", cls: "c-neu" }))}
        ${panel("By Category", hBars([...byCat].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), { empty: "No expenses this month." }))}
      </div>
      ${panel("Entries", `<table class="dt"><tbody>${L.map(x => `<tr data-exp="${esc(x.id)}"><td class="no">${fmtShort(x.date).split(" ").slice(0, 2).join(" ")}</td><td><div class="nm">${esc(x.cat || "Other")}</div><div class="sub">${esc(x.note || "")}${expOrder(x) ? `${x.note ? " · " : ""}Order ${qfmt(expOrder(x).queue)}` : ""}</div></td><td class="r">${rp(x.amount)}</td></tr>`).join("") || emptyRow(3, "No expenses recorded in this period.")}</tbody></table>`, { flush: true, right: `<span class="hint">${L.length ? plural(L.length, "entry", "entries") : ""}</span>` })}`);
  },
  after() {
    $("#expMonth").onchange = e => { if (e.target.value) { EXP_M = e.target.value; refresh(); } };
    $("#main").onclick = e => { const tr = e.target.closest("tr[data-exp]"); if (tr) { editExp(S.expenses.find(x => x.id === tr.dataset.exp)); return; } if (e.target.closest('[data-x="add"]')) editExp(null); };
  }
};
const ordLabel = o => `${qfmt(o.queue)} · ${o.project || ""}`;
function editExp(x, forOrder) {
  const isNew = !x, o0 = forOrder || (x && expOrder(x));
  x = x || { date: todayISO(), cat: S.settings.expCats[0], amount: 0, note: "" };
  openSheet(isNew ? "Add Expense" : "Edit Expense", `<div class="fg">
    ${field("Date", `<input id="x-date" type="date" value="${esc(x.date)}">`)}
    ${field("Category", `<select id="x-cat">${sel([...new Set([...S.settings.expCats, x.cat].filter(Boolean))], x.cat)}</select>`)}
    ${field("Amount (Rp)", `<input id="x-amt" class="money" inputmode="numeric" maxlength="17" value="${money(x.amount)}" placeholder="0">`)}
    ${field("Order (optional)", `<input id="x-ord" list="x-ords" autocomplete="off" value="${o0 ? esc(ordLabel(o0)) : ""}" placeholder="e.g. 3.067">`)}<datalist id="x-ords">${[...S.orders].sort((a, b) => toNum(b.queue) - toNum(a.queue)).slice(0, 300).map(o => `<option value="${esc(ordLabel(o))}">`).join("")}</datalist>
    ${field("Note", `<textarea id="x-note" placeholder="e.g. Worker pay for paper 3.067">${esc(x.note || "")}</textarea>`, "full")}</div>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button>${isNew ? `<button class="btn" data-close type="button">Cancel</button>` : `<button class="btn danger" data-a="del" type="button">Delete</button>`}</div>`, async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "del") { const old = { ...x }; await Store.del("expenses", x.id); audit(`Expense ${x.cat} ${rp(x.amount)} of ${fmtShort(x.date)} deleted`); closeSheet(); refresh(); toast("Expense deleted", async () => { await Store.put("expenses", old); refresh(); }); return; }
    const amount = toNum($("#x-amt").value), date = $("#x-date").value, ov = $("#x-ord").value.trim();
    if (!date) return toast("Date is required"); if (!amount) return toast("Amount is required"); if (amount > MAX_PRICE) return toast(`Amount may not exceed ${rp(MAX_PRICE)}`);
    let o = null; if (ov) { const qn = toNum(ov.split("·")[0]); o = S.orders.find(z => toNum(z.queue) === qn); if (!o) { toast(`Order ${ov.split("·")[0].trim()} was not found`); return; } }
    await Store.put("expenses", { ...x, id: x.id || uid("x"), date, cat: $("#x-cat").value, amount, note: $("#x-note").value.trim(), orderId: o ? o.id : null, createdAt: x.createdAt || Date.now(), updatedAt: Date.now() });
    audit(`Expense ${$("#x-cat").value} ${rp(amount)} ${isNew ? "recorded" : "updated"}${o ? ` for order ${qfmt(o.queue)}` : ""}`, "expenses");
    closeSheet(); refresh(); toast(isNew ? "Expense recorded" : "Expense updated");
  });
}
