/* MINDBYTE Order System: the WhatsApp message panel.
   Shows a message the way WhatsApp will (bold, italic, line breaks), and lets the template behind it be edited in place
   with a live preview. Saving writes the template to Settings, so every order uses the new wording.
   Used on the order page (the order's own messages) and in Settings (every template, shown with a sample order). */
"use strict";

const WA_CODES = { greeting: "Greeting", name: "Customer name", business: "Business name", document_title: "Document title", document_no: "Document no.", order_no: "Number", job: "Job", due_date: "Due date",
  details: "Details block", total: "Total", dp_percent: "DP %", down_payment: "Down payment", balance: "Balance", amount_due: "Amount due", extra_item: "Extra work", extra_amount: "Extra amount", revision_terms: "Revision terms" };
/* WhatsApp markup → HTML: *bold*, _italic_, ~strike~, ```mono``` */
function waFormat(t) {
  const w = (ch, tag) => new RegExp(`(^|[\\s(])\\${ch}(\\S(?:[^${ch}\\n]*\\S)?)\\${ch}(?=[\\s).,:;!?]|$)`, "gm");
  return esc(t).replace(/```([\s\S]+?)```/g, "<code>$1</code>").replace(w("*"), "$1<b>$2</b>").replace(w("_"), "$1<i>$2</i>").replace(w("~"), "$1<s>$2</s>").replace(/\n/g, "<br>");
}
/* the template a message of this order uses */
function waKey(o, k) { const x = extraOfKind(o, k); return x ? (x.paidAt ? "extrapaid" : "extra") : k === "ko" && o.fullPay ? "kof" : k; }
/* the messages that make sense for an order: its documents, its extra charges, a reminder while money is owed, the closing note */
function waChoices(o) {
  const L = docsOf(o).map(k => [k, TPL_NAMES[waKey(o, k)]]);
  extrasOf(o).forEach((x, i) => L.push(["x:" + x.id, `${REV_TYPE[x.type].short} ${i + 1}: ${x.paidAt ? "Receipt" : "Invoice"}`]));
  if (owedOf(o) > 0 && o.status !== "batal") L.push(["remind", TPL_NAMES.remind]);
  if (o.status === "selesai") L.push(["done", TPL_NAMES.done]);
  return L;
}
/* Settings shows each template on the newest real order, adjusted so the template applies */
function waSample(key) {
  const base = [...S.orders].filter(o => o.items?.length && calc(o).total).sort((a, b) => toNum(b.queue) - toNum(a.queue))[0]
    || { id: "sample", queue: nextQueue(), date: todayISO(), project: "Contoh pekerjaan", items: [{ name: "Contoh layanan", qty: 1, price: 100000 }], hist: {}, status: "dikerjakan" };
  if (key === "extra" || key === "extrapaid") { const x = { id: "sample", type: "addon", note: "Contoh pekerjaan tambahan", fee: 50000, at: Date.now(), ...(key === "extrapaid" ? { paidAt: Date.now() } : {}) }; return [{ ...base, revs: [...(base.revs || []), x] }, "x:sample"]; }
  return [{ ...base, fullPay: key === "kof" ? true : key === "ko" ? false : base.fullPay }, key === "kof" ? "ko" : key];
}

/* ctx: { order, kind } on the order page, { settings: true } in Settings */
function waMount(box, ctx) {
  const st = box._wa = box._wa || { key: ctx.settings ? "dp" : null, kind: ctx.kind, edit: false, draft: "" };
  if (!ctx.settings && !waChoices(ctx.order).some(([k]) => k === st.kind)) st.kind = waChoices(ctx.order)[0]?.[0];
  const cur = () => { const [o, k] = ctx.settings ? waSample(st.key) : [ctx.order, st.kind]; return { o, k, key: waKey(o, k) }; };
  const text = () => { const c = cur(); return c.k ? waText(c.o, c.k, st.edit ? st.draft : undefined) : ""; };
  const bubble = () => { const t = text(); return t ? `<div class="wa-bubble">${waFormat(t)}<span class="wa-time">${fmtTime(new Date())}</span></div>` : `<p class="hint">No message for this order yet.</p>`; };
  const draw = () => {
    const c = cur(), choices = ctx.settings ? Object.entries(TPL_NAMES) : waChoices(ctx.order), val = ctx.settings ? st.key : st.kind;
    box.classList.toggle("editing", st.edit);
    box.innerHTML = `<div class="wa-top"><select data-wa="pick" aria-label="Message">${sel(choices, val)}</select>${st.edit ? "" : `<button class="btn" data-wa="edit" type="button">${ic("edit")}Edit Template</button>`}</div>
      <div class="wa-grid${st.edit ? " two" : ""}">
        ${st.edit ? `<div class="wa-ed"><label><span>Template · ${esc(TPL_NAMES[c.key])}</span><textarea class="mono" rows="16" data-wa="text">${esc(st.draft)}</textarea></label>
          <div class="wa-codes"><span class="hint">Insert:</span>${Object.entries(WA_CODES).map(([k, l]) => `<button class="chip" type="button" data-code="${k}" title="{${k}}">${l}</button>`).join("")}</div>
          <p class="hint">*text* = bold, _text_ = italic. Leave a blank line between parts. Saving changes this message for every order.</p>
          <div class="row btns"><button class="btn primary" data-wa="save" type="button">Save Template</button><button class="btn" data-wa="default" type="button">Restore Default</button><button class="btn" data-wa="cancel" type="button">Cancel</button></div></div>` : ""}
        <div class="wa-view"><div class="wa-chat" data-wa="chat">${bubble()}</div>
          ${st.edit ? "" : `<div class="row btns"><button class="btn primary" data-wa="copy" type="button">${ic("copy")}Copy Message</button>${ctx.settings ? "" : `<button class="btn" data-wa="open" type="button">${ic("wa")}Open in WhatsApp</button>`}</div>`}</div>
      </div>
      ${ctx.settings ? `<p class="hint">Shown with order ${esc(qfmt(c.o.queue))}${S.settings.tpl?.[c.key] && !OLD_TPL.some(d => d[c.key] === S.settings.tpl[c.key]) ? " · this template has been edited" : " · default wording"}.</p>` : ""}`;
  };
  const chat = () => { const el = box.querySelector('[data-wa="chat"]'); if (el) el.innerHTML = bubble(); };
  box.onchange = e => { if (e.target.dataset.wa !== "pick") return; if (ctx.settings) st.key = e.target.value; else st.kind = e.target.value; st.edit = false; draw(); };
  box.oninput = e => { if (e.target.dataset.wa === "text") { st.draft = e.target.value; chat(); } };
  box.onclick = async e => {
    const code = e.target.closest("[data-code]");
    if (code) { const ta = box.querySelector('[data-wa="text"]'), ins = `{${code.dataset.code}}`, a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + ins + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + ins.length; ta.focus(); st.draft = ta.value; chat(); return; }
    const a = e.target.closest("[data-wa]")?.dataset.wa; if (!a || a === "pick" || a === "text") return;
    const c = cur();
    if (a === "edit") { st.edit = true; st.draft = tplOf(c.key); draw(); box.querySelector('[data-wa="text"]')?.focus(); return; }
    if (a === "cancel") { st.edit = false; draw(); return; }
    if (a === "default") { st.draft = DEF_TPL[c.key]; box.querySelector('[data-wa="text"]').value = st.draft; chat(); return; }
    if (a === "save") {
      const t = st.draft.replace(/\r/g, "").replace(/[ \t]+$/gm, "").trim(); if (!t) return toast("The template cannot be empty");
      const tpl = { ...(S.settings.tpl || {}) }; if (t === DEF_TPL[c.key]) delete tpl[c.key]; else tpl[c.key] = t;
      await saveSettings({ tpl }); audit(`WhatsApp template "${TPL_NAMES[c.key]}" ${t === DEF_TPL[c.key] ? "restored to the default" : "edited"}`, "settings");
      st.edit = false; draw(); toast("Template saved. Every order now uses this wording."); return;
    }
    if (a === "copy") return copyText(text(), "Message copied");
    if (a === "open") return window.open(waLink(clientPhone(ctx.order), text()), "_blank", "noopener");
  };
  draw();
}
