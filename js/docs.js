/* MINDBYTE Order System: customer documents (one layout, four documents), WhatsApp messages, PNG/PDF export. */
"use strict";

const IMG = { qris: "aset/qris-nota.png", logo: "aset/ikon-nota.jpg" };
async function loadImages() {
  IMG.qris = (await fileUrl(S.settings.qrisFile)) || "aset/qris-nota.png";
  IMG.logo = (await fileUrl(S.settings.logoFile)) || "aset/ikon-nota.jpg";
  $$(".brand img").forEach(i => i.src = IMG.logo);
}

function notaHtml(o, k) {
  const c = k === "dp" ? askedCalc(o) : calc(o), s = S.settings, dpAt = at(o, "dikerjakan"), paidAt = at(o, "lunas");
  const rows = (o.items || []).map((i, n) => `<tr><td class="m">${n + 1}</td><td>${esc(i.name || "-")}</td><td class="q m">${i.qty}</td><td class="r m">${rp(i.price)}</td><td class="r m">${rp(i.qty * i.price)}</td></tr>`).join("");
  let sm = `<div><span>Subtotal</span><span class="m">${rp(c.sub)}</span></div>`;
  if (o.discount) sm += `<div><span>Discount</span><span class="m">−${rp(o.discount)}</span></div>`;
  sm += `<div class="t"><span>Total</span><span class="m">${rp(c.total)}</span></div>`;
  let status, bottom, plan;
  /* each document has its own job, inside the same frame:
     invoices ask for one payment (amount due now + QRIS), the confirmation records that work has started (schedule, no QRIS),
     the receipt proves everything is paid (payment history, revision terms). */
  const pay = (amt, label) => `<div class="n-pay"><p class="lbl">${label}</p><p class="amt fit">${rp(amt)}</p><p class="how">Scan the QRIS below with any e-wallet or mobile banking app, then send the proof of payment to our admin.</p><img src="${esc(IMG.qris)}" alt="QRIS">${s.bank ? `<p class="bank">${esc(s.bank)}</p>` : ""}</div>`;
  const sign = (when, left, by = "Received by") => `<div class="n-bottom"><div>${left}</div><div class="n-sign"><p class="lbl">${by}</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(when)}</span></div></div>`;
  /* payment plan / history: [what, when, amount, state] with state paid | due | later */
  const P = (title, rows) => `<div class="n-plan"><p class="lbl">${title}</p><table class="n-pt"><tbody>${rows.map(([w, d, amt, st]) => `<tr class="ps-${st}"><td>${w}</td><td>${d}</td><td class="r m">${rp(amt)}</td><td class="r"><span class="n-chip">${{ paid: "Paid", due: "Due now", later: "Later" }[st]}</span></td></tr>`).join("")}</tbody></table></div>`;
  const dpRow = st => [`Down payment (${c.pct}%)`, st === "paid" ? fmtDate(dpAt) : "Before work starts", c.dp, st];
  const work = (left, next) => `<div class="n-bottom"><div><p class="lbl">Work Schedule</p><dl class="n-dl n-dl-l"><dt>Work started</dt><dd>${fmtDate(dpAt)}</dd><dt>Due date</dt><dd>${dueText(o)}</dd></dl><p class="n-next"><b>Next step.</b> ${next}</p>${left}</div><div class="n-sign"><p class="lbl">Confirmed by</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(dpAt)}</span></div></div>`;
  if (k === "dp") {
    sm += `<div class="due open"><span>Amount Due Now</span><span class="m">${rp(c.dp)}</span></div>`;
    status = `<span class="n-status st-open">Awaiting Down Payment</span><p class="n-status-note">Work starts as soon as the down payment is received.</p>`;
    plan = P("Payment Schedule", [dpRow("due"), ["Final payment", "On completion, before delivery", c.rest, "later"]]);
    bottom = pay(c.dp, `Down Payment (${c.pct}%)`);
  } else if (k === "ko" && o.fullPay) {
    sm += `<div class="due"><span>Balance Due</span><span class="m">${rp(0)}</span></div>`;
    status = `<span class="n-status st-run">Confirmed · Paid in Full</span><p class="n-status-note">Confirmed. The work is in progress.</p>`;
    plan = P("Payments", [["Full payment", fmtDate(dpAt), c.total, "paid"]]);
    bottom = work("", `The files will be delivered upon completion, no later than the due date.`);
  } else if (k === "ko" && !c.dp) {
    sm += `<div class="due"><span>Balance Due</span><span class="m">${rp(c.total)}</span></div>`;
    status = `<span class="n-status st-run">Confirmed</span><p class="n-status-note">No down payment is required.</p>`;
    plan = P("Payment Schedule", [["Full payment", "On completion, before delivery", c.total, "later"]]);
    bottom = work("", `When the work is complete you will receive the Final Payment Invoice for ${rp(c.total)}.`);
  } else if (k === "ko") {
    sm += `<div class="due"><span>Balance Due</span><span class="m">${rp(c.rest)}</span></div>`;
    status = `<span class="n-status st-run">Confirmed · In Progress</span><p class="n-status-note">Your down payment has been received and the work has started.</p>`;
    plan = P("Payments", [dpRow("paid"), ["Final payment", "On completion, before delivery", c.rest, "later"]]);
    bottom = work("", `When the work is complete you will receive the Final Payment Invoice for the balance of ${rp(c.rest)}.`);
  } else if (k === "pl") {
    sm += `<div class="due open"><span>Amount Due Now</span><span class="m">${rp(c.rest)}</span></div>`;
    status = `<span class="n-status st-open">Awaiting Final Payment</span><p class="n-status-note">The work has been completed. Files will be delivered once the final payment is received.</p>`;
    plan = P("Payment History", [...(c.dp ? [dpRow("paid")] : []), [c.dp ? "Final payment" : "Full payment", "Now", c.rest, "due"]]);
    bottom = pay(c.rest, "Final Payment");
  } else {
    sm += `<div class="due"><span>Total Paid</span><span class="m">${rp(c.total)}</span></div>`;
    status = `<span class="n-status st-paid">Paid in Full</span><p class="n-status-note">This receipt is proof of payment in full.</p>`;
    plan = P("Payment History", o.fullPay ? [["Full payment", fmtDate(dpAt), c.total, "paid"]]
      : [...(c.dp ? [dpRow("paid")] : []), [c.dp ? "Final payment" : "Full payment", fmtDate(paidAt), c.rest, "paid"]]);
    bottom = sign(paidAt, `<p class="lbl">Revision Terms</p><ul class="terms">${terms().map(t => `<li>${esc(t)}</li>`).join("")}</ul>`);
  }
  return `<div id="nota" class="nk-${k}" lang="en">
  <div class="n-rule"></div>
  <div class="n-pad">
    <div class="n-head">
      <div class="n-brand"><img src="${esc(IMG.logo)}" alt=""><div><div class="n-word">${esc(s.business)}</div>${s.est ? `<div class="n-est">${esc(s.est)}</div>` : ""}</div></div>
      <div class="n-doc"><h1>${DOC[k].title}</h1><div><span>No. ${esc(docNo(o, k))}</span><span>Date ${fmtDate(docAt(o, k) || Date.now())}</span></div></div>
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
/* invoice or receipt for one extra charge (major revision / additional work) on an existing order */
function notaExtraHtml(o, x) {
  const s = S.settings, paid = !!x.paidAt, t = REV_TYPE[x.type];
  const head = notaHtml(o, "dp").split('<div class="n-doc">')[0].replace("nk-dp", paid ? "nk-kw" : "nk-dp");
  const sm = `<div class="t"><span>Total</span><span class="m">${rp(x.fee)}</span></div>` + (paid ? `<div><span>Paid · ${fmtNum(x.paidAt)}</span><span class="m">${rp(x.fee)}</span></div><div class="due"><span>Balance Due</span><span class="m">${rp(0)}</span></div>` : `<div class="due open"><span>Amount Due</span><span class="m">${rp(x.fee)}</span></div>`);
  const bottom = paid
    ? `<div class="n-bottom"><div><p class="lbl">Remarks</p><p>Payment of ${rp(x.fee)} for the ${t.label.toLowerCase()} has been received.</p></div><div class="n-sign"><p class="lbl">Received by</p><div class="sig">${esc(s.business)}</div><span>${fmtDate(x.paidAt)}</span></div></div>`
    : `<div class="n-pay"><p class="lbl">${t.label}</p><p class="amt fit">${rp(x.fee)}</p><p class="how">Scan the QRIS below with any e-wallet or mobile banking app, then send the proof of payment to our admin.</p><img src="${esc(IMG.qris)}" alt="QRIS">${s.bank ? `<p class="bank">${esc(s.bank)}</p>` : ""}</div>`;
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
function mountNota(box, o, k) { const x = String(k).startsWith("x:") ? (o.revs || []).find(r => r.id === k.slice(2)) : null; box.innerHTML = `<div class="notaFit">${x ? notaExtraHtml(o, x) : notaHtml(o, k)}</div>`; fitNota(); }
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
  return { greeting: name ? `Halo ${name},` : "Halo,", name, business: S.settings.business, document_title: k && DOC[k] ? DOC[k].title.toUpperCase() : "", document_no: k && DOC[k] ? docNo(o, k) : "",
    order_no: qfmt(o.queue), job: o.project || "", due_date: dueText(o), details, total: rp(c.total), dp_percent: c.pct, down_payment: rp(c.dp), balance: rp(c.rest), amount_due: rp(billedNow(o) || owedOf(o)),
    revision_terms: terms().join("\n") };
}
const tplOf = k => { const t = S.settings.tpl && S.settings.tpl[k]; return t && !OLD_TPL.some(d => d[k] === t) ? t : DEF_TPL[k]; };
function fillTpl(t, v) { return t.replace(/\{([a-z_]+)\}/g, (m, key) => { key = TPL_ALIAS[key] || key; return key in v ? String(v[key]) : m; }); }
const extraOfKind = (o, k) => String(k).startsWith("x:") ? (o.revs || []).find(r => r.id === k.slice(2)) : null;
function waText(o, k, tpl) {
  const x = extraOfKind(o, k);
  if (x) return fillTpl(tpl ?? tplOf(x.paidAt ? "extrapaid" : "extra"), { ...tplVars(o), document_title: (x.paidAt ? "Receipt" : "Invoice").toUpperCase(), document_no: extraNo(o, x, !!x.paidAt), extra_item: `${REV_TYPE[x.type].label}: ${x.note || ""}`, extra_amount: rp(x.fee) });
  return fillTpl(tpl ?? tplOf(k === "ko" && o.fullPay ? "kof" : k), tplVars(o, k));
}
const waLink = (phone, text) => `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/* ---------- export ---------- */
const safeName = s => s.trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ");
const docFileName = (o, k, ext) => { const x = extraOfKind(o, k); return safeName(x ? `${extraNo(o, x, !!x.paidAt)} ${REV_TYPE[x.type].label} ${clientName(o)}` : `${docNo(o, k)} ${DOC[k].title} ${clientName(o)}`) + "." + ext; };
async function snapNota() {
  if (!window.html2canvas) throw new Error("The image module has not loaded (needs internet)");
  const n = $("#nota"); await document.fonts?.ready; fitFigures(n);
  await Promise.all($$("img", n).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const fit = n.parentElement, t = fit.style.transform; fit.style.transform = "none";
  try { return await html2canvas(n, { scale: 2.5, backgroundColor: "#FFFFFF", useCORS: true, logging: false }); } finally { fit.style.transform = t; }
}
async function notaPng(o, k) { const cv = await snapNota(); const blob = await new Promise(r => cv.toBlob(r, "image/png")); download(docFileName(o, k, "png"), blob, "Document downloaded"); }
async function notaPdf(o, k) {
  const cv = await snapNota(); if (!window.jspdf) throw new Error("The PDF module has not loaded (needs internet)");
  const { jsPDF } = window.jspdf, w = 148, h = cv.height * w / cv.width;
  const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: h > w ? "p" : "l" }); pdf.addImage(cv.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
  download(docFileName(o, k, "pdf"), pdf.output("blob"), "Document downloaded");
}
/* share the PNG straight to WhatsApp on phones that support the share sheet */
async function notaShare(o, k) {
  const cv = await snapNota(); const blob = await new Promise(r => cv.toBlob(r, "image/png"));
  const file = new File([blob], docFileName(o, k, "png"), { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: waText(o, k) }); return true; } catch (e) { if (e.name === "AbortError") return true; } }
  return false;
}
