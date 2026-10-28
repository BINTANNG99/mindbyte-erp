/* MINDBYTE Order System: core.
   One source of truth (S). Every figure on screen (document numbers and dates, totals, balances,
   customer stats, reports, charts) is derived from S at render time, so an edit anywhere shows up everywhere. */
"use strict";

/* ---------- constants ---------- */
const FLOW = ["menunggu_dp", "dikerjakan", "minta_lunas", "lunas", "selesai"];
const ST = {
  menunggu_dp: { label: "Awaiting Down Payment", short: "Awaiting DP", doc: "dp", act: "Confirm Down Payment Received" },
  dikerjakan: { label: "In Progress", short: "In Progress", doc: "ko", act: "Issue Final Payment Invoice" },
  minta_lunas: { label: "Awaiting Final Payment", short: "Awaiting Final", doc: "pl", act: "Confirm Final Payment Received" },
  lunas: { label: "Paid, Revision Period", short: "Revision Period", doc: "kw", act: "Close Order" },
  selesai: { label: "Completed", short: "Completed", doc: "kw", act: "" },
  batal: { label: "Cancelled", short: "Cancelled", doc: null, act: "" }
};
const DOC = {
  dp: { title: "Down Payment Invoice", stage: "menunggu_dp" },
  ko: { title: "Order Confirmation", stage: "dikerjakan" },
  pl: { title: "Final Payment Invoice", stage: "minta_lunas" },
  kw: { title: "Receipt", stage: "lunas" }
};
/* the moment each stage happened, as labelled on the timeline editor */
const STAGE_LABEL = {
  menunggu_dp: ["Order received", "Order received"],
  dikerjakan: ["Down payment received", "Full payment received"],
  minta_lunas: ["Final payment invoice issued", ""],
  lunas: ["Final payment received", "Files delivered"],
  selesai: ["Order closed", "Order closed"]
};
const MAX_PRICE = 999999999999, MAX_QTY = 9999, MAX_TOTAL = 9999999999999;

/* WhatsApp messages: opening, body (headings in bold, plain lines, no bullets), ending */
const DEF_TPL = {
  dp: "{greeting}\n\nTerima kasih telah mempercayakan pekerjaan Anda kepada {business}. Berikut invoice uang muka (DP) yang kami lampirkan.\n\n*{document_title}*\nNo. {document_no}\n\n{details}\n\n*Pembayaran*\nDP {dp_percent}%: {down_payment}\nSisa setelah selesai: {balance}\n\nSilakan bayar DP melalui QRIS pada invoice terlampir, lalu kirim bukti pembayarannya di chat ini. Pengerjaan kami mulai setelah DP diterima.\n\nHormat kami,\n{business}",
  ko: "{greeting}\n\nDP sebesar {down_payment} sudah kami terima. Terima kasih, pengerjaan sudah kami mulai.\n\n*{document_title}*\nNo. {document_no}\n\n{details}\n\n*Pembayaran*\nDP diterima: {down_payment}\nSisa saat selesai: {balance}\n\nInvoice pelunasan akan kami kirim setelah pekerjaan selesai.\n\nHormat kami,\n{business}",
  kof: "{greeting}\n\nPembayaran penuh sebesar {total} sudah kami terima. Terima kasih, pengerjaan sudah kami mulai.\n\n*{document_title}*\nNo. {document_no}\n\n{details}\n\n*Pembayaran*\nLunas: {total}\n\nHasil pekerjaan akan kami kirim setelah selesai, paling lambat {due_date}.\n\nHormat kami,\n{business}",
  pl: "{greeting}\n\nPekerjaan Anda sudah selesai. Berikut invoice pelunasan yang kami lampirkan.\n\n*{document_title}*\nNo. {document_no}\n\n{details}\n\n*Pembayaran*\nDP diterima: {down_payment}\nSisa yang perlu dibayar: {balance}\n\nSilakan lakukan pelunasan melalui QRIS pada invoice terlampir, lalu kirim bukti pembayarannya di chat ini. File hasil kami kirim setelah pelunasan diterima.\n\nHormat kami,\n{business}",
  kw: "{greeting}\n\nPelunasan sudah kami terima. Terima kasih, file hasil pekerjaan kami kirim bersama pesan ini.\n\n*{document_title}*\nNo. {document_no}\n\n{details}\n\n*Pembayaran*\nTotal dibayar: {total}\n\nJika ada bagian yang perlu direvisi, silakan sampaikan di chat ini selama masa revisi. Ketentuan revisi tercantum pada kwitansi terlampir.\n\nHormat kami,\n{business}",
  done: "{greeting}\n\nPekerjaan {job} sudah selesai dan kami tutup. Terima kasih telah mempercayakannya kepada {business}.\n\n*Ringkasan*\nTotal dibayar: {total}\n\nKami akan senang sekali menerima ulasan singkat dari Anda. Sampai jumpa di pekerjaan berikutnya.\n\nHormat kami,\n{business}",
  extra: "{greeting}\n\nSesuai permintaan Anda, berikut invoice untuk pekerjaan tambahan.\n\n*{document_title}*\nNo. {document_no}\n\n*Pekerjaan Tambahan*\n{extra_item}: {extra_amount}\n\nSilakan bayar melalui QRIS pada invoice terlampir, lalu kirim bukti pembayarannya di chat ini. Pekerjaan tambahan kami mulai setelah pembayaran diterima.\n\nHormat kami,\n{business}",
  extrapaid: "{greeting}\n\nPembayaran sebesar {extra_amount} untuk pekerjaan tambahan sudah kami terima. Terima kasih.\n\n*{document_title}*\nNo. {document_no}\n\n*Pekerjaan Tambahan*\n{extra_item}: {extra_amount}\nStatus: lunas\n\nHasilnya akan kami kirim setelah pekerjaan tambahan selesai.\n\nHormat kami,\n{business}",
  remind: "{greeting}\n\nKami ingin mengingatkan pembayaran untuk pekerjaan {job}.\n\n*Tagihan*\nJumlah: {amount_due}\n\nSilakan bayar melalui QRIS pada invoice yang sudah kami kirim, lalu kirim bukti pembayarannya di chat ini. Abaikan pesan ini jika pembayaran sudah dilakukan.\n\nHormat kami,\n{business}"
};
/* defaults of earlier versions: a saved message still equal to one of these follows the current default */
const OLD_TPL = [{
  dp: "{greeting}\n\nThank you for ordering with {business}. Here is the down payment invoice for your order.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n{details}\n\n*Payment*\nDown payment ({dp_percent}%): {down_payment}\nBalance after completion: {balance}\n\nPlease pay the down payment via the QRIS on the attached invoice and send the proof of payment in this chat. We start the work as soon as it is received.\n\nBest regards,\n{business}",
  ko: "{greeting}\n\nWe have received your down payment of {down_payment}. Thank you, your order is confirmed and the work has started.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n{details}\n\n*Payment*\nDown payment received: {down_payment}\nBalance due on completion: {balance}\n\nWe will send you the final payment invoice as soon as the work is complete.\n\nBest regards,\n{business}",
  kof: "{greeting}\n\nWe have received your payment of {total} in full. Thank you, your order is confirmed and the work has started.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n{details}\n\n*Payment*\nPaid in full: {total}\n\nWe will deliver the files as soon as the work is complete, no later than {due_date}.\n\nBest regards,\n{business}",
  pl: "{greeting}\n\nYour order is complete. Here is the final payment invoice.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n{details}\n\n*Payment*\nDown payment received: {down_payment}\nAmount due now: {balance}\n\nPlease pay via the QRIS on the attached invoice and send the proof of payment in this chat. We deliver the files as soon as it is received.\n\nBest regards,\n{business}",
  kw: "{greeting}\n\nWe have received your payment in full. Thank you. Your files are delivered together with this message.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n{details}\n\n*Payment*\nTotal paid: {total}\n\n*Revision Terms*\n{revision_terms}\n\nIf anything needs a minor revision, reply in this chat within the revision period.\n\nBest regards,\n{business}",
  done: "{greeting}\n\nOrder {order_no} is now closed. Thank you for trusting {business} with your work.\n\n*Order Summary*\nJob: {job}\nTotal paid: {total}\n\nWe would appreciate a short review of your experience. We look forward to working with you again.\n\nBest regards,\n{business}",
  extra: "{greeting}\n\nAs requested, here is the invoice for the additional work on order {order_no}.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n*Additional Work*\n{extra_item}: {extra_amount}\n\nPlease pay via the QRIS on the attached invoice and send the proof of payment in this chat. We start the additional work as soon as it is received.\n\nBest regards,\n{business}",
  extrapaid: "{greeting}\n\nWe have received your payment of {extra_amount} for the additional work on order {order_no}. Thank you.\n\n*{document_title}*\nNo. {document_no}\nOrder No. {order_no}\n\n*Additional Work*\n{extra_item}: {extra_amount}\nStatus: paid\n\nWe will send the result as soon as the additional work is complete.\n\nBest regards,\n{business}",
  remind: "{greeting}\n\nThis is a friendly reminder about the payment for order {order_no}.\n\n*Outstanding Payment*\nJob: {job}\nAmount due: {amount_due}\n\nPlease pay via the QRIS on the invoice we sent and share the proof of payment in this chat. If you have already paid, please ignore this message.\n\nBest regards,\n{business}"
}, {
  dp: "{greeting}\n\nThank you for your order with {business}. Please find attached the down payment invoice for your order.\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n{details}\n\n*Down payment ({dp_percent}%): {down_payment}*\nBalance due: {balance} (payable upon completion)\n\nPlease pay the down payment via the QRIS on the attached invoice and send us the proof of payment. Your order will be processed once the down payment is received.\n\nBest regards,\n{business}",
  ko: "{greeting}\n\nWe have received your down payment of {down_payment}. Thank you, your order is now in progress.\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n{details}\nDown payment received: {down_payment}\nBalance due: {balance}\n\nThe balance is payable upon completion, before the files are delivered.\n\nBest regards,\n{business}",
  kof: "{greeting}\n\nWe have received your payment of {total} in full. Thank you, your order is now in progress.\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n{details}\nStatus: *PAID IN FULL*\n\nThe files will be delivered upon completion, no later than the due date.\n\nBest regards,\n{business}",
  pl: "{greeting}\n\nWe are pleased to inform you that your order has been completed.\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n{details}\nDown payment received: {down_payment}\n*Amount due: {balance}*\n\nPlease settle the final payment via the QRIS on the attached invoice and send us the proof of payment. The files will be delivered once the final payment is received.\n\nBest regards,\n{business}",
  kw: "{greeting}\n\nWe have received your payment in full. Thank you. The files for your order will be delivered following this message.\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n{details}\nStatus: *PAID*\n\n*Revision terms:*\n{revision_terms}\n\nBest regards,\n{business}",
  extra: "{greeting}\n\nAs requested, here is the invoice for the additional work on order {order_no} ({job}).\n\n*{document_title} · {business}*\nNo. {document_no} · Order No. {order_no}\n- {extra_item}: {extra_amount}\n\nPlease pay via the QRIS on the attached invoice and send us the proof of payment. The work will be delivered once the payment is received.\n\nBest regards,\n{business}",
  extrapaid: "{greeting}\n\nWe have received your payment of {extra_amount} for the additional work on order {order_no}. Thank you.\n\n*{document_title} · {business}*\nNo. {document_no}\n- {extra_item}: {extra_amount}\nStatus: *PAID*\n\nBest regards,\n{business}",
  remind: "{greeting}\n\nA friendly reminder that the payment of {amount_due} for order {order_no} ({job}) is still outstanding.\n\nPlease pay via the QRIS on the invoice we sent and share the proof of payment here. Thank you.\n\nBest regards,\n{business}"
}];
const TPL_NAMES = { dp: "Down Payment Invoice", ko: "Order Confirmation", kof: "Order Confirmation (Paid in Full)", pl: "Final Payment Invoice", kw: "Receipt", extra: "Additional Charge Invoice", extrapaid: "Additional Charge Receipt", remind: "Payment Reminder", done: "Order Closed (Thank You)" };
const TPL_KEYS = ["greeting", "name", "business", "document_title", "document_no", "order_no", "job", "due_date", "details", "total", "dp_percent", "down_payment", "balance", "amount_due", "extra_item", "extra_amount", "revision_terms"];
/* placeholder names used by earlier versions */
const TPL_ALIAS = { sapaan: "greeting", nama: "name", judul_dokumen: "document_title", no_dokumen: "document_no", nomor_order: "order_no", uraian: "job", jatuh_tempo: "due_date", rincian: "details", persen_dp: "dp_percent", uang_muka: "down_payment", sisa: "balance", ketentuan_revisi: "revision_terms" };

const DEF_SETTINGS = {
  business: "MINDBYTE", est: "est. 2019", nmid: "ID1024357290542", wa: "", bank: "",
  lastQueue: 3066, dpPct: 50, revMax: 2, revHours: 2, monthlyTarget: 0,
  docNo: { dp: "INV-{n}-DP", ko: "OC-{n}", pl: "INV-{n}-FP", kw: "RCT-{n}" },
  rev: "Minor revisions are free: a maximum of {max} may be requested within {hours} hours after the files are delivered.\nMinor revisions cover corrections to content and formatting within the job description.\nMajor revisions and additions within the same scope are charged separately and invoiced before the work starts.\nChanges to the title, topic or focus are treated as new work.\nAfter {hours} hours or {max} minor revisions, the work is considered complete.",
  foot: "This document is electronically generated and is valid as proof of transaction.",
  tpl: {},
  sources: ["WhatsApp", "X / Twitter", "Instagram", "TikTok", "Referral", "Repeat customer", "Other"],
  expCats: ["Worker Pay", "Journal Fees (APC)", "Tools & Subscriptions", "Advertising", "Other"],
  qrisFile: null, logoFile: null, theme: "auto", lastBackup: 0
};
/* defaults saved by earlier versions are replaced with the current wording */
const OLD_REV = [
  "Minor revisions are free: a maximum of {max} may be requested within {hours} hours after the files are delivered.\nMinor revisions cover corrections to content and formatting within the job description.\nMajor revisions and additions within the same scope are charged separately and invoiced before the work starts.\nChanges to the title, topic or focus are treated as a new order.\nAfter {hours} hours or {max} minor revisions, the order is considered complete.",
  "Revisi maksimal 2 kali, diajukan paling lambat 2 jam setelah file dikirim.\nRevisi mencakup perbaikan isi, format, dan penyesuaian sesuai uraian pekerjaan.\nPerubahan judul/topik atau penambahan lingkup di luar uraian dihitung sebagai order baru.\nLewat 2 jam atau setelah 2 kali revisi, order dinyatakan selesai.",
  "A maximum of 2 revisions may be requested within 2 hours after the files are delivered.\nRevisions cover corrections to content and formatting, and adjustments within the job description.\nChanges to the title or topic, or additions beyond the job description, are treated as a new order.\nAfter 2 hours or 2 revisions, the order is considered complete.",
  "A maximum of {max} revisions may be requested within {hours} hours after the files are delivered.\nRevisions cover corrections to content and formatting, and adjustments within the job description.\nChanges to the title or topic, or additions beyond the job description, are treated as a new order.\nAfter {hours} hours or {max} revisions, the order is considered complete."
];

/* ---------- state ---------- */
const S = { orders: [], customers: [], prices: [], expenses: [], workers: [], settings: { ...DEF_SETTINGS }, hist: {}, audit: [] };

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const toNum = v => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;
const rp = n => (n < 0 ? "−" : "") + "Rp " + Math.round(Math.abs(n || 0)).toLocaleString("id-ID");
/* compact rupiah for chart axes and tight tiles: 1,2 jt / 450 rb */
const rpShort = n => { const a = Math.abs(n || 0), s = n < 0 ? "−" : "";
  if (a >= 1e9) return s + (a / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (a >= 1e6) return s + (a / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString("id-ID") + " rb";
  return s + Math.round(a); };
const qfmt = n => n ? Number(n).toLocaleString("id-ID") : "-";
const num = (n, d = 1) => Number(n).toLocaleString("id-ID", { maximumFractionDigits: d });
const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + "s")}`;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayISO = () => isoDate(new Date());
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = k => { const [y, m] = k.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const monthShort = k => { const [y, m] = k.split("-").map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`; };
function toDate(v) { return typeof v === "number" ? new Date(v) : new Date(String(v).length === 10 ? v + "T00:00" : v); }
function fmtDate(v) { if (!v) return "-"; const d = toDate(v); if (isNaN(d)) return String(v); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtShort(v) { if (!v) return "-"; const d = toDate(v); if (isNaN(d)) return "-"; return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; }
function fmtNum(v) { if (!v) return "-"; const d = toDate(v); if (isNaN(d)) return String(v); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function fmtTime(v) { const d = toDate(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDateTime(v) { if (!v) return "-"; const d = toDate(v); if (isNaN(d)) return String(v); return `${fmtDate(d.getTime())}, ${fmtTime(d)} WIB`; }
function fmtRange(a, b) {
  if (!a) return fmtDate(b); if (!b) return fmtDate(a);
  const x = toDate(a), y = toDate(b); if (isNaN(x) || isNaN(y)) return `${a} – ${b}`;
  if (x.getFullYear() === y.getFullYear()) {
    if (x.getMonth() === y.getMonth()) return x.getDate() === y.getDate() ? fmtDate(b) : `${x.getDate()}–${y.getDate()} ${MONTHS[y.getMonth()]} ${y.getFullYear()}`;
    return `${x.getDate()} ${MONTHS[x.getMonth()]} – ${fmtDate(b)}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}
const toLocal = t => { if (!t) return ""; const d = new Date(t); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocal = v => v ? new Date(v).getTime() : null;
function ago(t) { if (!t) return "-"; const h = (Date.now() - t) / 3600e3; if (h < 1) return "under 1 hour"; if (h < 24) return plural(Math.floor(h), "hour"); return plural(Math.floor(h / 24), "day"); }
function untilText(t) { const h = (t - Date.now()) / 3600e3; if (h < 0) return `${ago(t)} overdue`; if (h < 1) return "within the hour"; if (h < 48) return `in ${plural(Math.floor(h), "hour")}`; return `in ${plural(Math.floor(h / 24), "day")}`; }
function waNumber(p) { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d; }
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const sum = (L, f = x => x) => L.reduce((a, x) => a + (f(x) || 0), 0);

/* ---------- order maths (all derived) ---------- */
const idx = s => FLOW.indexOf(s);
const at = (o, s) => o.hist && o.hist[s] || null;
const eff = o => o.status === "batal" ? (o.cancel && o.cancel.from) || "menunggu_dp" : o.status;
const effIdx = o => idx(eff(o));
const flowOf = o => o.fullPay ? FLOW.filter(s => s !== "minta_lunas") : FLOW;
const nextOf = o => { const f = flowOf(o); return f[f.indexOf(o.status) + 1]; };
const prevOf = o => { const f = flowOf(o); return f[f.indexOf(o.status) - 1]; };
const actOf = o => o.fullPay && o.status === "dikerjakan" ? "Deliver Files & Issue Receipt" : ST[o.status].act;
const isActive = o => o.status !== "selesai" && o.status !== "batal";
const stageLabel = (o, s) => STAGE_LABEL[s][o.fullPay ? 1 : 0] || ST[s].label;
/* dp = the down payment: what was asked (dpPct of the total), or, once confirmed, what the customer actually paid (dpPaid,
   kept only when it differs). The balance always follows the money really received. asked/askedPct = what the DP invoice asks. */
function calc(o) {
  const sub = sum(o.items || [], i => i.qty * i.price);
  const total = Math.max(0, sub - (o.discount || 0));
  const askedPct = o.dpPct ?? S.settings.dpPct, asked = Math.round(total * askedPct / 100);
  const dp = o.dpPaid != null && !o.fullPay ? Math.min(total, o.dpPaid) : asked;
  const pct = dp === asked ? askedPct : total ? Math.round(dp / total * 1000) / 10 : 0;
  return { sub, total, pct, dp, rest: total - dp, asked, askedPct };
}
/* the figures of the down payment invoice: always what was asked, even after a different amount came in */
const askedCalc = o => { const c = calc(o); return { ...c, dp: c.asked, pct: c.askedPct, rest: c.total - c.asked }; };
/* money actually received, dated, including a refund on cancellation */
function receipts(o) {
  const c = calc(o), e = effIdx(o), r = [];
  if (e >= idx("dikerjakan")) r.push({ at: at(o, "dikerjakan") || o.createdAt, kind: o.fullPay ? "Full Payment" : "Down Payment", amount: o.fullPay ? c.total : c.dp });
  if (e >= idx("lunas") && !o.fullPay) r.push({ at: at(o, "lunas") || o.updatedAt, kind: "Final Payment", amount: c.rest });
  extrasOf(o).filter(x => x.paidAt).forEach(x => r.push({ at: x.paidAt, kind: `${REV_TYPE[x.type].short}: ${x.note || ""}`.replace(/: $/, ""), amount: x.fee, extra: x.id }));
  if (o.status === "batal" && o.cancel && o.cancel.rule === "refund") { const p = sum(r, x => x.amount); if (p) r.push({ at: o.cancel.at, kind: "Refund", amount: -p }); }
  return r.filter(x => x.amount);
}
const paidOf = o => sum(receipts(o), x => x.amount);
const owedOf = o => isActive(o) || o.status === "selesai" ? grandTotal(o) - paidOf(o) : 0;
/* what the customer has been asked to pay right now: the open stage invoice plus any unpaid extra charge */
function billedNow(o) { const c = calc(o); return (o.status === "menunggu_dp" ? c.dp : o.status === "minta_lunas" ? c.rest : 0) + (o.status === "batal" ? 0 : extraOwed(o)); }
const costOf = o => sum(S.expenses.filter(x => x.orderId === o.id), x => x.amount);
const isLate = o => idx(o.status) < idx("minta_lunas") && o.status !== "batal" && o.deadline && toDate(o.deadline) < new Date();
/* delivered on time: work handed over (final invoice, or receipt when paid upfront) before the due moment */
function deliveredAt(o) { return o.fullPay ? at(o, "lunas") : at(o, "minta_lunas"); }
function onTime(o) { const d = deliveredAt(o); if (!d || !o.deadline || o.noAmount) return null; return d <= toDate(o.deadline).getTime() + 60e3; }

/* document number and date follow the order number and the timeline, so editing either updates every document */
const docNo = (o, k) => String((S.settings.docNo || DEF_SETTINGS.docNo)[k] || DEF_SETTINGS.docNo[k]).replace("{n}", o.queue || "-");
const docAt = (o, k) => at(o, DOC[k].stage) || (k === "kw" && o.fullPay ? at(o, "lunas") : null);
const docsOf = o => [...new Set(flowOf(o).filter(s => idx(s) <= effIdx(o)).map(s => ST[s].doc))].filter(k => k !== "dp" || o.fullPay || calc(o).dp > 0 || o.status === "menunggu_dp");

function dueText(o, short) {
  if (!o.deadline) return "-"; const t = o.dueType;
  if (t === "est") return `Est. ${fmtDate(o.deadline)}`;
  if (t === "range") return `Est. ${fmtRange(o.deadlineFrom, o.deadline)}`;
  return short ? fmtShort(o.deadline) + ", " + fmtTime(o.deadline) : fmtDateTime(o.deadline);
}
function dueSentence(o) {
  if (!o.deadline) return "will be completed by the agreed date"; const t = o.dueType;
  if (t === "est") return `is estimated to be completed by ${fmtDate(o.deadline)}`;
  if (t === "range" && o.deadlineFrom && o.deadlineFrom !== o.deadline.slice(0, 10)) return `is estimated to be completed between ${fmtRange(o.deadlineFrom, o.deadline).replace(/ – |–/, " and ")}`;
  if (t === "range") return `is estimated to be completed by ${fmtDate(o.deadline)}`;
  return `will be completed no later than ${fmtDateTime(o.deadline)}`;
}
const fillRules = t => String(t || "").replace(/\{max\}/g, S.settings.revMax).replace(/\{hours\}/g, S.settings.revHours);
const terms = () => fillRules(S.settings.rev).split("\n").map(t => t.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);
/* revisions and extra work on the same order:
   minor = free, counts toward the revision limit; major = paid revision; addon = paid addition within the same scope.
   Paid kinds carry their own fee, invoice, payment date and receipt, so money already received never changes. */
const REV_TYPE = {
  minor: { label: "Minor revision", short: "Minor revision", paid: false },
  major: { label: "Major revision", short: "Major revision", paid: true },
  addon: { label: "Additional work", short: "Add-on", paid: true }
};
const extrasOf = o => (o.revs || []).filter(x => REV_TYPE[x.type]?.paid && x.fee > 0);
const extraTotal = o => sum(extrasOf(o), x => x.fee);
const extraOwed = o => sum(extrasOf(o).filter(x => !x.paidAt), x => x.fee);
const grandTotal = o => calc(o).total + extraTotal(o);
const extraNo = (o, x, paid) => { const i = extrasOf(o).findIndex(y => y.id === x.id) + 1; return `${paid ? "RCT" : "INV"}-${o.queue || "-"}-X${i}`; };
function revState(o) {
  const start = at(o, "lunas"), end = start ? start + S.settings.revHours * 3600e3 : 0, used = (o.revs || []).filter(x => (x.type || "minor") === "minor").length, max = S.settings.revMax;
  const why = o.status !== "lunas" ? "The order has been closed." : used >= max ? `The limit of ${max} revisions has been reached.` : Date.now() > end ? `The revision period ended on ${fmtDateTime(end)}.` : "";
  return { end, used, max, why };
}

/* ---------- customers: one record, referenced by orders ---------- */
const custById = id => id ? S.customers.find(c => c.id === id) || null : null;
const custOf = o => custById(o.customerId);
const clientName = o => custOf(o)?.name || "";
const clientPhone = o => custOf(o)?.phone || "";
function custStats(c) {
  const L = S.orders.filter(o => o.customerId === c.id);
  const dates = L.map(o => toDate(o.date || o.createdAt).getTime()).filter(Boolean);
  return { orders: L, count: L.length, paid: sum(L, paidOf), owed: sum(L, owedOf), billed: sum(L.filter(o => o.status !== "batal"), o => grandTotal(o)),
    first: dates.length ? Math.min(...dates) : 0, last: dates.length ? Math.max(...dates) : 0 };
}
const normName = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/* ---------- duplicate order numbers ---------- */
function dupMap() {
  const by = new Map(), m = new Map();
  S.orders.forEach(o => { const q = toNum(o.queue); if (!q) return; if (!by.has(q)) by.set(q, []); by.get(q).push(o); });
  by.forEach(L => { if (L.length > 1) L.forEach(o => m.set(o.id, L.filter(x => x !== o))); });
  return m;
}
function nextQueue() { let max = toNum(S.settings.lastQueue); S.orders.forEach(o => { max = Math.max(max, toNum(o.queue)); }); return max + 1; }

/* ---------- category guess for imported orders (used once, editable afterwards) ---------- */
const CAT_RULES = [
  [/skripsi|thesis|tugas akhir|proposal/i, "Skripsi"],
  [/jurnal|journal|manuscript|publication|sinta|scopus/i, "Makalah, Essay, Artikel, Jurnal, Laporan"],
  [/spss|eviews|statistic|statistik|regres|smartpls|anova/i, "Jasa Joki Soal"],
  [/ppt|slide|presentation|power ?point/i, "Jasa Ketik Power Point"],
  [/translat|terjemah/i, "Jasa Joki Bahasa Asing"],
  [/parafras|paraphras|turnitin|plagiar/i, "Jasa Parafrase"],
  [/review|resume|rangkum|summary/i, "Resume, Review, Rangkuman"],
  [/soal|exam|quiz|question|problem|perhitungan|calculation/i, "Jasa Joki Soal"],
  [/poster|design|desain|video|logo|infograph|animasi|cv\b/i, "Kreasi / Karya"],
  [/daftar pustaka|reference|format|template|revisi|revision/i, "Revisi, Dapus, Dafis, Penomoran Halaman"],
  [/makalah|paper|essay|esai|artikel|article|laporan|report/i, "Makalah, Essay, Artikel, Jurnal, Laporan"]
];
const guessCat = o => { const t = [o.project, ...(o.items || []).map(i => i.name)].join(" "); const r = CAT_RULES.find(([re]) => re.test(t)); return r ? r[1] : ""; };

/* ---------- migration from the v23 format ---------- */
function normalizeOrder(o, nameIndex) {
  o = { ...o };
  if (!o.status) { const full = o.pay === "full"; o.status = o.done ? "selesai" : full ? "lunas" : "dikerjakan"; o.hist = { menunggu_dp: o.createdAt, dikerjakan: o.createdAt, ...(full ? { lunas: o.updatedAt } : {}) }; }
  o.hist = { ...(o.hist || {}) };
  /* v23 kept issued document numbers and dates; both are now derived from queue and timeline */
  if (o.docs) { Object.entries(o.docs).forEach(([k, d]) => { const s = DOC[k]?.stage; if (s && !o.hist[s] && d && d.at && idx(s) <= effIdx(o)) o.hist[s] = d.at; }); delete o.docs; }
  if (!o.customerId && nameIndex) {
    const n = normName(o.client);
    if (n && n !== "-") o.customerId = nameIndex(o.client, o.phone);
  }
  delete o.client; delete o.phone;
  if (o.cat === undefined) o.cat = guessCat(o);
  o.items = (o.items || []).map(i => ({ name: i.name || "", qty: Number(i.qty) || 1, price: Number(i.price) || 0, ...(i.priceId ? { priceId: i.priceId } : {}) }));
  o.revs = (o.revs || []).map(v => ({ id: v.id || uid("r"), type: v.type || "minor", fee: Number(v.fee) || 0, paidAt: v.paidAt || null, at: v.at, note: v.note || "" }));
  o.log = o.log || [];
  o.dpPct = o.dpPct ?? S.settings.dpPct;
  return o;
}
function migrateAll(raw) {
  const custs = [...(raw.customers || [])];
  /* names already on this device count too, so restoring an old backup twice does not duplicate customers */
  const byName = new Map([...S.customers, ...custs].map(c => [normName(c.name), c]));
  const nameIndex = (name, phone) => {
    const k = normName(name); let c = byName.get(k);
    if (!c) { c = { id: uid("c"), name: String(name).trim(), phone: phone || "", note: "", source: "", createdAt: Date.now(), updatedAt: Date.now() }; byName.set(k, c); custs.push(c); }
    else if (phone && !c.phone) c.phone = phone;
    return c.id;
  };
  const orders = (raw.orders || []).filter(o => o && o.id).map(o => normalizeOrder(o, nameIndex));
  const expenses = (raw.expenses || []).map(x => { x = { ...x }; delete x.queue; return x; });
  return { orders, customers: custs, expenses, prices: raw.prices || [] };
}
function loadSettings(s) {
  const d = DEF_SETTINGS;
  S.settings = { ...d, ...(s || {}), docNo: { ...d.docNo, ...((s && s.docNo) || {}) } };
  if (OLD_REV.includes(S.settings.rev)) S.settings.rev = d.rev;
  if (S.settings.foot === "Dokumen ini dibuat secara elektronik dan sah sebagai bukti transaksi.") S.settings.foot = d.foot;
  S.settings.tpl = S.settings.tpl || {};
  ["sources", "expCats"].forEach(k => { if (!Array.isArray(S.settings[k]) || !S.settings[k].length) S.settings[k] = [...d[k]]; });
}

/* ---------- storage: IndexedDB in this browser (swap this block for a cloud database later) ---------- */
const COLLS = ["orders", "customers", "prices", "expenses", "workers"];
const Store = {
  db: null, mode: "memory",
  open() {
    return new Promise(res => {
      if (!window.indexedDB) return res(null);
      const r = indexedDB.open("mindbyte-order", 2);
      r.onupgradeneeded = () => { const d = r.result; [...COLLS, "meta", "files"].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: "id" }); }); };
      /* a newer version opened in another tab asks this one to step aside; reload so both run the same code */
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); location.reload(); }; res(d); };
      /* never fall back silently: a second, empty copy in browser storage would split the data */
      r.onerror = () => bootProblem("The browser refused to open the database on this device.", r.error && r.error.message);
      r.onblocked = () => bootProblem("Another tab of the MINDBYTE system is still open with an older version, and it is holding the database. Close every other MINDBYTE tab or window; this page continues by itself once they are closed.");
      setTimeout(() => { if (r.readyState !== "done") bootProblem("The database on this device is not answering. Close every MINDBYTE tab and window, then open the system again. If it keeps happening, restart the browser."); }, 8000);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode), st = t.objectStore(store); let out;
      Promise.resolve(fn(st)).then(v => { out = v; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all(store) { return new Promise((res, rej) => { const q = this.db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); },
  async init() {
    this.db = await this.open();
    if (this.db) {
      this.mode = "device";
      for (const c of COLLS) S[c] = await this.all(c);
      const meta = await this.all("meta");
      loadSettings(meta.find(m => m.id === "settings")?.value);
      S.hist = meta.find(m => m.id === "hist")?.value || {};
      S.audit = meta.find(m => m.id === "audit")?.value || [];
    } else {
      this.mode = "local";
      for (const c of COLLS) S[c] = lsGet("mb9_" + c) || [];
      loadSettings(lsGet("mb9_settings")); S.hist = lsGet("mb9_hist") || {}; S.audit = lsGet("mb9_audit") || [];
    }
  },
  async put(coll, rec) {
    if (this.db) await this.tx(coll, "readwrite", st => st.put(rec)); else lsSet("mb9_" + coll, upsert(S[coll], rec));
    upsert(S[coll], rec); return rec;
  },
  async putMany(coll, recs) {
    if (!recs.length) return;
    if (this.db) await this.tx(coll, "readwrite", st => recs.forEach(r => st.put(r)));
    recs.forEach(r => upsert(S[coll], r)); if (!this.db) lsSet("mb9_" + coll, S[coll]);
  },
  async del(coll, id) {
    if (this.db) await this.tx(coll, "readwrite", st => st.delete(id));
    S[coll] = S[coll].filter(x => x.id !== id); if (!this.db) lsSet("mb9_" + coll, S[coll]);
  },
  async clear(coll) { if (this.db) await this.tx(coll, "readwrite", st => st.clear()); S[coll] = []; if (!this.db) lsSet("mb9_" + coll, []); },
  async meta(id, value) { if (this.db) await this.tx("meta", "readwrite", st => st.put({ id, value })); else lsSet("mb9_" + id, value); },
  async saveFile(blob, name) {
    const id = uid("f");
    if (!this.db) throw new Error("File storage is not available in this browser");
    await this.tx("files", "readwrite", st => st.put({ id, blob, name: name || "", type: blob.type, at: Date.now() }));
    return id;
  },
  async getFile(id) { if (!this.db || !id) return null; return new Promise(res => { const q = this.db.transaction("files").objectStore("files").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); },
  async delFile(id) { if (this.db && id) await this.tx("files", "readwrite", st => st.delete(id)); }
};
function upsert(L, rec) { const i = L.findIndex(x => x.id === rec.id); if (i >= 0) L[i] = rec; else L.push(rec); return L; }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error("Browser storage is full"); } }

/* object URLs for stored files (QRIS, logo, payment proofs) */
const FILE_URL = new Map();
async function fileUrl(id) {
  if (!id) return null; if (FILE_URL.has(id)) return FILE_URL.get(id);
  const f = await Store.getFile(id); if (!f) return null;
  const u = URL.createObjectURL(f.blob); FILE_URL.set(id, u); return u;
}
const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataUrlToBlob = async u => (await fetch(u)).blob();

/* ---------- writes (every write goes through here, then the screen re-renders from S) ---------- */
function logLine(o, text) { o.log = [...(o.log || []), { at: Date.now(), text }].slice(-80); }
async function saveOrder(o, logText) {
  o = { ...o, updatedAt: Date.now() };
  if (logText) logLine(o, logText);
  await Store.put("orders", o);
  if (logText) audit(`Order ${qfmt(o.queue)}: ${logText}`, `order/${o.id}`);
  return o;
}
async function deleteOrder(id) {
  const linked = S.expenses.filter(x => x.orderId === id);
  for (const x of linked) await Store.put("expenses", { ...x, orderId: null, updatedAt: Date.now() });
  const o = S.orders.find(x => x.id === id);
  for (const p of Object.values(o?.proofs || {})) await Store.delFile(p.fileId);
  await Store.del("orders", id); delete S.hist[id]; await Store.meta("hist", S.hist);
  if (o) audit(`Order ${qfmt(o.queue)} deleted (${o.project || "untitled"})`);
}
async function saveCustomer(c) { c = { ...c, updatedAt: Date.now(), createdAt: c.createdAt || Date.now() }; await Store.put("customers", c); return c; }
/* merge: every order of `from` moves to `into`, then `from` is removed */
async function mergeCustomers(intoId, fromId) {
  const into = custById(intoId), from = custById(fromId); if (!into || !from || intoId === fromId) return;
  const moved = S.orders.filter(o => o.customerId === fromId).map(o => ({ ...o, customerId: intoId, updatedAt: Date.now() }));
  await Store.putMany("orders", moved);
  await saveCustomer({ ...into, phone: into.phone || from.phone, note: [into.note, from.note].filter(Boolean).join("\n") });
  await Store.del("customers", fromId);
  audit(`Customer ${from.name} merged into ${into.name} (${plural(moved.length, "order")} moved)`, `customer/${intoId}`);
}
async function deleteCustomer(id) {
  const moved = S.orders.filter(o => o.customerId === id).map(o => ({ ...o, customerId: null, updatedAt: Date.now() }));
  const c = custById(id); await Store.putMany("orders", moved); await Store.del("customers", id);
  if (c) audit(`Customer ${c.name} deleted`);
}
async function saveSettings(patch) { S.settings = { ...S.settings, ...patch }; await Store.meta("settings", S.settings); }
/* per-order undo/redo of any change made on the order page */
const histOf = id => S.hist[id] || (S.hist[id] = { u: [], r: [] });
const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.updatedAt; return c; };
function pushUndo(prev) { const h = histOf(prev.id); h.u.push(strip(prev)); if (h.u.length > 30) h.u.shift(); h.r = []; Store.meta("hist", S.hist); }

/* ---------- backup ---------- */
function backupData() {
  return { app: "mindbyte-order", version: 10, exportedAt: Date.now(), settings: S.settings, orders: S.orders, customers: S.customers, prices: S.prices, expenses: S.expenses, workers: S.workers, audit: S.audit };
}
async function restoreBackup(d, mode) {
  const m = migrateAll(d);
  if (mode === "replace") for (const c of COLLS) await Store.clear(c);
  await Store.putMany("customers", m.customers);
  await Store.putMany("orders", m.orders);
  if (m.prices.length) await Store.putMany("prices", m.prices.map(p => ({ max: 0, group: "", note: p.scope || "", ...p })));
  await Store.putMany("expenses", m.expenses);
  if (Array.isArray(d.workers)) await Store.putMany("workers", d.workers);
  if (Array.isArray(d.audit) && mode === "replace") { S.audit = d.audit; await Store.meta("audit", S.audit); }
  if (d.settings) { loadSettings({ ...S.settings, ...d.settings }); await Store.meta("settings", S.settings); }
  return m.orders.length;
}

/* first run: load the bundled order history and the price list from the PDF */
async function seedIfEmpty() {
  let seeded = false;
  if (!S.orders.length && !S.customers.length && window.MB_SEED) { await restoreBackup(window.MB_SEED, "merge"); seeded = true; }
  if (!S.prices.length && window.MB_PRICE_SEED) { /* updatedAt 0: on a new device the cloud copy of the price list always wins over this bundled one */
    await Store.putMany("prices", window.MB_PRICE_SEED.map(p => ({ ...p, createdAt: 0, updatedAt: 0 }))); seeded = true; }
  /* price list from the PDF grew (MB_PRICE_SEED_VER): add the services this device does not have yet,
     and move the bundled ones into the new order. Edited prices and own services are left alone. */
  const ver = window.MB_PRICE_SEED_VER || 1;
  if (window.MB_PRICE_SEED && (S.settings.priceSeedVer || 1) < ver) {
    const have = new Map(S.prices.map(p => [p.id, p])), now = Date.now();
    const add = window.MB_PRICE_SEED.filter(p => !have.has(p.id)).map(p => ({ ...p, createdAt: now, updatedAt: now }));
    const moved = window.MB_PRICE_SEED.filter(p => have.has(p.id) && have.get(p.id).sort !== p.sort).map(p => ({ ...have.get(p.id), sort: p.sort, updatedAt: now }));
    await Store.putMany("prices", [...add, ...moved]);
    S.settings.priceSeedVer = ver; await Store.meta("settings", S.settings);
    if (add.length) audit(`Price list updated from the PDF: ${plural(add.length, "service")} added`, "prices");
  }
  return seeded;
}

/* ---------- audit trail: one line per change anywhere in the system ---------- */
async function audit(text, ref) {
  S.audit = [...S.audit, { at: Date.now(), text, ref: ref || "" }].slice(-1500);
  try { await Store.meta("audit", S.audit); } catch (e) { /* the change itself is already saved */ }
}

/* ---------- workers (vendors) and the pay owed to them ----------
   An order carries assign = { workerId, fee, expenseId }. The fee counts as paid only while the
   linked expense exists, so deleting that expense in Expenses makes it payable again. */
const workerById = id => id ? S.workers.find(w => w.id === id) || null : null;
const feePaid = o => !!(o.assign && o.assign.expenseId && S.expenses.some(x => x.id === o.assign.expenseId));
const feeOwed = o => o.assign && o.assign.workerId && o.assign.fee && !feePaid(o) && o.status !== "batal" ? o.assign.fee : 0;
function workerStats(w) {
  const L = S.orders.filter(o => o.assign && o.assign.workerId === w.id);
  return { orders: L, count: L.length, active: L.filter(isActive).length, owed: sum(L, feeOwed), paid: sum(S.expenses.filter(x => x.workerId === w.id), x => x.amount) };
}
async function payWorker(o, date) {
  const w = workerById(o.assign.workerId); const id = uid("x");
  await Store.put("expenses", { id, date: date || todayISO(), cat: S.settings.expCats.find(c => /worker/i.test(c)) || "Worker Pay", amount: o.assign.fee, orderId: o.id, workerId: w.id,
    note: `Pay ${w.name} for order ${qfmt(o.queue)}`, createdAt: Date.now(), updatedAt: Date.now() });
  const n = await saveOrder({ ...o, assign: { ...o.assign, expenseId: id } }, `Worker pay ${rp(o.assign.fee)} paid to ${w.name}`);
  return n;
}
/* receivable age in days, counted from the moment the open invoice was issued */
function owedSince(o) {
  if (o.status === "menunggu_dp") return at(o, "menunggu_dp"); if (o.status === "minta_lunas") return at(o, "minta_lunas");
  const x = extrasOf(o).filter(v => !v.paidAt).sort((a, b) => a.at - b.at)[0]; return x ? x.at : at(o, o.status) || o.createdAt;
}
