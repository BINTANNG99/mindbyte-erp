/* MINDBYTE Order System: customer documents (one layout, four documents), WhatsApp messages, PNG/PDF export. */
"use strict";

const IMG = { qris: "aset/qris-nota.png", logo: "aset/ikon-nota.jpg" };
async function loadImages() {
  IMG.qris = (await fileUrl(S.settings.qrisFile)) || "aset/qris-nota.png";
  IMG.logo = (await fileUrl(S.settings.logoFile)) || "aset/ikon-nota.jpg";
  $$(".brand img").forEach(i => i.src = IMG.logo);
  prepQris();
}

/* ---------- dynamic QRIS: the merchant's static QRIS with the amount written in ----------
   The static code is read once from the QRIS image (jsQR, cached per image in this browser). For each bill the payload gets
   tag 01 = 12 (dynamic), tag 54 = the amount and a new CRC (tag 63), and is drawn as a new QR code.
   If the image cannot be read, the QRIS page falls back to the static image and the customer types the amount. */
const QRIS = { src: null, payload: null, merchant: "", state: "idle" };
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
/* CRC16-CCITT (poly 0x1021, start 0xFFFF), as QRIS / EMVCo requires, over everything up to and including "6304" */
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, "0"); }
/* top-level tag-length-value fields of a QRIS payload, or null when it is not well formed */
function tlv(s) { const out = []; let i = 0; while (i < s.length) { const t = s.substr(i, 2), l = s.substr(i + 2, 2), n = Number(l); if (!/^\d{2}$/.test(t) || !/^\d{2}$/.test(l) || i + 4 + n > s.length) return null; out.push([t, s.substr(i + 4, n)]); i += 4 + n; } return out; }
const qrisValid = p => /^000201/.test(p) && p.slice(-8, -4) === "6304" && crc16(p.slice(0, -4)) === p.slice(-4).toUpperCase() && !!tlv(p);
function qrisWithAmount(p, amt) {
  const a = String(Math.round(amt)); if (!(amt > 0) || a.length > 13) return null;
  const m = new Map(tlv(p).filter(([t]) => t !== "63")); m.set("01", "12"); m.set("54", a);
  const body = [...m].sort((x, y) => Number(x[0]) - Number(y[0])).map(([t, v]) => t + String(v.length).padStart(2, "0") + v).join("") + "6304";
  return body + crc16(body);
}
const loadScript = u => new Promise((res, rej) => { const s = document.createElement("script"); s.src = u; s.onload = res; s.onerror = () => rej(new Error("Could not load " + u)); document.head.append(s); });
async function readQris(src) {
  const key = "mb_qris_payload:" + (S.settings.qrisFile || src);
  try { const c = localStorage.getItem(key); if (c && qrisValid(c)) return c; } catch (e) { /* storage blocked: read the image again */ }
  if (!window.jsQR) await loadScript(JSQR_URL);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("QRIS image did not load")); i.src = src; });
  const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext("2d", { willReadFrequently: true }); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0);
  const r = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height), p = r && String(r.data || "").trim();
  if (!p || !qrisValid(p)) throw new Error("the image is not a valid QRIS code");
  try { localStorage.setItem(key, p); } catch (e) { /* not cached, read again next time */ }
  return p;
}
async function prepQris() {
  const src = IMG.qris; if (QRIS.src === src && QRIS.state !== "fail") return;
  Object.assign(QRIS, { src, state: "loading", payload: null, merchant: "" }); QR_IMG.clear();
  try {
    const p = await readQris(src); if (QRIS.src !== src) return;
    Object.assign(QRIS, { payload: p, merchant: new Map(tlv(p)).get("59") || "", state: "ok" });
    if (!window.qrcode && document.readyState !== "complete") await new Promise(r => window.addEventListener("load", r, { once: true }));
    if ($("#nota.nk-qr") || $(".seg [data-k^='q:']")) refresh();
  } catch (e) { if (QRIS.src === src) { QRIS.state = "fail"; console.warn("QRIS: the static image is used,", e.message || e); } }
}
/* the QR image for one amount (data URL), or null when only the static image can be used */
const QR_IMG = new Map();
function qrisDynSrc(amt) {
  if (QRIS.state !== "ok" || !window.qrcode) return null;
  const k = Math.round(amt); if (QR_IMG.has(k)) return QR_IMG.get(k);
  const p = qrisWithAmount(QRIS.payload, k); if (!p) return null;
  try { const q = window.qrcode(0, "M"); q.addData(p); q.make(); const cell = Math.max(4, Math.floor(400 / (q.getModuleCount() + 8))); const u = q.createDataURL(cell, cell * 4); QR_IMG.set(k, u); return u; }
  catch (e) { return null; }
}

/* the "how to pay" block of an invoice, for the method the admin picked on the order.
   Bank transfer: the account is printed here. QRIS: only a pointer, the code itself is its own page (notaQrisHtml). */
function payBlock(o, amt, label) {
  const s = S.settings;
  if (payViaOf(o) === "bank") return `<div class="n-pay"><p class="lbl">${label}</p><p class="amt fit">${rp(amt)}</p><p class="how">Transfer to the bank account below, then send the proof of payment to our admin.</p>
    <div class="n-bank"><p class="lbl">Bank Transfer</p><div class="bk-name">${esc(s.bankName)}</div><div class="bk-no m">${esc(s.bankAcct)}</div>${s.bankHolder ? `<div class="bk-holder">a.n. ${esc(maskName(s.bankHolder))}</div>` : ""}</div></div>`;
  return `<div class="n-pay"><p class="lbl">${label}</p><p class="amt fit">${rp(amt)}</p><p class="how">Payment method: <b>QRIS</b>. Scan the QRIS page sent with this invoice using any e-wallet or mobile banking app, then send the proof of payment to our admin.</p>${s.bank && !bankOn() ? `<p class="bank">${esc(s.bank)}</p>` : ""}</div>`;
}
/* ---------- QRIS page: a document of its own, sent next to an open invoice when the order is paid by QRIS ----------
   kind "q:<invoice kind>": q:dp, q:pl, q:x:<extra id> */
const isQrisKind = k => String(k || "").startsWith("q:");
const qrisInner = k => isQrisKind(k) ? k.slice(2) : k;
/* the QRIS pages an order needs right now: one per unpaid invoice */
function qrisKinds(o) {
  if (payViaOf(o) !== "qris" || o.status === "batal") return [];
  const L = [];
  if (o.status === "menunggu_dp" && askedCalc(o).dp > 0) L.push("q:dp");
  if (o.status === "minta_lunas" && calc(o).rest > 0) L.push("q:pl");
  extrasOf(o).filter(x => !x.paidAt).forEach(x => L.push("q:x:" + x.id));
  return L;
}
/* a list of document kinds with each QRIS page right after its invoice */
const withQris = (o, ks) => { const q = qrisKinds(o), out = []; ks.forEach(k => { out.push(k); if (q.includes("q:" + k)) out.push("q:" + k); }); return out; };
/* what a QRIS page asks for: amount, label and the invoice it belongs to */
function qrisBill(o, k) {
  const i = qrisInner(k), x = extraOfKind(o, i);
  if (x) return { amt: x.fee, label: REV_TYPE[x.type].label, no: extraNo(o, x, false) };
  if (i === "pl") return { amt: calc(o).rest, label: calc(o).dp ? "Final Payment" : "Full Payment", no: docNo(o, "pl") };
  const c = askedCalc(o); return { amt: c.dp, label: isFullInvoice(o) ? "Full Payment" : `Down Payment (${c.pct}%)`, no: docNo(o, "dp") };
}
function notaQrisHtml(o, k) {
  const s = S.settings, b = qrisBill(o, k), dyn = qrisDynSrc(b.amt);
  return `<div id="nota" class="nk-qr" lang="en">
  <div class="n-rule"></div>
  <div class="n-pad">
    <div class="n-head">
      <div class="n-brand"><img src="${esc(IMG.logo)}" alt=""><div><div class="n-word">${esc(s.business)}</div>${s.est ? `<div class="n-est">${esc(s.est)}</div>` : ""}${brandTag(o)}</div></div>
      <div class="n-doc"><h1>QRIS Payment</h1><div><span>For ${esc(b.no)}</span><span>Order No. ${qfmt(o.queue)}</span></div></div>
    </div>
    <div class="n-pay"><p class="lbl">${esc(b.label)}</p><p class="amt fit">${rp(b.amt)}</p>${dyn ? `<p class="how">Scan this QRIS with any e-wallet or mobile banking app. The amount is already filled in; check that it reads ${rp(b.amt)}, pay, then send the proof of payment to our admin.</p><img class="qr-dyn" src="${dyn}" alt="QRIS ${rp(b.amt)}"><p class="qr-cap">QRIS · ${esc(QRIS.merchant || s.business)}${s.nmid ? ` · NMID ${esc(s.nmid)}` : ""}</p>`
      : `<p class="how">Scan this QRIS with any e-wallet or mobile banking app, pay exactly the amount above, then send the proof of payment to our admin.</p><img src="${esc(IMG.qris)}" alt="QRIS">`}</div>
  </div>
  <div class="n-foot"><span>${esc(clientName(o) || "")}</span><span>${s.wa ? `Admin WhatsApp <span class="m">${esc(s.wa)}</span>` : ""}</span></div></div>`;
}
/* the name of a document on buttons and in lists */
function docLabel(o, k) {
  if (isQrisKind(k)) { const i = qrisInner(k), x = extraOfKind(o, i); return `QRIS · ${x ? `${REV_TYPE[x.type].short} ${extrasOf(o).indexOf(x) + 1}` : docTitle(o, i)}`; }
  const x = extraOfKind(o, k); return x ? `${REV_TYPE[x.type].short} ${extrasOf(o).indexOf(x) + 1} ${x.paidAt ? "Receipt" : "Invoice"}` : docTitle(o, k);
}
function notaHtml(o, k) {
  const c = k === "dp" ? askedCalc(o) : calc(o), s = S.settings, dpAt = at(o, "dikerjakan"), paidAt = at(o, "lunas");
  const rows = (o.items || []).map((i, n) => `<tr><td class="m">${n + 1}</td><td>${esc(i.name || "-")}</td><td class="q m">${i.qty}</td><td class="r m">${rp(i.price)}</td><td class="r m">${rp(i.qty * i.price)}</td></tr>`).join("");
  let sm = `<div><span>Subtotal</span><span class="m">${rp(c.sub)}</span></div>`;
  if (o.discount) sm += `<div><span>Discount</span><span class="m">−${rp(o.discount)}</span></div>`;
  sm += `<div class="t"><span>Total</span><span class="m">${rp(c.total)}</span></div>`;
  let status, bottom, plan;
  /* each document has its own job, inside the same frame:
     invoices ask for one payment (amount due now + QRIS / bank transfer), the down payment receipt proves the DP came in
     and the work has started (schedule), the final receipt proves everything is paid (payment history, revision terms). */
  const pay = (amt, label) => payBlock(o, amt, label);
  const sign = (when, left, by = "Received by") => `<div class="n-bottom"><div>${left}</div><div class="n-sign"><p class="lbl">${by}</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(when)}</span></div></div>`;
  /* payment plan / history: [what, when, amount, state] with state paid | due | later */
  const P = (title, rows) => `<div class="n-plan"><p class="lbl">${title}</p><table class="n-pt"><tbody>${rows.map(([w, d, amt, st]) => `<tr class="ps-${st}"><td>${w}</td><td>${d}</td><td class="r m">${rp(amt)}</td><td class="r"><span class="n-chip">${{ paid: "Paid", due: "Due now", later: "Later" }[st]}</span></td></tr>`).join("")}</tbody></table></div>`;
  const dpRow = st => [`Down payment (${c.pct}%)`, st === "paid" ? fmtDate(dpAt) : "Before work starts", c.dp, st];
  const work = (left, next) => `<div class="n-bottom"><div><p class="lbl">Work Schedule</p><dl class="n-dl n-dl-l"><dt>Work started</dt><dd>${fmtDate(dpAt)}</dd><dt>Due date</dt><dd>${dueText(o)}</dd></dl><p class="n-next"><b>Next step.</b> ${next}</p>${left}</div><div class="n-sign"><p class="lbl">Received by</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(dpAt)}</span></div></div>`;
  if (k === "dp" && isFullInvoice(o)) {
    sm += `<div class="due open"><span>Amount Due Now</span><span class="m">${rp(c.total)}</span></div>`;
    status = `<span class="n-status st-open">Awaiting Payment</span><p class="n-status-note">Full payment upfront. Work starts as soon as the payment is received.</p>`;
    plan = P("Payment Schedule", [["Full payment", "Before work starts", c.total, "due"]]);
    bottom = pay(c.total, "Full Payment");
  } else if (k === "dp" && isPayLater(o)) {
    /* DP 0%: nothing to pay now; the whole amount is billed by the Final Payment Invoice on completion */
    sm += `<div class="due"><span>Due on Completion</span><span class="m">${rp(c.total)}</span></div>`;
    status = `<span class="n-status st-open">Payment on Completion</span><p class="n-status-note">No down payment. ${effIdx(o) >= idx("dikerjakan") ? "The work is in progress." : "The work starts as agreed."} The full amount is paid once the work is complete, before the files are delivered.</p>`;
    plan = P("Payment Schedule", [["Full payment", "On completion, before delivery", c.total, "later"]]);
    bottom = `<div class="n-bottom"><div><p class="lbl">Work Schedule</p><dl class="n-dl n-dl-l"><dt>Order date</dt><dd>${fmtDate(o.date)}</dd><dt>Due date</dt><dd>${dueText(o)}</dd></dl><p class="n-next"><b>Next step.</b> When the work is complete you will receive the Final Payment Invoice for ${rp(c.total)}, with the payment details.</p></div><div class="n-sign"><p class="lbl">Issued by</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(docAt(o, "dp") || o.date)}</span></div></div>`;
  } else if (k === "dp") {
    sm += `<div class="due open"><span>Amount Due Now</span><span class="m">${rp(c.dp)}</span></div>`;
    status = `<span class="n-status st-open">Awaiting Down Payment</span><p class="n-status-note">Work starts as soon as the down payment is received.</p>`;
    plan = P("Payment Schedule", [dpRow("due"), ["Final payment", "On completion, before delivery", c.rest, "later"]]);
    bottom = pay(c.dp, `Down Payment (${c.pct}%)`);
  } else if (k === "ko") {
    sm += `<div><span>Down Payment Received</span><span class="m">${rp(c.dp)}</span></div><div class="due"><span>Balance Due</span><span class="m">${rp(c.rest)}</span></div>`;
    status = `<span class="n-status st-paid">Down Payment Received</span><p class="n-status-note">This receipt is proof of your down payment. The work has started.</p>`;
    plan = P("Payment History", [dpRow("paid"), ["Final payment", "On completion, before delivery", c.rest, "later"]]);
    bottom = work("", `When the work is complete you will receive the Final Payment Invoice for the balance of ${rp(c.rest)}.`);
  } else if (k === "pl") {
    if (c.dp) sm += `<div><span>Down Payment Received</span><span class="m">−${rp(c.dp)}</span></div>`;
    sm += `<div class="due open"><span>Amount Due Now</span><span class="m">${rp(c.rest)}</span></div>`;
    status = `<span class="n-status st-open">Awaiting Final Payment</span><p class="n-status-note">The work has been completed. Files will be delivered once the final payment is received.</p>`;
    plan = P("Payment History", [...(c.dp ? [dpRow("paid")] : []), [c.dp ? "Final payment" : "Full payment", "Now", c.rest, "due"]]);
    bottom = pay(c.rest, "Final Payment");
  } else {
    sm += `<div class="due"><span>Total Paid</span><span class="m">${rp(c.total)}</span></div>`;
    status = `<span class="n-status st-paid">Paid in Full</span><p class="n-status-note">${((o.fullPay && effIdx(o) < idx("lunas")) || o.work === "progress") ? "This receipt is proof of payment in full. The work is in progress; the files will be delivered no later than the due date." : "This receipt is proof of payment in full."}</p>`;
    plan = P("Payment History", o.fullPay ? [["Full payment", fmtDate(dpAt), c.total, "paid"]]
      : [...(c.dp ? [dpRow("paid")] : []), [c.dp ? "Final payment" : "Full payment", fmtDate(paidAt), c.rest, "paid"]]);
    bottom = ((o.fullPay && effIdx(o) < idx("lunas")) || o.work === "progress") ? work("", `The work is in progress. The files will be delivered by the due date (${dueText(o)}), together with the revision terms.`)
      : sign(o.fullPay ? dpAt : paidAt, `<p class="lbl">Revision Terms</p><ul class="terms">${terms().map(t => `<li>${esc(t)}</li>`).join("")}</ul>`);
  }
  return `<div id="nota" class="nk-${k}" lang="en">
  <div class="n-rule"></div>
  <div class="n-pad">
    <div class="n-head">
      <div class="n-brand"><img src="${esc(IMG.logo)}" alt=""><div><div class="n-word">${esc(s.business)}</div>${s.est ? `<div class="n-est">${esc(s.est)}</div>` : ""}${brandTag(o)}</div></div>
      <div class="n-doc"><h1>${docTitle(o, k)}</h1><div><span>No. ${esc(docNo(o, k))}</span><span>Date ${fmtDate(docAt(o, k) || Date.now())}</span></div></div>
    </div>
    <div class="n-info">
      <div class="n-to"><p class="lbl">Bill To</p><b>${esc(clientName(o) || "-")}</b>${clientPhone(o) ? `<span class="m">${esc(clientPhone(o))}</span>` : ""}</div>
      <div><p class="lbl">Order</p><dl class="n-dl"><dt>No.</dt><dd class="m">${qfmt(o.queue)}</dd><dt>Date</dt><dd>${fmtDate(o.date)}</dd><dt>Due Date</dt><dd>${dueText(o)}</dd></dl></div>
    </div>
    <div class="n-job"><p class="lbl">Job Description</p><p class="jt">${esc(o.project || "-")}</p></div>
    <table><colgroup><col class="c-no"><col><col class="c-qty"><col class="c-prc"><col class="c-amt"></colgroup>
      <thead><tr><th>No.</th><th>Description</th><th class="q">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="n-mid"><div><p class="lbl">Payment Status</p>${status}</div><div class="n-sum">${sm}</div></div>
    ${plan}
    ${o.notes ? `<div class="n-note" lang="id"><p class="lbl">Notes</p><p>${esc(o.notes)}</p></div>` : ""}
    ${bottom}
  </div>
  <div class="n-foot"><span>${esc(s.foot || "")}</span><span>${s.wa ? `Admin WhatsApp <span class="m">${esc(s.wa)}</span>` : ""}</span></div></div>`;
}
/* the brand line under the business name, for orders of a sub-brand (mindbyte_praxis, mindbytehq, mindbyte_techno) */
const brandTag = o => { const h = BRANDS[brandOf(o)]?.handle; return h ? `<div class="n-brandtag">${esc(h)}</div>` : ""; };
/* invoice or receipt for one extra charge (major revision / additional work) on an existing order */
function notaExtraHtml(o, x) {
  const s = S.settings, paid = !!x.paidAt, t = REV_TYPE[x.type];
  const head = notaHtml(o, "dp").split('<div class="n-doc">')[0].replace("nk-dp", paid ? "nk-kw" : "nk-dp");
  const sm = `<div class="t"><span>Total</span><span class="m">${rp(x.fee)}</span></div>` + (paid ? `<div><span>Paid · ${fmtNum(x.paidAt)}</span><span class="m">${rp(x.fee)}</span></div><div class="due"><span>Balance Due</span><span class="m">${rp(0)}</span></div>` : `<div class="due open"><span>Amount Due</span><span class="m">${rp(x.fee)}</span></div>`);
  const bottom = paid
    ? `<div class="n-bottom"><div><p class="lbl">Remarks</p><p>Payment of ${rp(x.fee)} for the ${t.label.toLowerCase()} has been received.</p></div><div class="n-sign"><p class="lbl">Received by</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(x.paidAt)}</span></div></div>`
    : payBlock(o, x.fee, t.label);
  return `${head}<div class="n-doc"><h1>${paid ? "Receipt" : "Invoice"}</h1><div><span>No. ${esc(extraNo(o, x, paid))}</span><span>Date ${fmtDate(paid ? x.paidAt : x.at)}</span></div></div>
    </div>
    <div class="n-info">
      <div class="n-to"><p class="lbl">Bill To</p><b>${esc(clientName(o) || "-")}</b>${clientPhone(o) ? `<span class="m">${esc(clientPhone(o))}</span>` : ""}</div>
      <div><p class="lbl">Order</p><dl class="n-dl"><dt>No.</dt><dd class="m">${qfmt(o.queue)}</dd><dt>Date</dt><dd>${fmtDate(o.date)}</dd><dt>Charge Type</dt><dd>${t.label}</dd></dl></div>
    </div>
    <div class="n-job"><p class="lbl">Job Description</p><p class="jt">${esc(o.project || "-")}</p></div>
    <table><colgroup><col class="c-no"><col><col class="c-qty"><col class="c-prc"><col class="c-amt"></colgroup>
      <thead><tr><th>No.</th><th>Description</th><th class="q">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead>
      <tbody><tr><td class="m">1</td><td>${esc(t.label)}: ${esc(x.note || "-")}</td><td class="q m">1</td><td class="r m">${rp(x.fee)}</td><td class="r m">${rp(x.fee)}</td></tr></tbody></table>
    <div class="n-mid"><div><p class="lbl">Payment Status</p>${paid ? `<span class="n-status st-paid">Paid</span><p class="n-status-note">Payment has been received in full.</p>` : `<span class="n-status st-open">Awaiting Payment</span><p class="n-status-note">This charge comes on top of the original total. The additional work starts once it is paid.</p>`}</div><div class="n-sum">${sm}</div></div>
    ${bottom}
  </div>
  <div class="n-foot"><span>${esc(s.foot || "")}</span><span>${s.wa ? `Admin WhatsApp <span class="m">${esc(s.wa)}</span>` : ""}</span></div></div>`;
}
/* the document is laid out at 600px and scaled to fit its frame; kind "x:<id>" is an extra charge */
function mountNota(box, o, k) { box.innerHTML = `<div class="notaFit">${notaPageHtml(o, k)}</div>`; fitNota(); }
function fitText(el, bx) { el.style.fontSize = ""; let fs = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > bx.clientWidth + 0.5 && fs > 6.5) { fs -= 0.5; el.style.fontSize = fs + "px"; } }
function fitFigures(n) { n.querySelectorAll("td.m").forEach(td => fitText(td, td)); n.querySelectorAll(".n-sum div>span.m").forEach(sp => fitText(sp, sp.parentElement)); n.querySelectorAll(".fit").forEach(el => fitText(el, el.parentElement)); }
window.fitNota = function () {
  $$(".nota-frame").forEach(box => { const fit = box.querySelector(".notaFit"), n = box.querySelector("#nota"); if (!fit || !n || box.offsetParent === null) return;
    fitFigures(n); const sc = Math.min(1, box.clientWidth / 600); fit.style.transform = `scale(${sc})`; fit.style.marginLeft = sc === 1 ? (box.clientWidth - 600) / 2 + "px" : "0"; box.style.height = Math.ceil(n.offsetHeight * sc) + "px"; });
};
document.addEventListener("load", e => { if (e.target.closest && e.target.closest("#nota")) fitNota(); }, true);
document.fonts?.ready.then(() => fitNota());

/* ---------- WhatsApp ---------- */
function tplVars(o, k) {
  const c = k === "dp" ? askedCalc(o) : calc(o), name = clientName(o);
  const details = [`*Rincian*`, `Pekerjaan: ${o.project}`, ...(o.deadline ? [`Tenggat: ${dueText(o)}`] : []), ...(o.items || []).map(i => `${i.name}${i.qty > 1 ? ` (${i.qty}×)` : ""}: ${rp(i.qty * i.price)}`), ...(o.discount ? [`Diskon: -${rp(o.discount)}`] : []), `Total: ${rp(c.total)}`].join("\n");
  return { greeting: name ? `Halo ${name},` : "Halo,", name, business: S.settings.business, document_title: k && DOC[k] ? docTitle(o, k).toUpperCase() : "", document_no: k && DOC[k] ? docNo(o, k) : "", payment_method: payMethodText(o),
    order_no: qfmt(o.queue), job: o.project || "", due_date: dueText(o), details, total: rp(c.total), dp_percent: c.pct, down_payment: rp(c.dp), balance: rp(c.rest), amount_due: rp(billedNow(o) || owedOf(o)),
    revision_terms: terms().join("\n") };
}
const tplOf = k => { const t = S.settings.tpl && S.settings.tpl[k]; return t && !OLD_TPL.some(d => d[k] === t) ? t : DEF_TPL[k]; };
function fillTpl(t, v) { return t.replace(/\{([a-z_]+)\}/g, (m, key) => { key = TPL_ALIAS[key] || key; return key in v ? String(v[key]) : m; }); }
const extraOfKind = (o, k) => String(k).startsWith("x:") ? (o.revs || []).find(r => r.id === k.slice(2)) : null;
function waText(o, k, tpl) {
  k = qrisInner(k); /* a QRIS page goes out with the message of its invoice */
  const x = extraOfKind(o, k);
  if (x) return fillTpl(tpl ?? tplOf(x.paidAt ? "extrapaid" : "extra"), { ...tplVars(o), document_title: (x.paidAt ? "Receipt" : "Invoice").toUpperCase(), document_no: extraNo(o, x, !!x.paidAt), extra_item: `${REV_TYPE[x.type].label}: ${x.note || ""}`, extra_amount: rp(x.fee) });
  return fillTpl(tpl ?? tplOf(waKey(o, k)), tplVars(o, k));
}
const waLink = (phone, text) => `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/* ---------- export ---------- */
const safeName = s => s.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ");
const docFileName = (o, k, ext) => { if (isQrisKind(k)) return safeName(`${qrisBill(o, k).no} QRIS ${clientName(o)}`) + "." + ext; const x = extraOfKind(o, k); return safeName(x ? `${extraNo(o, x, !!x.paidAt)} ${REV_TYPE[x.type].label} ${clientName(o)}` : `${docNo(o, k)} ${docTitle(o, k)} ${clientName(o)}`) + "." + ext; };
/* the HTML of any document kind: stage documents, extra charges ("x:<id>") and QRIS pages ("q:<kind>") */
function notaPageHtml(o, k) { if (isQrisKind(k)) return notaQrisHtml(o, k); const x = extraOfKind(o, k); return x ? notaExtraHtml(o, x) : notaHtml(o, k); }
/* what one download contains: an open invoice paid by QRIS always goes out together with its QRIS page */
function exportPages(o, k) { const inv = qrisInner(k), q = "q:" + inv; return qrisKinds(o).includes(q) ? [inv, q] : [k]; }
/* each page is drawn off screen at its full 600px width, so the export never depends on what is shown in the frame */
async function snapPage(o, k) {
  if (!window.html2canvas) throw new Error("The image module has not loaded (needs internet)");
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;pointer-events:none";
  host.innerHTML = notaPageHtml(o, k); document.body.append(host);
  try {
    const n = host.firstElementChild; await document.fonts?.ready; fitFigures(n);
    await Promise.all($$("img", n).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    return await html2canvas(n, { scale: 2.5, backgroundColor: "#FFFFFF", useCORS: true, logging: false });
  } finally { host.remove(); }
}
const canvasPng = cv => new Promise(r => cv.toBlob(r, "image/png"));
/* PNG: one image per page, all downloaded at once */
async function notaPng(o, k) {
  const ks = exportPages(o, k);
  for (const [i, p] of ks.entries()) {
    download(docFileName(o, p, "png"), await canvasPng(await snapPage(o, p)), ks.length > 1 ? `${ks.length} images downloaded (invoice + QRIS)` : "Document downloaded");
    if (i < ks.length - 1) await new Promise(r => setTimeout(r, 400));
  }
}
/* PDF: one file, one page per document */
async function notaPdf(o, k) {
  if (!window.jspdf) throw new Error("The PDF module has not loaded (needs internet)");
  const ks = exportPages(o, k), { jsPDF } = window.jspdf, w = 148; let pdf = null;
  for (const p of ks) {
    const cv = await snapPage(o, p), h = cv.height * w / cv.width, or = h > w ? "p" : "l";
    if (!pdf) pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: or }); else pdf.addPage([w, h], or);
    pdf.addImage(cv.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
  }
  download(docFileName(o, ks[0], "pdf"), pdf.output("blob"), ks.length > 1 ? "PDF downloaded (invoice + QRIS, 2 pages)" : "Document downloaded");
}
/* share the PNGs straight to WhatsApp on phones that support the share sheet */
async function notaShare(o, k) {
  const files = [];
  for (const p of exportPages(o, k)) files.push(new File([await canvasPng(await snapPage(o, p))], docFileName(o, p, "png"), { type: "image/png" }));
  if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, text: waText(o, k) }); return true; } catch (e) { if (e.name === "AbortError") return true; } }
  return false;
}
