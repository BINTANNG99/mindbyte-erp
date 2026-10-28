/* MINDBYTE Order System: ERP modules (pipeline, workers & payables, receivables, cash book, profit & loss, activity log). */
"use strict";

/* ===================== PIPELINE (board by stage) ===================== */
const PIPE_COLS = ["menunggu_dp", "dikerjakan", "minta_lunas", "lunas"];
PAGES.pipeline = {
  title: "Pipeline", nav: "pipeline",
  render() {
    const cols = PIPE_COLS.map(s => {
      const L = S.orders.filter(o => o.status === s).sort((a, b) => s === "dikerjakan" ? String(a.deadline || "9").localeCompare(String(b.deadline || "9")) : (at(a, s) || 0) - (at(b, s) || 0));
      const money = s === "dikerjakan" ? sum(L, owedOf) : s === "lunas" ? sum(L, o => grandTotal(o)) : sum(L, billedNow);
      const what = s === "menunggu_dp" || s === "minta_lunas" ? "to collect now" : s === "dikerjakan" ? "still to collect" : "paid";
      return `<section class="pcol"><header><div><b>${ST[s].label}</b><span>${plural(L.length, "order")}</span></div><div class="pmoney">${rp(money)}<small>${what}</small></div></header>
        <div class="pcards">${L.map(o => pipeCard(o)).join("") || `<p class="empty">Empty</p>`}</div></section>`;
    }).join("");
    const act = S.orders.filter(isActive);
    return page("Sales", "Pipeline", `${plural(act.length, "active order")} · ${rp(sum(act, owedOf))} not yet received`, `<a class="btn" href="#/orders">List View</a><a class="btn primary" href="#/new">New Order</a>`,
      `<div class="pipe">${cols}</div>`);
  },
  after() {
    $("#main").onclick = async e => {
      const b = e.target.closest("[data-adv]"); if (!b) return; e.preventDefault(); e.stopPropagation();
      const o = S.orders.find(x => x.id === b.dataset.adv), n = nextOf(o); if (!n) return; b.disabled = true;
      pushUndo(o); await saveOrder(withStatus(o, n), `Status: ${ST[n].label}`); refresh(); toast(`Order ${qfmt(o.queue)}: ${ST[n].label}`, () => stepHist(o.id, -1));
    };
  }
};
function pipeCard(o) {
  const late = isLate(o), w = workerById(o.assign?.workerId), t = at(o, o.status);
  const amt = o.status === "menunggu_dp" || o.status === "minta_lunas" ? `${rp(billedNow(o))} due` : o.status === "dikerjakan" ? `${rp(owedOf(o))} balance` : rp(grandTotal(o));
  const r = o.status === "lunas" ? revState(o) : null;
  return `<a class="pcard${late ? " late" : ""}" href="#/order/${esc(o.id)}">
    <div class="pc-top"><span class="pc-no">${qfmt(o.queue)}</span><span class="pc-amt">${amt}</span></div>
    <div class="pc-t">${esc(o.project || "Untitled order")}</div>
    <div class="pc-s">${esc(clientName(o) || "No customer")}${w ? ` · ${esc(w.name)}` : ""}</div>
    <div class="pc-f"><span class="${late ? "over" : ""}">${o.status === "dikerjakan" ? (o.deadline ? (late ? "Overdue · " : "Due ") + dueText(o, 1) : "No due date") : r ? (r.why ? "Ready to close" : `Revisions ${r.used}/${r.max} · until ${fmtTime(r.end)}`) : `Waiting ${ago(t)}`}</span>
    ${actOf(o) ? `<button class="pc-go" type="button" data-adv="${esc(o.id)}" title="${esc(actOf(o))}" aria-label="${esc(actOf(o))}">${ic("right")}</button>` : ""}</div></a>`;
}

/* ===================== WORKERS & PAYABLES ===================== */
PAGES.workers = {
  title: "Workers", nav: "workers",
  render() {
    const all = S.workers.map(w => ({ w, s: workerStats(w) }));
    const owedOrders = S.orders.filter(o => feeOwed(o) > 0).sort((a, b) => (at(a, "lunas") || 9e15) - (at(b, "lunas") || 9e15));
    const unassigned = S.orders.filter(o => isActive(o) && !o.assign?.workerId);
    return page("Operations", "Workers", "People who do the work, what they are assigned, and what you still owe them.", `<button class="btn primary" data-w="add" type="button">${ic("plus")}Add Worker</button>`, `
      <div class="kpis">${kpi("Workers", S.workers.filter(w => w.active !== false).length, `${S.workers.length} in total`)}${kpi("Worker Pay Owed", rp(sum(owedOrders, feeOwed)), plural(owedOrders.length, "order"), owedOrders.length ? "alert" : "")}${kpi("Paid This Month", rp(sum(S.expenses.filter(x => x.workerId && String(x.date).startsWith(todayISO().slice(0, 7))), x => x.amount)))}${kpi("Active Orders Unassigned", unassigned.length, unassigned.length ? "assign them on the order page" : "all assigned", unassigned.length ? "alert" : "")}</div>
      <div class="grid g-2">
        ${panel("Workers", `<table class="dt"><tbody>${all.map(({ w, s }) => `<tr data-href="worker/${esc(w.id)}"><td><div class="nm">${esc(w.name)}${w.active === false ? ` <span class="badge b-gry">Inactive</span>` : ""}</div><div class="sub">${esc(w.skills || w.phone || "")}</div></td><td class="r">${plural(s.active, "active order")}<div class="sub">${s.owed ? `owed ${rp(s.owed)}` : "nothing owed"}</div></td></tr>`).join("") || emptyRow(2, "No workers yet. Add the people who work on your orders.")}</tbody></table>`, { flush: true })}
        ${panel("Payables: Worker Pay Owed", `<table class="dt"><tbody>${owedOrders.map(o => `<tr data-href="order/${esc(o.id)}">${orderCells(o, { due: false })}<td class="r">${rp(feeOwed(o))}<div class="sub">${esc(workerById(o.assign.workerId)?.name || "")}</div></td></tr>`).join("") || emptyRow(3, "Nothing owed to workers.")}</tbody></table>`, { flush: true })}
      </div>
      ${unassigned.length ? panel("Active Orders Without a Worker", `<table class="dt"><tbody>${unassigned.map(o => `<tr data-href="order/${esc(o.id)}">${orderCells(o)}<td class="r">${badge(o.status)}</td></tr>`).join("")}</tbody></table>`, { flush: true }) : ""}`);
  },
  after() { $("#main").onclick = e => { if (e.target.closest('[data-w="add"]')) editWorker(null); }; }
};
PAGES.worker = {
  title: id => workerById(id)?.name || "Worker", nav: "workers", parent: "workers",
  render(id) {
    const w = workerById(id); if (!w) return page("Operations · Workers", "Worker not found", "", `<a class="btn" href="#/workers">Back</a>`, "");
    const s = workerStats(w), L = [...s.orders].sort((a, b) => toNum(b.queue) - toNum(a.queue)), pays = S.expenses.filter(x => x.workerId === w.id).sort((a, b) => String(b.date).localeCompare(a.date));
    const fees = sum(L.filter(o => o.status !== "batal"), o => o.assign.fee || 0), rev = sum(L.filter(o => o.status !== "batal"), o => grandTotal(o));
    return page("Operations · Workers", w.name, esc(w.skills || ""), `${w.phone ? `<a class="btn" href="${waLink(w.phone)}" target="_blank" rel="noopener">${ic("wa")}WhatsApp</a>` : ""}<button class="btn" data-w="edit" type="button">${ic("edit")}Edit</button>`, `
      <div class="kpis">${kpi("Orders", s.count, `${s.active} active`)}${kpi("Owed Now", rp(s.owed), "", s.owed ? "alert" : "")}${kpi("Paid in Total", rp(s.paid))}${kpi("Your Margin on Their Orders", rev ? `${num((rev - fees) / rev * 100, 0)}%` : "-", rev ? `${rp(rev - fees)} of ${rp(rev)}` : "")}</div>
      <div class="grid g-detail">
        ${panel("Assigned Orders", `<table class="dt"><tbody>${L.map(o => `<tr data-href="order/${esc(o.id)}">${orderCells(o)}<td class="r">${rp(o.assign.fee || 0)}<div class="sub${feeOwed(o) ? " over" : ""}">${feePaid(o) ? "paid" : feeOwed(o) ? "owed" : o.status === "batal" ? "cancelled" : "no fee"}</div></td></tr>`).join("") || emptyRow(3, "No orders assigned yet.")}</tbody></table>`, { flush: true })}
        <div class="stack">
          ${panel("Details", `<dl class="kv"><dt>Name</dt><dd>${esc(w.name)}</dd><dt>WhatsApp</dt><dd>${esc(w.phone || "-")}</dd><dt>Skills</dt><dd>${esc(w.skills || "-")}</dd><dt>Status</dt><dd>${w.active === false ? "Inactive" : "Active"}</dd></dl>${w.note ? `<div class="note">${esc(w.note)}</div>` : ""}`)}
          ${panel("Payments", pays.map(x => `<button class="li" data-exp="${esc(x.id)}" type="button"><span><b>${fmtShort(x.date)}</b><small>${esc(x.note || "")}</small></span><span class="m">${rp(x.amount)}</span></button>`).join("") || `<p class="hint">No payments yet.</p>`)}
          ${panel(null, `<div class="row btns"><button class="btn danger" data-w="del" type="button">${ic("trash")}Delete Worker</button></div>`)}
        </div>
      </div>`);
  },
  after(id) {
    $("#main").onclick = async e => {
      const x = e.target.closest("[data-exp]"); if (x) { editExp(S.expenses.find(z => z.id === x.dataset.exp)); return; }
      const a = e.target.closest("[data-w]")?.dataset.w; const w = workerById(id); if (!a || !w) return;
      if (a === "edit") editWorker(w);
      if (a === "del") { if (await confirmSheet("Delete worker", `Delete ${esc(w.name)}? Their orders keep the fee but lose the assignment.`, "Delete", true)) {
        await Store.putMany("orders", S.orders.filter(o => o.assign?.workerId === id).map(o => ({ ...o, assign: { ...o.assign, workerId: null }, updatedAt: Date.now() })));
        await Store.del("workers", id); audit(`Worker ${w.name} deleted`); toast("Worker deleted"); go("workers"); } }
    };
  }
};
function editWorker(w) {
  const isNew = !w; w = w || { name: "", phone: "", skills: "", note: "", active: true };
  openSheet(isNew ? "Add Worker" : "Edit Worker", `<div class="fg">
    ${field("Name", `<input id="wk-name" value="${esc(w.name)}">`, "full")}
    ${field("WhatsApp Number", `<input id="wk-phone" inputmode="tel" value="${esc(w.phone || "")}">`)}
    ${field("Status", `<select id="wk-act">${sel([["1", "Active"], ["0", "Inactive"]], w.active === false ? "0" : "1")}</select>`)}
    ${field("Skills", `<input id="wk-skills" value="${esc(w.skills || "")}" placeholder="e.g. SPSS, jurnal, PPT">`, "full")}
    ${field("Notes", `<textarea id="wk-note" placeholder="e.g. usual rates, bank account">${esc(w.note || "")}</textarea>`, "full")}</div>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    const name = $("#wk-name").value.trim(); if (!name) return toast("Name is required");
    const rec = { ...w, id: w.id || uid("w"), name, phone: $("#wk-phone").value.trim(), skills: $("#wk-skills").value.trim(), note: $("#wk-note").value.trim(), active: $("#wk-act").value === "1", createdAt: w.createdAt || Date.now(), updatedAt: Date.now() };
    await Store.put("workers", rec); audit(`Worker ${name} ${isNew ? "added" : "updated"}`, `worker/${rec.id}`); closeSheet(); toast(isNew ? "Worker added" : "Worker updated"); refresh();
  });
}
/* assignment panel on the order page */
function assignPanel(o) {
  const a = o.assign || {}, w = workerById(a.workerId);
  const body = w ? `<dl class="kv"><dt>Worker</dt><dd><a href="#/worker/${esc(w.id)}">${esc(w.name)}</a></dd><dt>Agreed Fee</dt><dd>${rp(a.fee || 0)}</dd><dt>Status</dt><dd class="${feeOwed(o) ? "due" : ""}">${feePaid(o) ? "Paid" : a.fee ? "Owed" : "No fee set"}</dd>${a.fee ? `<dt>Your Margin</dt><dd>${rp(grandTotal(o) - a.fee)} · ${grandTotal(o) ? num((grandTotal(o) - a.fee) / grandTotal(o) * 100, 0) : 0}%</dd>` : ""}</dl>
      <div class="row btns"><button class="btn" data-o="assign" type="button">${ic("edit")}Change</button>${feeOwed(o) ? `<button class="btn primary" data-o="paywk" type="button">Pay ${rpShort(a.fee)}</button>` : ""}</div>`
    : `<p class="hint">${o.status === "batal" ? "Cancelled order." : "Nobody is assigned to this order."}</p><button class="btn" data-o="assign" type="button">${ic("users")}Assign Worker</button>`;
  return panel("Assigned Worker", body);
}
function assignSheet(o) {
  const a = o.assign || {}, ws = S.workers.filter(w => w.active !== false || w.id === a.workerId);
  if (!S.workers.length) { toast("Add a worker first"); editWorker(null); return; }
  openSheet(`Assign · Order ${qfmt(o.queue)}`, `<div class="fg">
    ${field("Worker", `<select id="as-w">${sel([["", "Nobody"], ...ws.map(w => [w.id, w.name])], a.workerId || "")}</select>`, "full")}
    ${field("Agreed Fee (Rp)", `<input id="as-fee" class="money" inputmode="numeric" value="${money(a.fee)}" placeholder="0">`)}
    ${field("Order Total", `<input value="${rp(grandTotal(o))}" readonly>`)}</div>
    ${feePaid(o) ? `<p class="hint">The fee is already paid. To change it, delete the payment in Expenses first.</p>` : ""}
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    const wid = $("#as-w").value || null, fee = toNum($("#as-fee").value);
    if (feePaid(o) && (fee !== a.fee || wid !== a.workerId)) return toast("Already paid. Delete the payment in Expenses to change it.");
    const n = { ...o, assign: wid ? { ...a, workerId: wid, fee } : null };
    closeSheet(); commit(o, n, wid ? `Assigned to ${workerById(wid).name}` : "Worker removed", wid ? `Assigned to ${workerById(wid).name}, fee ${rp(fee)}` : "Worker removed");
  });
}

/* ===================== RECEIVABLES (aging) ===================== */
const AGE_B = [[0, 1, "Under 1 day"], [1, 7, "1–7 days"], [7, 30, "8–30 days"], [30, 1e9, "Over 30 days"]];
PAGES.receivables = {
  title: "Receivables", nav: "receivables",
  render() {
    const L = S.orders.filter(o => owedOf(o) > 0).map(o => ({ o, owed: owedOf(o), billed: billedNow(o), days: (Date.now() - (owedSince(o) || Date.now())) / 864e5 })).sort((a, b) => b.days - a.days);
    const due = L.filter(x => x.billed > 0), later = L.filter(x => !x.billed);
    const buckets = AGE_B.map(([lo, hi, l]) => { const B = due.filter(x => x.days >= lo && x.days < hi); return kpi(l, rp(sum(B, x => x.billed)), plural(B.length, "invoice"), lo >= 7 && B.length ? "alert" : ""); }).join("");
    const row = x => `<tr data-href="order/${esc(x.o.id)}">${orderCells(x.o, { due: false })}<td class="r">${rp(x.billed || x.owed)}<div class="sub${x.days > 7 && x.billed ? " over" : ""}">${x.billed ? `${num(x.days, 0)} days · ${x.o.status === "menunggu_dp" ? "DP invoice" : x.o.status === "minta_lunas" ? "final invoice" : "add-on invoice"}${extraOwed(x.o) && (x.o.status === "menunggu_dp" || x.o.status === "minta_lunas") ? " + add-on" : ""}` : "payable on completion"}</div></td><td class="act">${clientPhone(x.o) && x.billed ? `<a class="ib" href="${waLink(clientPhone(x.o), fillTpl(tplOf("remind"), tplVars(x.o)))}" target="_blank" rel="noopener" title="Send payment reminder" aria-label="Send payment reminder">${ic("wa")}</a>` : ""}</td></tr>`;
    return page("Finance", "Receivables", `${rp(sum(L, x => x.owed))} owed by customers in total · ${rp(sum(due, x => x.billed))} invoiced and due now`, `<button class="btn" data-r="csv" type="button">${ic("dl")}Export CSV</button>`, `
      <div class="kpis">${buckets}</div>
      ${panel("Invoiced, Awaiting Payment", `<table class="dt"><tbody>${due.map(row).join("") || emptyRow(4, "No open invoices.")}</tbody></table>`, { flush: true, right: `<span class="hint">oldest first</span>` })}
      ${panel("Balance Due on Completion", `<table class="dt"><tbody>${later.map(row).join("") || emptyRow(4, "None.")}</tbody></table>`, { flush: true, right: `<span class="hint">${rp(sum(later, x => x.owed))}</span>` })}`);
  },
  after() {
    $("#main").onclick = e => { if (!e.target.closest('[data-r="csv"]')) return;
      const L = S.orders.filter(o => owedOf(o) > 0);
      download(`Receivables ${todayISO()}.csv`, new Blob([toCsv([["Order No.", "Customer", "WhatsApp", "Status", "Invoiced Now", "Total Owed", "Days Open"], ...L.map(o => [o.queue, clientName(o), clientPhone(o), ST[o.status].label, billedNow(o), owedOf(o), Math.floor((Date.now() - (owedSince(o) || Date.now())) / 864e5)])])], { type: "text/csv" }), "CSV downloaded"); };
  }
};

/* ===================== CASH BOOK (every rupiah in and out, with running balance) ===================== */
let CB = { m: null, kind: "" };
function cashLines() {
  const L = [];
  S.orders.forEach(o => receipts(o).forEach(r => L.push({ at: r.at, date: isoDate(new Date(r.at)), ref: `ORD ${qfmt(o.queue)}`, href: `order/${o.id}`, desc: `${r.kind} · ${clientName(o) || o.project || ""}`, amt: r.amount })));
  S.expenses.forEach(x => L.push({ at: toDate(x.date).getTime() + 12 * 3600e3, date: x.date, ref: expOrder(x) ? `EXP ${qfmt(expOrder(x).queue)}` : "EXP", exp: x.id, desc: `${x.cat}${x.note ? " · " + x.note : ""}`, amt: -x.amount }));
  return L.sort((a, b) => a.at - b.at);
}
PAGES.cashbook = {
  title: "Cash Book", nav: "cashbook",
  render() {
    CB.m = CB.m || todayISO().slice(0, 7);
    const all = cashLines(), opening = sum(all.filter(l => l.date < CB.m + "-01"), l => l.amt);
    let bal = opening; const rows = all.filter(l => l.date.startsWith(CB.m)).map(l => ({ ...l, bal: (bal += l.amt) })).filter(l => !CB.kind || (CB.kind === "in" ? l.amt > 0 : l.amt < 0));
    const inn = sum(rows.filter(l => l.amt > 0), l => l.amt), out = -sum(rows.filter(l => l.amt < 0), l => l.amt);
    return page("Finance", "Cash Book", `Every payment received and every expense, in date order, with the running balance. Period: ${monthLabel(CB.m)}.`,
      `<input id="cbM" type="month" class="auto" value="${CB.m}"><select id="cbK" class="auto">${sel([["", "In and out"], ["in", "Money in"], ["out", "Money out"]], CB.kind)}</select><button class="btn" data-c="csv" type="button">${ic("dl")}CSV</button>`, `
      <div class="kpis">${kpi("Opening Balance", rp(opening), `before ${fmtShort(CB.m + "-01")}`)}${kpi("Money In", rp(inn))}${kpi("Money Out", rp(out))}${kpi("Closing Balance", rp(opening + inn - out), "", opening + inn - out < 0 ? "alert" : "")}</div>
      ${panel(null, `<div class="tw"><table class="dt ledger"><thead><tr><th>Date</th><th class="wide">Ref.</th><th>Description</th><th class="r">In</th><th class="r">Out</th><th class="r wide">Balance</th></tr></thead><tbody>
        ${rows.map(l => `<tr ${l.href ? `data-href="${l.href}"` : `data-exp="${l.exp}"`}><td class="no">${fmtShort(l.date).split(" ").slice(0, 2).join(" ")}</td><td class="wide"><span class="ref">${l.ref}</span></td><td><div class="nm">${esc(l.desc)}</div><div class="nar sub">${l.ref}</div></td><td class="r">${l.amt > 0 ? rp(l.amt) : ""}</td><td class="r">${l.amt < 0 ? rp(-l.amt) : ""}</td><td class="r wide">${rp(l.bal)}</td></tr>`).join("") || emptyRow(6, "No money in or out in this period.")}
      </tbody></table></div>`, { flush: true })}
      <p class="hint">Built from order payments (dated by each order's timeline) and Expenses. Edit either and the ledger follows. The opening balance is everything recorded before this month.</p>`);
  },
  after() {
    $("#cbM").onchange = e => { if (e.target.value) { CB.m = e.target.value; refresh(); } };
    $("#cbK").onchange = e => { CB.kind = e.target.value; refresh(); };
    $("#main").onclick = e => {
      const tr = e.target.closest("tr[data-exp]"); if (tr) { editExp(S.expenses.find(x => x.id === tr.dataset.exp)); return; }
      if (e.target.closest('[data-c="csv"]')) { let bal = 0; download(`Cash Book ${todayISO()}.csv`, new Blob([toCsv([["Date", "Reference", "Description", "In", "Out", "Balance"], ...cashLines().map(l => [l.date, l.ref, l.desc, l.amt > 0 ? l.amt : "", l.amt < 0 ? -l.amt : "", (bal += l.amt)])])], { type: "text/csv" }), "CSV downloaded"); }
    };
  }
};

/* ===================== PROFIT & LOSS (year by month) ===================== */
let PL_Y = null;
PAGES.pnl = {
  title: "Profit & Loss", nav: "pnl",
  render() {
    PL_Y = PL_Y || new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => `${PL_Y}-${pad(i + 1)}`);
    const rec = receiptsByMonth();
    const refunds = new Map(); S.orders.forEach(o => receipts(o).filter(r => r.amount < 0).forEach(r => { const k = monthKey(r.at); refunds.set(k, (refunds.get(k) || 0) - r.amount); }));
    const cats = [...new Set([...S.settings.expCats, ...S.expenses.map(x => x.cat || "Other")])];
    const expBy = (k, c) => sum(S.expenses.filter(x => String(x.date).startsWith(k) && (x.cat || "Other") === c), x => x.amount);
    const usedCats = cats.filter(c => months.some(k => expBy(k, c)));
    const net = k => rec.get(k) || 0, gross = k => net(k) + (refunds.get(k) || 0), expT = k => sum(usedCats, c => expBy(k, c)), prof = k => net(k) - expT(k);
    const cell = v => `<td class="r">${v ? rp(v) : `<span class="sub">-</span>`}</td>`;
    const line = (label, f, cls = "") => `<tr class="${cls}"><th scope="row">${label}</th>${months.map(k => cell(f(k))).join("")}${cell(sum(months, f))}</tr>`;
    const years = [...new Set([...S.orders.map(o => String(o.date || "").slice(0, 4)), ...S.expenses.map(x => String(x.date).slice(0, 4)), String(new Date().getFullYear())].filter(Boolean))].sort().reverse();
    const totNet = sum(months, net), totExp = sum(months, expT);
    return page("Finance", "Profit & Loss", `Cash basis: revenue counts when the payment is received. Year ${PL_Y}.`, `<select id="plY" class="auto">${sel(years, PL_Y)}</select><button class="btn" data-p="csv" type="button">${ic("dl")}CSV</button>`, `
      <div class="kpis">${kpi("Revenue", rp(totNet))}${kpi("Expenses", rp(totExp))}${kpi("Net Profit", rp(totNet - totExp), "", totNet - totExp < 0 ? "alert" : "")}${kpi("Net Margin", totNet ? `${num((totNet - totExp) / totNet * 100, 0)}%` : "-")}</div>
      ${panel("Net Profit per Month", colChart(months.map(k => ({ label: MONTHS[+k.slice(5) - 1].slice(0, 3), value: prof(k), tip: `${monthLabel(k)}: ${rp(prof(k))}` })), { label: "Net profit per month" }))}
      ${panel(null, `<div class="tw"><table class="dt pnl"><thead><tr><th></th>${months.map(k => `<th class="r">${MONTHS[+k.slice(5) - 1].slice(0, 3)}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>
        ${line("Payments received", gross)}${line("Refunds", k => refunds.get(k) || 0)}${line("Revenue", net, "tot")}
        ${usedCats.map(c => line(esc(c), k => expBy(k, c), "ind")).join("") || `<tr class="ind"><th scope="row">No expenses recorded</th>${months.map(() => cell(0)).join("")}${cell(0)}</tr>`}
        ${line("Total expenses", expT, "tot")}${line("Net profit", prof, "grand")}
      </tbody></table></div>`, { flush: true })}`);
  },
  after() {
    $("#plY").onchange = e => { PL_Y = Number(e.target.value); refresh(); };
    $("#main").onclick = e => { if (!e.target.closest('[data-p="csv"]')) return;
      const rows = $$(".pnl tr").map(tr => $$("th,td", tr).map(c => c.textContent.replace(/Rp|\./g, "").replace("−", "-").trim()));
      download(`Profit and Loss ${PL_Y}.csv`, new Blob([toCsv(rows)], { type: "text/csv" }), "CSV downloaded"); };
  }
};

/* ===================== ACTIVITY LOG ===================== */
let AL = { q: "", limit: 150 };
PAGES.activity = {
  title: "Activity Log", nav: "activity",
  render() {
    return page("System", "Activity Log", "Every change made in the system, newest first.", `<input id="alQ" type="search" class="auto" placeholder="Filter" value="${esc(AL.q)}">`,
      panel(null, `<ul class="feed log" id="alList"></ul><div id="alMore"></div>`));
  },
  after() {
    const draw = () => { const q = AL.q.toLowerCase(), L = [...S.audit].reverse().filter(l => !q || l.text.toLowerCase().includes(q));
      let day = ""; $("#alList").innerHTML = L.slice(0, AL.limit).map(l => { const d = fmtDate(l.at), h = d !== day ? `<li class="day">${d}</li>` : ""; day = d; return h + `<li>${l.ref ? `<a href="#/${esc(l.ref)}">${esc(l.text)}</a>` : `<span class="ft">${esc(l.text)}</span>`}<span>${fmtTime(l.at)}</span></li>`; }).join("") || `<li class="empty">No activity recorded yet. Changes from now on appear here.</li>`;
      $("#alMore").innerHTML = L.length > AL.limit ? `<div class="more-row"><button class="btn" data-l="more" type="button">Show more</button></div>` : ""; };
    draw(); $("#alQ").oninput = e => { AL.q = e.target.value; draw(); };
    $("#main").onclick = e => { if (e.target.closest('[data-l="more"]')) { AL.limit += 150; draw(); } };
  }
};

/* ===================== ATTENTION LIST (dashboard): plain statements of what needs doing ===================== */
function attentionItems() {
  const act = S.orders.filter(isActive), out = [], nos = L => L.map(o => qfmt(o.queue)).join(", ");
  /* the copy opened from the disk keeps its own data; new work belongs in the online app */
  if (location.protocol === "file:") out.push(["red", "This is the offline copy on this computer, separate from the online system", "Enter new orders in the online app (bintanng99.github.io/mindbyte-erp) so they reach the database and your phone.", "settings"]);
  const late = act.filter(isLate); if (late.length) out.push(["red", `${plural(late.length, "order")} past the due date`, nos(late), "orders"]);
  const soon = act.filter(o => o.status === "dikerjakan" && o.deadline && !isLate(o) && toDate(o.deadline) - Date.now() < 24 * 3600e3); if (soon.length) out.push(["amb", `${plural(soon.length, "order")} due within 24 hours`, soon.map(o => `${qfmt(o.queue)} at ${fmtTime(o.deadline)}`).join(", "), "calendar"]);
  const old = act.filter(o => billedNow(o) && Date.now() - (owedSince(o) || 0) > 24 * 3600e3); if (old.length) out.push(["red", `${rp(sum(old, billedNow))} invoiced over 24 hours ago, still unpaid`, `${plural(old.length, "invoice")}: ${nos(old)}`, "receivables"]);
  const close = act.filter(o => o.status === "lunas" && revState(o).why); if (close.length) out.push(["grn", `${plural(close.length, "order")} ready to close`, nos(close), "pipeline"]);
  const addon = S.orders.filter(o => o.status !== "batal" && extraOwed(o) > 0); if (addon.length) out.push(["red", `${rp(sum(addon, extraOwed))} in revisions and add-ons not yet paid`, nos(addon), "receivables"]);
  const owe = S.orders.filter(o => feeOwed(o) > 0); if (owe.length) out.push(["amb", `${rp(sum(owe, feeOwed))} owed to workers`, `${plural(owe.length, "order")}: ${nos(owe)}`, "workers"]);
  const unas = act.filter(o => !o.assign?.workerId && S.workers.length); if (unas.length) out.push(["gry", `${plural(unas.length, "active order")} without a worker`, nos(unas), "workers"]);
  const nocust = act.filter(o => !o.customerId); if (nocust.length) out.push(["gry", `${plural(nocust.length, "active order")} without a customer name`, nos(nocust), "orders"]);
  const nophone = act.filter(o => o.customerId && !clientPhone(o)); if (nophone.length) out.push(["gry", `${plural(nophone.length, "active order")} whose customer has no WhatsApp number`, nos(nophone), "customers"]);
  const days = S.settings.lastBackup ? Math.floor((Date.now() - S.settings.lastBackup) / 864e5) : null;
  if (days === null || days > 7) out.push(["amb", days === null ? "No backup downloaded yet" : `Last backup was ${plural(days, "day")} ago`, "Your data lives only on this device until you download a backup.", "settings"]);
  return out;
}
