/* MINDBYTE Order System: data clean-up pages.
   - Orders Without a Customer: fill in the customer of each order before its invoice goes out (names are typed by the admin, never guessed).
   - Price List Matching: link old order lines to a price list code. Suggestions only; nothing is saved until the admin ticks it. */
"use strict";

/* order form: the Payment choice fills the down payment percentage, and typing a percentage updates the choice */
document.addEventListener("change", e => {
  if (e.target.id !== "f-paytype") return; const dp = $("#f-dp"); if (!dp) return;
  if (e.target.value === "full") dp.value = 100; else if (e.target.value === "dp") dp.value = S.settings.dpPct; else { dp.focus(); dp.select(); return; }
  dp.dispatchEvent(new Event("input", { bubbles: true }));
});
document.addEventListener("input", e => { if (e.target.id === "f-dp" && $("#f-paytype")) $("#f-paytype").value = payTypeOf(toNum(e.target.value)); });

/* ===================== ORDERS WITHOUT A CUSTOMER ===================== */
const NC = { all: false };
const noCustOrders = all => S.orders.filter(o => !o.customerId && (all || isActive(o))).sort((a, b) => isActive(b) - isActive(a) || toNum(b.queue) - toNum(a.queue));
/* the customer typed for an order: an existing customer with the same name, else a new one */
async function setOrderCustomer(o, name, phone) {
  name = String(name || "").trim().replace(/\s+/g, " "); phone = String(phone || "").trim();
  if (!name) throw new Error("Type the customer's name");
  let c = S.customers.find(x => normName(x.name) === normName(name));
  if (c) { if (phone && !c.phone) c = await saveCustomer({ ...c, phone }); }
  else c = await saveCustomer({ id: uid("c"), name, phone, note: "", source: o.source || "" });
  const cur = S.orders.find(x => x.id === o.id) || o;
  return saveOrder({ ...cur, customerId: c.id }, `Customer set to ${c.name}`);
}
/* a small sheet to add the customer straight from the order page */
function quickCustomer(o) {
  openSheet("Add Customer to Order " + qfmt(o.queue), `<p class="hint">${esc(o.project || "")}</p><div class="fg">
    ${field("Customer Name", `<input id="qc-name" list="qcList" autocomplete="off" placeholder="Type a new name or pick an existing customer">`, "full")}
    ${field("WhatsApp Number (optional)", `<input id="qc-phone" inputmode="tel" placeholder="08xx">`)}</div>
    <datalist id="qcList">${S.customers.map(c => `<option value="${esc(c.name)}">${esc(c.phone || "")}</option>`).join("")}</datalist>
    <p class="hint">An existing name links the order to that customer; a new name creates the customer.</p>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Save</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return;
    try { await setOrderCustomer(o, $("#qc-name").value, $("#qc-phone").value); closeSheet(); refresh(); toast("Customer saved"); } catch (x) { toast(x.message || "Could not save"); }
  });
  setTimeout(() => $("#qc-name")?.focus(), 50);
}
PAGES.nocust = {
  title: "Orders Without a Customer", nav: "customers", parent: "customers",
  render() {
    const act = noCustOrders(false).length, all = noCustOrders(true).length;
    return page("Sales · Customers", "Orders Without a Customer", `${plural(act, "active order")} · ${plural(all, "order")} in total`, "", `
      <div class="note"><b>Fill in the customer before sending an invoice.</b> Without a customer the documents print "Bill To -" and WhatsApp cannot open the chat. Type the real name (and number if you have it); nothing is filled in automatically.</div>
      ${panel(null, `<div class="toolbar"><select id="ncAll">${sel([["0", "Active orders only"], ["1", "All orders (including completed)"]], NC.all ? "1" : "0")}</select></div>
        <div class="tw"><table class="dt"><thead><tr><th>Order</th><th>Customer</th><th class="r">Save</th></tr></thead><tbody id="ncRows"></tbody></table></div>
        <datalist id="ncList">${S.customers.map(c => `<option value="${esc(c.name)}">${esc(c.phone || "")}</option>`).join("")}</datalist>`, { flush: true })}`);
  },
  after() {
    const draw = () => {
      const L = noCustOrders(NC.all).slice(0, 400);
      $("#ncRows").innerHTML = L.map(o => `<tr data-id="${esc(o.id)}"><td><div class="nm"><a href="#/order/${esc(o.id)}">${qfmt(o.queue)}</a> · ${esc(o.project || "Untitled order")}</div><div class="sub">${badge(o)} ${fmtShort(o.date)}${o.noAmount ? "" : ` · ${rp(grandTotal(o))}`}</div></td>
        <td><div class="nc-in"><input class="nc-name" list="ncList" autocomplete="off" placeholder="Customer name" aria-label="Customer name for order ${qfmt(o.queue)}"><input class="nc-phone" inputmode="tel" placeholder="WhatsApp (optional)" aria-label="WhatsApp number"></div></td>
        <td class="r"><button class="btn sm primary" data-a="save" type="button">Save</button></td></tr>`).join("")
        || emptyRow(3, NC.all ? "Every order has a customer." : "Every active order has a customer.");
    };
    draw();
    $("#ncAll").onchange = e => { NC.all = e.target.value === "1"; draw(); };
    $("#main").onclick = async e => {
      const b = e.target.closest('[data-a="save"]'); if (!b) return;
      const tr = b.closest("tr"), o = S.orders.find(x => x.id === tr.dataset.id); if (!o) return;
      b.disabled = true;
      try { const n = await setOrderCustomer(o, $(".nc-name", tr).value, $(".nc-phone", tr).value); toast(`Order ${qfmt(o.queue)}: ${clientName(n)}`); tr.remove();
        if (!$("#ncRows tr")) draw(); }
      catch (x) { toast(x.message || "Could not save"); b.disabled = false; }
    };
    $("#main").onkeydown = e => { if (e.key === "Enter" && e.target.matches(".nc-name, .nc-phone")) e.target.closest("tr").querySelector('[data-a="save"]').click(); };
  }
};

/* ===================== PRICE LIST MATCHING ===================== */
/* words that say nothing about the service, and spellings that mean the same thing */
const PM_STOP = new Set("dan atau yang untuk dengan di ke dari per pada sampai serta beserta termasuk sesuai the of and for to in on a an by with output word pdf maks max min halaman hal lembar jam hari kata qty order orders nominal tidak tercatat dll dst".split(" "));
const PM_SYN = { journal: "jurnal", journals: "jurnal", article: "artikel", articles: "artikel", paper: "makalah", essay: "esai", powerpoint: "ppt", slide: "ppt", slides: "ppt", presentasi: "ppt", presentation: "ppt",
  translate: "terjemah", translation: "terjemah", terjemahan: "terjemah", paraphrase: "parafrase", parafrasa: "parafrase", statistic: "statistik", statistics: "statistik", statistika: "statistik",
  thesis: "skripsi", publikasi: "publish", publication: "publish", terbit: "publish", revision: "revisi", design: "desain", datasets: "dataset", review: "review", ringkasan: "rangkuman", summary: "rangkuman",
  soal: "soal", task: "soal", exam: "soal", quiz: "soal", reference: "dapus", referensi: "dapus", pustaka: "dapus", regresi: "regresi", regression: "regresi" };
const pmTokens = s => String(s || "").toLowerCase().replace(/power\s*point/g, "ppt").normalize("NFKD").replace(/[^a-z0-9]+/g, " ").split(" ")
  .filter(w => w.length > 1 && !PM_STOP.has(w) && !/^\d+$/.test(w)).map(w => PM_SYN[w] || w);
const PM_GENERIC = /^(nominal tidak tercatat|realtime|-)?$/i;
let PM_INDEX = null;
function pmIndex() {
  const key = S.prices.length + ":" + Math.max(0, ...S.prices.map(p => p.updatedAt || 0));
  if (PM_INDEX && PM_INDEX.key === key) return PM_INDEX;
  const docs = S.prices.filter(p => p.code && !/^15\./.test(p.code)).map(p => {
    const w = new Map(); const add = (s, k) => pmTokens(s).forEach(t => w.set(t, Math.max(w.get(t) || 0, k)));
    add(p.name, 1); add(p.group, 0.6); add(p.cat, 0.4); add(p.note, 0.2); return { p, w };
  });
  const df = new Map(); docs.forEach(d => d.w.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = t => Math.log(1 + docs.length / (df.get(t) || 0.5));
  docs.forEach(d => { d.norm = Math.sqrt(sum([...d.w], ([t, k]) => (k * idf(t)) ** 2)) || 1; });
  return PM_INDEX = { key, docs, idf };
}
/* best price list matches for one order line: its own text, plus the job title when the line itself says nothing */
function pmSuggest(o, item, n = 5) {
  const { docs, idf } = pmIndex(), q = new Map();
  const add = (s, k) => pmTokens(s).forEach(t => q.set(t, Math.max(q.get(t) || 0, k)));
  const generic = PM_GENERIC.test(String(item.name || "").trim());
  add(item.name, 1); add(o.project, generic ? 1 : 0.5);
  if (!q.size) return [];
  const qn = Math.sqrt(sum([...q], ([t, k]) => (k * idf(t)) ** 2)) || 1;
  return docs.map(d => { let dot = 0; q.forEach((k, t) => { if (d.w.has(t)) dot += k * d.w.get(t) * idf(t) ** 2; }); return { p: d.p, score: dot / (qn * d.norm) }; })
    .filter(x => x.score > 0.05).sort((a, b) => b.score - a.score).slice(0, n);
}
const PMS = { q: "", amt: "all", pick: {}, ok: {}, limit: 150 };
function pmRows() {
  const L = [];
  S.orders.forEach(o => (o.items || []).forEach((it, i) => { if (it.priceId && S.prices.some(p => p.id === it.priceId)) return;
    const key = `${o.id}#${i}`, sug = pmSuggest(o, it);
    L.push({ key, o, i, it, sug, best: sug[0]?.score || 0 }); }));
  return L.sort((a, b) => b.best - a.best);
}
PAGES.pricematch = {
  title: "Price List Matching", nav: "prices", parent: "prices",
  render() {
    return page("Pricing · Price List", "Price List Matching", `<span id="pmCount"></span>`, `<button class="btn primary" data-a="save" type="button">${ic("chk")}Save Ticked Matches</button>`, `
      <div class="note"><b>Check every suggestion before saving.</b> Each old order line without a price list code gets up to 5 suggestions from the price list, ranked by matching words in the line and the job title. Only lines you tick are saved; prices, names and amounts on the orders do not change. The order's category follows the linked service (HQ, TECHNO or PRAXIS) unless a brand was chosen on the order.</div>
      ${panel(null, `<div class="toolbar"><input id="pmQ" type="search" placeholder="Search order, job or line" value="${esc(PMS.q)}">
        <select id="pmAmt">${sel([["all", "All lines"], ["amt", "Lines with an amount"], ["noamt", "Lines without an amount (Nominal tidak tercatat)"]], PMS.amt)}</select>
        <button class="btn" data-a="tick" type="button">Tick shown lines with a match of 45% or more</button><button class="btn" data-a="untick" type="button">Untick all</button></div>
        <div class="tw"><table class="dt pm"><thead><tr><th>OK</th><th>Order line</th><th>Price list code</th><th class="r">Match</th></tr></thead><tbody id="pmRows"></tbody></table></div>`, { flush: true })}`);
  },
  after() {
    let rows = pmRows();
    const shown = () => { const q = PMS.q.toLowerCase().trim();
      return rows.filter(r => (!q || [qfmt(r.o.queue), r.o.queue, r.o.project, r.it.name].join(" ").toLowerCase().includes(q))
        && (PMS.amt === "all" || (PMS.amt === "amt" ? r.it.price > 0 : !r.it.price))); };
    const pickOf = r => PMS.pick[r.key] ?? r.sug[0]?.p.id ?? "";
    const draw = () => {
      const L = shown(), ticked = Object.values(PMS.ok).filter(Boolean).length;
      $("#pmCount").textContent = `${plural(rows.length, "line")} without a code · ${L.length} shown · ${ticked} ticked`;
      $("#pmRows").innerHTML = L.slice(0, PMS.limit).map(r => { const pid = pickOf(r), s = r.sug.find(x => x.p.id === pid), extra = pid && !s ? S.prices.find(p => p.id === pid) : null;
        return `<tr data-k="${esc(r.key)}"><td><input type="checkbox" data-a="ok" ${PMS.ok[r.key] ? "checked" : ""} ${pid ? "" : "disabled"} aria-label="Approve"></td>
        <td><div class="nm">${esc(r.it.name || "(no description)")}</div><div class="sub"><a href="#/order/${esc(r.o.id)}">${qfmt(r.o.queue)}</a> · ${esc(r.o.project || "")}${r.it.price ? ` · ${rp(r.it.qty * r.it.price)}` : ""}</div></td>
        <td><select data-a="pick" aria-label="Price list code"><option value="">No match</option>${r.sug.map(x => `<option value="${esc(x.p.id)}"${x.p.id === pid ? " selected" : ""}>${esc(x.p.code)} · ${esc(x.p.name)} (${Math.round(x.score * 100)}%)</option>`).join("")}${extra ? `<option value="${esc(extra.id)}" selected>${esc(extra.code)} · ${esc(extra.name)}</option>` : ""}</select>
          <button class="btn link sm" data-a="other" type="button">Pick another</button>${pid ? `<div class="sub">${esc((s?.p || extra)?.cat || "")} → ${catOfBrand(brandOfPrice(s?.p || extra))}</div>` : ""}</td>
        <td class="r">${s ? Math.round(s.score * 100) + "%" : extra ? "manual" : "-"}</td></tr>`; }).join("")
        + (L.length > PMS.limit ? `<tr><td colspan="4"><button class="btn" data-a="more" type="button">Show ${Math.min(150, L.length - PMS.limit)} more</button></td></tr>` : "")
        || emptyRow(4, rows.length ? "No matching lines." : "Every order line is linked to the price list.");
    };
    draw();
    $("#pmQ").oninput = e => { PMS.q = e.target.value; draw(); };
    $("#pmAmt").onchange = e => { PMS.amt = e.target.value; draw(); };
    $("#main").onchange = e => { const tr = e.target.closest("tr[data-k]"); if (!tr) return; const k = tr.dataset.k;
      if (e.target.dataset.a === "ok") { PMS.ok[k] = e.target.checked; $("#pmCount").textContent = $("#pmCount").textContent.replace(/\d+ ticked/, `${Object.values(PMS.ok).filter(Boolean).length} ticked`); }
      if (e.target.dataset.a === "pick") { PMS.pick[k] = e.target.value; PMS.ok[k] = !!e.target.value; draw(); } };
    $("#main").onclick = async e => { const a = e.target.closest("[data-a]")?.dataset.a; if (!a || a === "ok" || a === "pick") return;
      if (a === "more") { PMS.limit += 150; draw(); }
      if (a === "tick") { shown().forEach(r => { const s = r.sug.find(x => x.p.id === pickOf(r)); if (s && s.score >= 0.45) PMS.ok[r.key] = true; }); draw(); }
      if (a === "untick") { PMS.ok = {}; draw(); }
      if (a === "other") { const k = e.target.closest("tr").dataset.k; pickPrice(p => { PMS.pick[k] = p.id; PMS.ok[k] = true; draw(); }); }
      if (a === "save") {
        const sel_ = rows.filter(r => PMS.ok[r.key] && pickOf(r)); if (!sel_.length) { toast("Tick at least one line first"); return; }
        if (!await confirmSheet("Save matches", `Link ${plural(sel_.length, "order line")} on ${plural(new Set(sel_.map(r => r.o.id)).size, "order")} to the chosen price list codes?`, "Save")) return;
        const by = new Map(); sel_.forEach(r => { if (!by.has(r.o.id)) by.set(r.o.id, []); by.get(r.o.id).push(r); });
        let n = 0, skipped = 0;
        for (const [id, L] of by) {
          const cur = S.orders.find(x => x.id === id); if (!cur) { skipped += L.length; continue; }
          const items = (cur.items || []).map(i => ({ ...i })), codes = [];
          L.forEach(r => { const it = items[r.i]; const p = S.prices.find(x => x.id === pickOf(r));
            /* the line must still be the one shown: same text and no code yet */
            if (!it || !p || it.name !== r.it.name || it.priceId) { skipped++; return; } it.priceId = p.id; codes.push(p.code); n++; });
          if (!codes.length) continue;
          const next = { ...cur, items }; if (!cur.brand && (!cur.cat || ORDER_CATS.includes(cur.cat))) next.cat = guessCat(next);
          await saveOrder(next, `Price list codes linked: ${codes.join(", ")}`);
        }
        PMS.ok = {}; PMS.pick = {}; rows = pmRows(); draw();
        toast(`${plural(n, "line")} linked to the price list${skipped ? `, ${skipped} skipped (changed meanwhile)` : ""}`);
      }
    };
  }
};
