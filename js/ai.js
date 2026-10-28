/* MINDBYTE Order System: AI assistant (DeepSeek, reached through the sign-in worker, which holds the API key).
   The model gets tools that read and change the data of this app. The tools run here in the browser with the same
   save functions the screens use, so every AI change is logged on the order, can be undone there, and syncs like any edit. */
"use strict";

const AI = { msgs: lsGet("mb_ai_chat") || [], busy: false };
const aiSave = () => lsSet("mb_ai_chat", AI.msgs.slice(-80));
const aiSystem = () => `You are the assistant inside the MINDBYTE Order System, the internal order and finance app of ${S.settings.business}, an academic writing, research and IT services business in Indonesia. Now: ${fmtDateTime(Date.now())}.
Always use the tools to read real data. Never invent orders, names or amounts. Money is Indonesian rupiah, written like Rp 1.250.000.
Order flow: Awaiting Down Payment → In Progress → Awaiting Final Payment → Paid, Revision Period → Completed, or Cancelled. Orders paid in full upfront skip Awaiting Final Payment.
You may change data when the owner asks for it. If a request is ambiguous (for example several orders match), ask before changing anything. After a change, say exactly what changed.
Expense categories: ${S.settings.expCats.join(", ")}.
Answer in the owner's language (usually Indonesian), short and well structured: plain lines, bold only for short headings, no tables. Refer to orders by number, e.g. 3.069.`;

/* ---------- tools ---------- */
const aiNo = v => toNum(String(v ?? "").replace(/[^\d]/g, ""));
const aiFind = no => { const n = aiNo(no), o = S.orders.find(x => toNum(x.queue) === n); if (!o) throw new Error(`Order ${no} not found`); return o; };
const aiOrderRow = o => ({ order_no: qfmt(o.queue), job: o.project, customer: clientName(o) || null, status: ST[o.status].label, order_date: o.date || null, due: o.deadline ? dueText(o) : null, total: grandTotal(o), paid: paidOf(o), balance: owedOf(o), overdue: !!isLate(o) });
const AI_STATUS = { active: o => isActive(o), awaiting_down_payment: o => o.status === "menunggu_dp", in_progress: o => o.status === "dikerjakan", awaiting_final_payment: o => o.status === "minta_lunas", revision_period: o => o.status === "lunas", completed: o => o.status === "selesai", cancelled: o => o.status === "batal", unpaid: o => owedOf(o) > 0, overdue: o => isLate(o), all: () => true };
const AI_STAGE = { down_payment_invoice: "dp", order_confirmation: "ko", final_payment_invoice: "pl", receipt: "kw", order_closed: "done", payment_reminder: "remind" };
const aiDue = v => { if (!v) return null; const s = String(v).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? { dueType: "exact", deadline: s + "T23:59", deadlineFrom: "" } : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? { dueType: "exact", deadline: s.slice(0, 16), deadlineFrom: "" } : null; };
const aiItems = L => (L || []).map(i => ({ name: String(i.name || "").trim(), qty: Math.max(1, Math.min(MAX_QTY, toNum(i.qty) || 1)), price: Math.max(0, Math.min(MAX_PRICE, toNum(i.price))) })).filter(i => i.name || i.price);
async function aiCommit(prev, next, text) { pushUndo(prev); return saveOrder(next, "AI: " + text); }
const aiISO = t => { const d = new Date(t), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function aiMonthStats(m) {
  const ord = S.orders.filter(o => String(o.date || "").startsWith(m));
  const rc = S.orders.flatMap(o => receipts(o).filter(r => r.at && aiISO(r.at).startsWith(m)));
  const ex = S.expenses.filter(x => String(x.date || "").startsWith(m));
  const inc = sum(rc, r => r.amount), out = sum(ex, x => x.amount);
  return { month: m, new_orders: ord.length, new_order_value: sum(ord.filter(o => o.status !== "batal"), grandTotal), cash_received: inc, expenses: out, net_cash: inc - out, cancelled: ord.filter(o => o.status === "batal").length };
}
const AI_ITEMS = { type: "array", items: { type: "object", properties: { name: { type: "string" }, qty: { type: "integer" }, price: { type: "integer", description: "Unit price in rupiah" } }, required: ["name", "price"] } };

const AI_TOOLS = {
  search_orders: {
    d: "Find orders. Returns order number, job, customer, status, dates, total, paid and balance. Use before answering any question about orders.",
    p: { query: { type: "string", description: "Words to match in order number, job, customer, phone, notes or items" }, status: { type: "string", enum: Object.keys(AI_STATUS), description: "Default: all" }, month: { type: "string", description: "Order month YYYY-MM" }, limit: { type: "integer", description: "Default 30, max 200" } },
    run(a) {
      const q = String(a.query || "").toLowerCase().trim(), f = AI_STATUS[a.status] || AI_STATUS.all;
      const L = S.orders.filter(o => f(o) && (!a.month || String(o.date || "").startsWith(a.month)) && (!q || [qfmt(o.queue), o.project, clientName(o), clientPhone(o), o.notes, o.memo, o.cat, ...(o.items || []).map(i => i.name)].join(" ").toLowerCase().includes(q)))
        .sort((x, y) => toNum(y.queue) - toNum(x.queue));
      return { found: L.length, total_value: sum(L.filter(o => o.status !== "batal"), grandTotal), total_balance: sum(L, owedOf), orders: L.slice(0, Math.min(200, a.limit || 30)).map(aiOrderRow) };
    }
  },
  get_order: {
    d: "Everything about one order: items, payments, timeline, revisions, notes, internal memo, costs, assigned worker.",
    p: { order_no: { type: "string" } }, req: ["order_no"],
    run(a) {
      const o = aiFind(a.order_no), c = calc(o);
      return { ...aiOrderRow(o), phone: clientPhone(o) || null, category: o.cat || null, source: o.source || null, items: o.items, discount: o.discount || 0, down_payment_percent: c.pct, down_payment: c.dp, paid_in_full_upfront: !!o.fullPay,
        payments: receipts(o).map(r => ({ what: r.kind, date: fmtDate(r.at), amount: r.amount })), timeline: Object.fromEntries(flowOf(o).filter(s => at(o, s)).map(s => [stageLabel(o, s), fmtDateTime(at(o, s))])),
        revisions: (o.revs || []).map(v => ({ type: REV_TYPE[v.type || "minor"].label, note: v.note, fee: v.fee || 0, paid: !!v.paidAt })), notes: o.notes || "", internal_memo: o.memo || "",
        costs: S.expenses.filter(x => x.orderId === o.id).map(x => ({ date: x.date, category: x.cat, amount: x.amount, note: x.note })), worker: o.assign?.workerId ? workerById(o.assign.workerId)?.name || null : null, documents: docsOf(o).map(k => `${DOC[k].title} ${docNo(o, k)}`) };
    }
  },
  search_customers: {
    d: "Find customers with their WhatsApp number, number of orders and amount paid.",
    p: { query: { type: "string" } },
    run(a) { const q = String(a.query || "").toLowerCase(); const L = S.customers.filter(c => !q || [c.name, c.phone, c.note].join(" ").toLowerCase().includes(q)); return { found: L.length, customers: L.slice(0, 50).map(c => { const s = custStats(c); return { name: c.name, phone: c.phone || null, note: c.note || null, orders: s.count, paid: s.paid ?? null }; }) }; }
  },
  business_summary: {
    d: "Money overview: cash received, expenses and new orders for a month, plus what customers still owe now.",
    p: { month: { type: "string", description: "YYYY-MM, default this month" } },
    run(a) { const m = a.month || todayISO().slice(0, 7), act = S.orders.filter(isActive); return { ...aiMonthStats(m), active_orders: act.length, receivables_now: sum(S.orders, owedOf), awaiting_down_payment: act.filter(o => o.status === "menunggu_dp").length, in_progress: act.filter(o => o.status === "dikerjakan").length, overdue: S.orders.filter(isLate).length }; }
  },
  list_expenses: {
    d: "Expenses recorded in a month.", p: { month: { type: "string", description: "YYYY-MM, default this month" } },
    run(a) { const m = a.month || todayISO().slice(0, 7), L = S.expenses.filter(x => String(x.date || "").startsWith(m)); return { month: m, total: sum(L, x => x.amount), expenses: L.map(x => ({ date: x.date, category: x.cat, amount: x.amount, note: x.note || "", order_no: x.orderId ? qfmt(S.orders.find(o => o.id === x.orderId)?.queue) : null })) }; }
  },
  search_price_list: {
    d: "Services and prices from the price list.", p: { query: { type: "string" } },
    run(a) { const q = String(a.query || "").toLowerCase(); return { services: S.prices.filter(p => !q || [p.code, p.name, p.cat, p.group, p.note].join(" ").toLowerCase().includes(q)).slice(0, 60).map(p => ({ category: p.cat, name: p.name, price: priceTxt(p), unit: p.unit || null })) }; }
  },
  whatsapp_message: {
    d: "The ready-to-send WhatsApp message for an order stage, exactly as the app writes it.",
    p: { order_no: { type: "string" }, stage: { type: "string", enum: Object.keys(AI_STAGE) } }, req: ["order_no", "stage"],
    run(a) { return { message: waText(aiFind(a.order_no), AI_STAGE[a.stage]) }; }
  },
  create_order: {
    d: "Create a new order (status Awaiting Down Payment). The customer is found by name or created.",
    p: { customer_name: { type: "string" }, customer_phone: { type: "string" }, job: { type: "string", description: "Job description" }, items: AI_ITEMS, due_date: { type: "string", description: "YYYY-MM-DD or YYYY-MM-DDTHH:mm" }, down_payment_percent: { type: "integer" }, category: { type: "string" }, notes: { type: "string", description: "Notes printed on the documents" } },
    req: ["job", "items"], write: true,
    async run(a) {
      const items = aiItems(a.items); if (!items.length) throw new Error("At least one item with a price is needed");
      let cust = null;
      if (a.customer_name) { const ex = S.customers.find(c => normName(c.name) === normName(a.customer_name)); cust = ex ? (a.customer_phone && a.customer_phone !== ex.phone ? await saveCustomer({ ...ex, phone: a.customer_phone }) : ex) : await saveCustomer({ id: uid("c"), name: a.customer_name.trim(), phone: a.customer_phone || "", note: "" }); }
      const now = Date.now();
      const o = await saveOrder({ id: uid("o"), queue: nextQueue(), date: todayISO(), project: a.job.trim(), items, customerId: cust ? cust.id : null, dpPct: a.down_payment_percent ?? S.settings.dpPct, cat: a.category || "", source: "", notes: a.notes || "", memo: "",
        ...(aiDue(a.due_date) || { dueType: "exact", deadline: "", deadlineFrom: "" }), status: "menunggu_dp", hist: { menunggu_dp: now }, createdAt: now, revs: [], log: [] }, "AI: order created, down payment invoice issued");
      return { created: aiOrderRow(o) };
    }
  },
  update_order: {
    d: "Change fields of an order. Only the fields given are changed. items replaces all line items.",
    p: { order_no: { type: "string" }, job: { type: "string" }, due_date: { type: "string", description: "YYYY-MM-DD or YYYY-MM-DDTHH:mm" }, notes: { type: "string" }, internal_memo: { type: "string" }, discount: { type: "integer" }, down_payment_percent: { type: "integer" }, category: { type: "string" }, items: AI_ITEMS },
    req: ["order_no"], write: true,
    async run(a) {
      const o = aiFind(a.order_no), n = { ...o }, ch = [];
      if (a.job != null) { n.project = a.job; ch.push("job description"); }
      if (a.due_date != null) { const d = aiDue(a.due_date); if (!d) throw new Error("due_date must be YYYY-MM-DD or YYYY-MM-DDTHH:mm"); Object.assign(n, d); ch.push("due date → " + dueText(n)); }
      if (a.notes != null) { n.notes = a.notes; ch.push("notes"); }
      if (a.internal_memo != null) { n.memo = a.internal_memo; ch.push("internal memo"); }
      if (a.discount != null) { n.discount = Math.max(0, toNum(a.discount)); ch.push("discount → " + rp(n.discount)); }
      if (a.down_payment_percent != null) { n.dpPct = Math.max(0, Math.min(100, toNum(a.down_payment_percent))); ch.push(`down payment → ${n.dpPct}%`); }
      if (a.category != null) { n.cat = a.category; ch.push("category → " + (a.category || "none")); }
      if (a.items) { n.items = aiItems(a.items); if (!n.items.length) throw new Error("items may not be empty"); ch.push("line items"); }
      if (!ch.length) return { changed: false };
      if ((n.discount || 0) > calc(n).sub) throw new Error("Discount may not exceed the subtotal");
      return { changed: ch, order: aiOrderRow(await aiCommit(o, n, "edited " + ch.join(", "))) };
    }
  },
  change_order_status: {
    d: "Move an order through its flow. advance = next stage (down payment received → final invoice issued → final payment received → closed). confirm_full_payment = paid in full while awaiting the down payment. revert = back one stage. cancel = cancel the order.",
    p: { order_no: { type: "string" }, action: { type: "string", enum: ["advance", "confirm_full_payment", "revert", "cancel"] }, reason: { type: "string", description: "For cancel" }, refund: { type: "boolean", description: "For cancel when money was received: true = refunded, false = forfeited" }, amount_received: { type: "integer", description: "For advance from Awaiting Down Payment: the rupiah actually paid when it differs from the down payment asked" } },
    req: ["order_no", "action"], write: true,
    async run(a) {
      const o = aiFind(a.order_no); let n, what;
      if (a.action === "advance") { const s = nextOf(o); if (!s || o.status === "batal") throw new Error(`Order is ${ST[o.status].label}; there is no next stage`);
        const amt = o.status === "menunggu_dp" ? toNum(a.amount_received) : 0, c = calc(o);
        if (amt && amt >= c.total) { n = withStatus(o, "dikerjakan", { fullPay: true }); what = `full payment received (${rp(amt)}), status → In Progress`; }
        else { n = withStatus(o, s); if (amt && amt !== c.asked) n.dpPaid = amt; what = `status → ${ST[s].label}${amt ? `, down payment received ${rp(amt)}` : ""}`; } }
      else if (a.action === "confirm_full_payment") { if (o.status !== "menunggu_dp") throw new Error("Full payment can only be confirmed while awaiting the down payment"); n = withStatus(o, "dikerjakan", { fullPay: true }); what = "full payment received, status → In Progress"; }
      else if (a.action === "revert") { const p = prevOf(o); if (!p) throw new Error("Already at the first stage"); n = withStatus(o, p); what = `status reverted → ${ST[p].label}`; }
      else if (a.action === "cancel") {
        if (o.status === "batal") throw new Error("Already cancelled"); if (idx(o.status) >= idx("lunas")) throw new Error("A paid order cannot be cancelled");
        const paid = effIdx(o) >= idx("dikerjakan");
        n = { ...o, status: "batal", hist: { ...o.hist, batal: Date.now() }, cancel: { at: Date.now(), from: o.status, reason: a.reason || "", rule: paid ? (a.refund ? "refund" : "hangus") : null } }; what = "order cancelled" + (a.reason ? ` (${a.reason})` : "");
      } else throw new Error("Unknown action");
      return { done: what, order: aiOrderRow(await aiCommit(o, n, what)) };
    }
  },
  add_expense: {
    d: "Record an expense (cost), optionally linked to an order.",
    p: { amount: { type: "integer" }, category: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, default today" }, note: { type: "string" }, order_no: { type: "string" } }, req: ["amount", "category"], write: true,
    async run(a) {
      const o = a.order_no ? aiFind(a.order_no) : null, cat = S.settings.expCats.find(c => c.toLowerCase() === String(a.category).toLowerCase()) || a.category;
      const x = { id: uid("x"), date: /^\d{4}-\d{2}-\d{2}$/.test(a.date || "") ? a.date : todayISO(), cat, amount: Math.max(0, toNum(a.amount)), note: a.note || "", orderId: o ? o.id : null, createdAt: Date.now(), updatedAt: Date.now() };
      await Store.put("expenses", x); audit(`AI: expense ${cat} ${rp(x.amount)} recorded${o ? ` for order ${qfmt(o.queue)}` : ""}`, "expenses");
      return { recorded: { date: x.date, category: cat, amount: x.amount, note: x.note, order_no: o ? qfmt(o.queue) : null } };
    }
  },
  add_revision: {
    d: "Record a revision or extra work on an order. minor = free revision (counts toward the free limit); major = paid revision; addon = paid additional work within the same scope. Paid kinds need a fee and get their own invoice.",
    p: { order_no: { type: "string" }, type: { type: "string", enum: ["minor", "major", "addon"] }, note: { type: "string", description: "What the customer asked for" }, fee: { type: "integer", description: "Rupiah, for major and addon" }, paid: { type: "boolean", description: "Already paid (major/addon)" } }, req: ["order_no", "type", "note"], write: true,
    async run(a) {
      const o = aiFind(a.order_no); if (o.status === "batal") throw new Error("The order is cancelled");
      const paidKind = REV_TYPE[a.type]?.paid, fee = paidKind ? toNum(a.fee) : 0; if (!REV_TYPE[a.type]) throw new Error("type must be minor, major or addon"); if (paidKind && !fee) throw new Error("A paid revision or add-on needs a fee");
      const v = { id: uid("r"), at: Date.now(), type: a.type, note: String(a.note || "").trim(), fee, paidAt: paidKind && a.paid ? Date.now() : null };
      const what = `${REV_TYPE[a.type].label.toLowerCase()} recorded: ${v.note}${fee ? ` (${rp(fee)}${v.paidAt ? ", paid" : ", unpaid"})` : ""}`;
      return { done: what, order: aiOrderRow(await aiCommit(o, { ...o, revs: [...(o.revs || []), v] }, what)) };
    }
  },
  mark_extra_paid: {
    d: "Mark an unpaid major revision or additional work as paid. which = its number among the paid extras (1 = first) or words from its note.",
    p: { order_no: { type: "string" }, which: { type: "string" } }, req: ["order_no"], write: true,
    async run(a) {
      const o = aiFind(a.order_no), X = extrasOf(o), open = X.filter(x => !x.paidAt); if (!open.length) throw new Error("This order has no unpaid extra charges");
      const w = String(a.which || "").trim(), x = !w ? (open.length === 1 ? open[0] : null) : /^\d+$/.test(w) ? X[+w - 1] : open.find(v => (v.note || "").toLowerCase().includes(w.toLowerCase()));
      if (!x) throw new Error(`Say which one: ${open.map(v => `${X.indexOf(v) + 1} = ${v.note} (${rp(v.fee)})`).join("; ")}`);
      if (x.paidAt) throw new Error("That one is already paid");
      const what = `${REV_TYPE[x.type].short} paid: ${rp(x.fee)} (${x.note})`;
      return { paid: { note: x.note, fee: x.fee }, order: aiOrderRow(await aiCommit(o, { ...o, revs: o.revs.map(v => v.id === x.id ? { ...v, paidAt: Date.now() } : v) }, what)) };
    }
  },
  assign_worker: {
    d: "Assign an order to a worker with the agreed fee, or remove the worker (worker_name empty). The worker must exist in Workers.",
    p: { order_no: { type: "string" }, worker_name: { type: "string" }, fee: { type: "integer" } }, req: ["order_no"], write: true,
    async run(a) {
      const o = aiFind(a.order_no); if (feePaid(o)) throw new Error("The worker fee is already paid; delete that payment in Expenses first");
      if (!a.worker_name) return { done: "worker removed", order: aiOrderRow(await aiCommit(o, { ...o, assign: null }, "worker removed")) };
      const w = S.workers.find(x => normName(x.name) === normName(a.worker_name)) || S.workers.find(x => normName(x.name).includes(normName(a.worker_name)));
      if (!w) throw new Error(`Worker "${a.worker_name}" not found. Workers: ${S.workers.map(x => x.name).join(", ") || "none yet"}`);
      const fee = toNum(a.fee);
      return { assigned: w.name, fee, order: aiOrderRow(await aiCommit(o, { ...o, assign: { ...(o.assign || {}), workerId: w.id, fee } }, `assigned to ${w.name}, fee ${rp(fee)}`)) };
    }
  },
  update_customer: {
    d: "Change a customer's name, WhatsApp number or note. The change shows on every order of the customer.",
    p: { customer_name: { type: "string", description: "Current name" }, new_name: { type: "string" }, phone: { type: "string" }, note: { type: "string" } }, req: ["customer_name"], write: true,
    async run(a) {
      const c = S.customers.find(x => normName(x.name) === normName(a.customer_name)); if (!c) throw new Error(`Customer "${a.customer_name}" not found`);
      const n = { ...c, ...(a.new_name ? { name: a.new_name.trim() } : {}), ...(a.phone != null ? { phone: a.phone } : {}), ...(a.note != null ? { note: a.note } : {}) };
      await saveCustomer(n); audit(`AI: customer ${c.name} updated`, `customer/${c.id}`); return { updated: { name: n.name, phone: n.phone, note: n.note } };
    }
  }
};
const aiToolDefs = () => Object.entries(AI_TOOLS).map(([name, t]) => ({ type: "function", function: { name, description: t.d, parameters: { type: "object", properties: t.p, required: t.req || [] } } }));

/* ---------- conversation ---------- */
/* sent: the system prompt plus the latest turns, cut only at a user message so tool calls stay paired with their results */
function aiContext() {
  let L = AI.msgs.filter(m => !m.error);
  if (L.length > 40) { const i = L.findIndex((m, j) => j >= L.length - 40 && m.role === "user"); L = L.slice(i < 0 ? L.length - 40 : i); }
  return [{ role: "system", content: aiSystem() }, ...L.map(({ role, content, tool_calls, tool_call_id }) => ({ role, content: content ?? "", ...(tool_calls ? { tool_calls } : {}), ...(tool_call_id ? { tool_call_id } : {}) }))];
}
async function aiSend(text) {
  if (AI.busy || !text.trim()) return;
  const c = Auth.session(); if (!c) return toast("Sign in first");
  AI.busy = true; AI.msgs.push({ role: "user", content: text.trim() }); aiDraw();
  try {
    for (let round = 0; round < 8; round++) {
      const r = await Auth.post("/ai/chat", { messages: aiContext(), tools: aiToolDefs() }, c.token), m = r.message || {};
      AI.msgs.push({ role: "assistant", content: m.content || "", ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}), usage: r.usage }); aiDraw();
      if (!m.tool_calls?.length) break;
      for (const tc of m.tool_calls) {
        const t = AI_TOOLS[tc.function?.name]; let out, args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); out = t ? await t.run(args) : { error: "Unknown tool" }; }
        catch (e) { out = { error: e.message || String(e) }; }
        AI.msgs.push({ role: "tool", tool_call_id: tc.id, name: tc.function?.name, args, content: JSON.stringify(out), write: !!t?.write, ok: !out.error }); aiDraw();
      }
    }
  } catch (e) { AI.msgs.push({ role: "assistant", content: "", error: navigator.onLine ? e.message : "No internet connection." }); if (e.status === 401) Auth.expired(); }
  AI.busy = false; aiSave(); aiDraw(); updateStoreInfo();
}

/* ---------- page ---------- */
/* the model's reply as blocks: short bold lines become headings, "- " and "1. " runs become lists, the rest paragraphs */
const aiInline = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,:;!?]|$)/g, "$1<b>$2</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
function aiMd(src) {
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.map(aiInline).join("<br>")}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map(x => `<li>${aiInline(x)}</li>`).join("")}</${list.t}>`); list = null; } };
  String(src || "").replace(/\r/g, "").split("\n").forEach(line => {
    const l = line.trim(), ul = l.match(/^[-•*]\s+(.*)/), ol = l.match(/^\d+[.)]\s+(.*)/), h = l.match(/^#{1,4}\s+(.*)/) || l.match(/^\*\*([^*]+)\*\*:?$/);
    if (!l) { flushP(); flushL(); return; }
    if (ul || ol) { flushP(); const t = ul ? "ul" : "ol"; if (list && list.t !== t) flushL(); list = list || { t, items: [] }; list.items.push((ul || ol)[1]); return; }
    flushL();
    if (h) { flushP(); out.push(`<p class="h">${aiInline(h[1].replace(/\*\*/g, ""))}</p>`); return; }
    para.push(l);
  });
  flushP(); flushL(); return out.join("");
}
const AI_TOOL_LABEL = { search_orders: "Searched orders", get_order: "Opened order", search_customers: "Searched customers", business_summary: "Read the money overview", list_expenses: "Read expenses", search_price_list: "Read the price list", whatsapp_message: "Wrote the WhatsApp message for order", create_order: "Created order", update_order: "Changed order", change_order_status: "Changed the status of order", add_expense: "Recorded an expense", update_customer: "Changed a customer", add_revision: "Recorded a revision on order", mark_extra_paid: "Marked an extra charge paid on order", assign_worker: "Assigned a worker to order" };
function aiStep(m) {
  let out = {}; try { out = JSON.parse(m.content); } catch (e) {}
  const no = m.args?.order_no || out.created?.order_no, o = no ? S.orders.find(x => toNum(x.queue) === aiNo(no)) : null;
  const extra = m.name === "search_orders" && out.found != null ? ` (${out.found} found)` : no ? ` ${esc(String(no))}` : "";
  return `<div class="ai-step${m.write ? " w" : ""}${m.ok ? "" : " bad"}">${ic(m.write ? "edit" : "list")}<span>${AI_TOOL_LABEL[m.name] || esc(m.name)}${extra}${m.ok ? "" : `: ${esc(out.error || "failed")}`}</span>${o ? `<a href="#/order/${esc(o.id)}">Open</a>` : ""}</div>`;
}
/* one turn = the owner's message, the steps the assistant took (one framed list) and its reply */
function aiDraw() {
  const box = $("#aiLog"); if (!box) return;
  const turns = []; let t = null, steps = [];
  const endSteps = () => { if (steps.length) { t.parts.push(`<div class="ai-steps">${steps.join("")}</div>`); steps = []; } };
  AI.msgs.forEach(m => {
    if (m.role === "user") { if (t) endSteps(); t = { parts: [`<div class="ai-me">${esc(m.content).replace(/\n/g, "<br>")}</div>`] }; turns.push(t); return; }
    if (!t) return;
    if (m.role === "tool") { steps.push(aiStep(m)); return; }
    if (m.error) { endSteps(); t.parts.push(`<div class="ai-err">${esc(m.error)}</div>`); return; }
    if (m.content) { endSteps(); t.parts.push(`<div class="ai-say">${aiMd(m.content)}</div>`); }
  });
  if (t) endSteps();
  if (AI.busy && t) t.parts.push(`<div class="ai-wait">Working…</div>`);
  const sugg = ["Order mana saja yang belum lunas?", "Ringkasan keuangan bulan ini", "Order apa yang tenggatnya minggu ini?", "Buatkan pesan pengingat bayar untuk order yang menunggu DP"];
  box.innerHTML = `<div class="ai-col">${turns.length ? turns.map(x => `<div class="ai-turn">${x.parts.join("")}</div>`).join("")
    : `<div class="ai-empty"><p class="lead">Ask about your orders, customers and money, or tell the assistant what to change.</p><div class="ai-sugg">${sugg.map(q => `<button class="btn" type="button" data-ai-s="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`}</div>`;
  box.scrollTop = box.scrollHeight;
  const b = $("#aiGo"); if (b) { b.disabled = AI.busy || !Auth.session(); b.textContent = AI.busy ? "Working…" : "Send"; }
}
PAGES.ai = {
  title: "AI Assistant", nav: "ai",
  render() {
    const on = !!Auth.session(), used = sum(AI.msgs.filter(m => m.usage), m => (m.usage.prompt_tokens || 0) + (m.usage.completion_tokens || 0));
    return page("System", "AI Assistant", "DeepSeek, with access to every order, customer, payment and expense. Its changes are logged on the order and can be undone there.", "",
      panel("Conversation", `<div class="ai-log" id="aiLog"></div>
        <div class="ai-in"><form id="aiForm"><textarea id="aiQ" rows="1" placeholder="${on ? "Type a question or an instruction" : "Sign in to use the assistant"}" ${on ? "" : "disabled"}></textarea><button class="btn primary" id="aiGo" type="submit" ${on ? "" : "disabled"}>Send</button></form>
        <p class="hint">Questions and the data the assistant looks up are sent to DeepSeek.${used ? ` This chat has used about ${used.toLocaleString("id-ID")} tokens.` : ""}</p></div>`,
        { flush: true, cls: "ai-panel", right: `<button class="btn sm" data-ai="new" type="button">New Chat</button>` }));
  },
  after() {
    aiDraw();
    const q = $("#aiQ");
    $("#aiForm").onsubmit = e => { e.preventDefault(); const t = q.value; q.value = ""; q.style.height = ""; aiSend(t); };
    q.oninput = () => { q.style.height = "auto"; q.style.height = Math.min(160, q.scrollHeight + 2) + "px"; };
    q.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); $("#aiForm").requestSubmit(); } };
    $("#main").onclick = e => {
      const s = e.target.closest("[data-ai-s]"); if (s) return aiSend(s.dataset.aiS);
      if (e.target.closest('[data-ai="new"]') && !AI.busy) { AI.msgs = []; aiSave(); refresh(); }
    };
  }
};
