/* MINDBYTE Order System: Settings and boot. */
"use strict";

let TPLD = null, TPLK = "dp";
PAGES.settings = {
  title: "Settings", nav: "settings",
  render() {
    const s = S.settings; TPLD = {}; Object.keys(DEF_TPL).forEach(k => TPLD[k] = tplOf(k));
    const days = s.lastBackup ? Math.floor((Date.now() - s.lastBackup) / 864e5) : null;
    return page("System", "Settings", "Changes apply everywhere at once: documents, messages, reports and every existing order.", "", `
      <div class="grid g-2 g-top">
        <div class="stack">
          ${panel("Business", `<div class="fg">
            ${field("Business Name", `<input id="s-business" value="${esc(s.business)}">`)}
            ${field("Tagline under the Name", `<input id="s-est" value="${esc(s.est)}" placeholder="est. 2019">`)}
            ${field("Admin WhatsApp Number", `<input id="s-wa" inputmode="tel" value="${esc(s.wa)}" placeholder="08xx-xxxx-xxxx">`)}
            ${field("QRIS NMID", `<input id="s-nmid" value="${esc(s.nmid)}">`)}
            ${field("Alternative Bank Account (shown under the QRIS)", `<textarea id="s-bank" placeholder="e.g. BCA 1234567890 a.n. ...">${esc(s.bank)}</textarea>`, "full")}
            ${field("Document Footer", `<input id="s-foot" value="${esc(s.foot)}">`, "full")}
          </div>
          <div class="imgset"><div><img id="logoPv" alt=""><button class="btn" data-s="logo" type="button">Change Logo</button>${s.logoFile ? `<button class="btn link" data-s="logo-reset" type="button">Use default</button>` : ""}</div>
            <div><img id="qrisPv" alt=""><button class="btn" data-s="qris" type="button">Change QRIS</button>${s.qrisFile ? `<button class="btn link" data-s="qris-reset" type="button">Use default</button>` : ""}</div></div>`)}
          ${panel("Numbering & Payment", `<div class="fg">
            ${field("Last Order Number", `<input id="s-last" inputmode="numeric" value="${esc(s.lastQueue)}">`)}
            ${field("Default Down Payment (%)", `<input id="s-dp" inputmode="numeric" maxlength="3" value="${esc(s.dpPct)}">`)}
            ${field("Monthly Revenue Target (Rp)", `<input id="s-target" class="money" inputmode="numeric" value="${money(s.monthlyTarget)}" placeholder="0 = off">`, "full")}
            ${Object.keys(DOC).map(k => field(`${DOC[k].title} Number`, `<input id="s-no-${k}" value="${esc(s.docNo[k])}">`)).join("")}
          </div><p class="hint">Next order number: <b>${qfmt(nextQueue())}</b>. In document numbers, <code>{n}</code> becomes the order number. Changing a format renumbers the documents of every order.</p>`)}
          ${panel("Revisions", `<div class="fg">
            ${field("Maximum Revisions", `<input id="s-revmax" inputmode="numeric" maxlength="2" value="${esc(s.revMax)}">`)}
            ${field("Revision Period (hours)", `<input id="s-revh" inputmode="numeric" maxlength="3" value="${esc(s.revHours)}">`)}
            ${field("Revision Terms (one per line, printed on the Receipt)", `<textarea id="s-rev" rows="6">${esc(s.rev)}</textarea>`, "full")}
          </div><p class="hint"><code>{max}</code> and <code>{hours}</code> in the terms are filled from the two numbers above, so the text and the revision counter always agree.</p>`)}
        </div>
        <div class="stack">
          ${panel("WhatsApp Message Templates", `<p class="hint">Pick a message to see it as the customer will on WhatsApp. Edit Template changes the wording for every order; codes such as {total} are filled in from each order.</p><div class="wa-box" id="setWa"></div>`)}
          ${panel("Lists", `<div class="fg">
            ${field("Order Sources (one per line)", `<textarea id="s-sources" rows="6">${esc(s.sources.join("\n"))}</textarea>`)}
            ${field("Expense Categories (one per line)", `<textarea id="s-expcats" rows="6">${esc(s.expCats.join("\n"))}</textarea>`)}
          </div><p class="hint">Order categories come from the Price List categories.</p>`)}
          ${cloudPanel()}
          ${securityPanel()}
          ${pushPanel()}
          ${panel("Data Backup", `<p class="hint">Data is stored in this browser on this device. Download a backup regularly, and use it to move your data to another device. ${days === null ? "<b>No backup has been downloaded yet.</b>" : `Last backup: ${fmtDateTime(s.lastBackup)}.`}</p>
            <div class="row btns"><button class="btn primary" data-s="backup" type="button">${ic("dl")}Download Backup</button><button class="btn" data-s="vcf" type="button">${ic("users")}Import WhatsApp Contacts (.vcf)</button><button class="btn" data-s="restore" type="button">Restore from Backup</button><button class="btn" data-s="prices-reset" type="button">Reload Price List from PDF</button><button class="btn danger" data-s="wipe" type="button">Delete All Data</button></div>
            <p class="hint">Proofs of payment, logo and QRIS images are not included in the backup file.</p>`)}
          ${panel("About", `<dl class="kv"><dt>Orders</dt><dd>${S.orders.length}</dd><dt>Customers</dt><dd>${S.customers.length}</dd><dt>Services</dt><dd>${S.prices.length}</dd><dt>Expenses</dt><dd>${S.expenses.length}</dd><dt>Storage</dt><dd>${Store.mode === "device" ? "This device (IndexedDB)" : Store.mode === "local" ? "Browser storage" : "Memory only"}</dd><dt>Version</dt><dd>v24 · ${todayISO()}</dd></dl>`)}
        </div>
      </div>`);
  },
  bar() { return `<button class="btn primary" data-sa="save" type="button">Save Settings</button>`; },
  after() {
    $("#logoPv").src = IMG.logo; $("#qrisPv").src = IMG.qris;
    waMount($("#setWa"), { settings: true });
    $("#abarIn").onclick = e => { if (e.target.closest('[data-sa="save"]')) saveSettingsForm(); };
    $("#main").onclick = async e => {
      const clb = e.target.closest("[data-cl]"); if (clb) return cloudAction(clb.dataset.cl, clb);
      const a = e.target.closest("[data-s]")?.dataset.s; if (!a) return;
      if (a === "logo" || a === "qris") { const f = await pickFile("image/*"); if (!f) return; try { const id = await Store.saveFile(f, f.name); const key = a + "File"; const old = S.settings[key]; await saveSettings({ [key]: id }); if (old) Store.delFile(old); await loadImages(); refresh(); toast("Image saved"); } catch (err) { toast(err.message || "Could not save the image"); } }
      if (a === "logo-reset" || a === "qris-reset") { const key = a.split("-")[0] + "File"; const old = S.settings[key]; await saveSettings({ [key]: null }); if (old) Store.delFile(old); await loadImages(); refresh(); }
      if (a === "backup") { download(`${S.settings.business} Backup ${todayISO()}.json`, new Blob([JSON.stringify(backupData(), null, 1)], { type: "application/json" }), "Backup downloaded"); await saveSettings({ lastBackup: Date.now() }); updateStoreInfo(); refresh(); }
      if (a === "restore") restoreSheet();
      if (a === "vcf") vcfImport();
      if (a === "prices-reset") { if (await confirmSheet("Reload price list", `Replace the whole price list with the ${window.MB_PRICE_SEED.length} services from "Price List Twitter.pdf"? Services you added yourself will be removed. Orders are not affected.`, "Replace")) { await Store.clear("prices"); await Store.putMany("prices", window.MB_PRICE_SEED.map(p => ({ ...p, createdAt: Date.now(), updatedAt: Date.now() }))); toast("Price list reloaded"); refresh(); } }
      if (a === "wipe") { if (await confirmSheet("Delete all data", "Delete every order, customer, service and expense on this device? Download a backup first. This cannot be undone.", "Delete Everything", true)) { for (const c of COLLS) await Store.clear(c); S.hist = {}; await Store.meta("hist", {}); toast("All data deleted"); go("dashboard"); } }
    };
  }
};
async function saveSettingsForm() {
  /* templates are saved by their own editor (js/wa.js); Save Settings keeps them as they are */
  const tpl = S.settings.tpl || {};
  const lines = id => $(id).value.split("\n").map(x => x.trim()).filter(Boolean);
  const docNoF = {}; for (const k of Object.keys(DOC)) { const v = $(`#s-no-${k}`).value.trim(); if (!v.includes("{n}")) { toast(`${DOC[k].title} number must contain {n}`); $(`#s-no-${k}`).focus(); return; } docNoF[k] = v; }
  const name = $("#s-business").value.trim(); if (!name) { toast("Business name is required"); return; }
  try {
    await saveSettings({ business: name, est: $("#s-est").value.trim(), wa: $("#s-wa").value.trim(), nmid: $("#s-nmid").value.trim(), bank: $("#s-bank").value.trim(), foot: $("#s-foot").value.trim(),
      lastQueue: toNum($("#s-last").value) || DEF_SETTINGS.lastQueue, dpPct: Math.min(100, toNum($("#s-dp").value)), monthlyTarget: toNum($("#s-target").value), docNo: docNoF,
      revMax: Math.max(1, toNum($("#s-revmax").value) || 2), revHours: Math.max(1, toNum($("#s-revh").value) || 2), rev: $("#s-rev").value.trim(), tpl,
      sources: lines("#s-sources").length ? lines("#s-sources") : DEF_SETTINGS.sources, expCats: lines("#s-expcats").length ? lines("#s-expcats") : DEF_SETTINGS.expCats });
    audit("Settings saved", "settings"); updateStoreInfo(); refresh(); toast("Settings saved");
  } catch (e) { toast("Could not save settings"); }
}
async function restoreSheet() {
  const f = await pickFile("application/json,.json"); if (!f) return;
  let d; try { d = JSON.parse(await f.text()); if (!d || !Array.isArray(d.orders)) throw 0; } catch (e) { toast("This file is not a valid backup"); return; }
  openSheet("Restore from Backup", `<p class="lead">${plural(d.orders.length, "order")}${d.customers ? `, ${plural(d.customers.length, "customer")}` : ""}${d.prices?.length ? `, ${plural(d.prices.length, "service")}` : ""}${d.expenses?.length ? `, ${plural(d.expenses.length, "expense")}` : ""}${d.exportedAt ? ` from ${fmtDateTime(d.exportedAt)}` : ""}.</p>
    <label class="radio"><input type="radio" name="rsMode" value="merge" checked>Merge: records with the same ID are overwritten, everything else stays</label>
    <label class="radio"><input type="radio" name="rsMode" value="replace">Replace: delete the data on this device first</label>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button">Restore</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return; e.target.disabled = true;
    try { const n = await restoreBackup(d, $('input[name="rsMode"]:checked').value); closeSheet(); applyTheme(); await loadImages(); toast(`${plural(n, "order")} restored`); go("dashboard"); }
    catch (err) { toast("Restore failed: " + (err.message || err)); e.target.disabled = false; }
  });
}

/* ===================== WHATSAPP CONTACTS (.vcf) =====================
   Contacts are saved under order numbers ("3.031", "3.028 Oktober & 3.051 November").
   Each such contact becomes one customer linked to those orders; an order that already has a
   customer only gets the number filled in. Contacts named like an existing customer fill that phone. */
function parseVcf(text) {
  return [...text.matchAll(/BEGIN:VCARD([\s\S]*?)END:VCARD/g)].map(m => {
    const c = m[1].replace(/\r?\n[ \t]/g, ""), fn = (c.match(/^FN[^:]*:(.*)$/m) || [])[1] || "";
    const tels = [...c.matchAll(/^TEL[^:]*:(.*)$/gm)].map(t => t[1].replace(/[^\d+]/g, "")).filter(Boolean);
    return { name: fn.trim(), phone: tels[0] ? tels[0].replace(/^\+62/, "0").replace(/^62(?=8)/, "0") : "" };
  }).filter(c => c.name && c.phone);
}
function vcfPlan(contacts) {
  const byQ = new Map(S.orders.map(o => [toNum(o.queue), o])), plan = [], missing = [];
  contacts.forEach(ct => {
    const qs = [...new Set((ct.name.match(/(?<!\d)(\d\.\d{3}|\d{4})(?!\d)/g) || []).map(toNum).filter(q => q >= 2500 && q <= 9999))];
    if (qs.length) {
      const os = qs.map(q => byQ.get(q)).filter(Boolean); qs.filter(q => !byQ.has(q)).forEach(q => missing.push(q));
      if (!os.length) return;
      const cust = os.map(custOf).find(Boolean);
      plan.push({ ct, orders: os, cust, label: os.map(o => qfmt(o.queue)).join(" & ") });
    } else {
      const cust = S.customers.find(c => normName(c.name) === normName(ct.name));
      if (cust && waNumber(cust.phone) !== waNumber(ct.phone)) plan.push({ ct, orders: [], cust, label: cust.name });
    }
  });
  return { plan, missing: [...new Set(missing)].sort((a, b) => a - b) };
}
async function vcfImport() {
  const f = await pickFile(".vcf,text/vcard,text/x-vcard"); if (!f) return;
  const contacts = parseVcf(await f.text());
  if (!contacts.length) return toast("No contacts with a phone number found in this file");
  const { plan, missing } = vcfPlan(contacts);
  const what = p => p.cust ? (p.cust.phone ? (waNumber(p.cust.phone) === waNumber(p.ct.phone) ? "already has this number" : "different number on file, keep it") : `add number to ${p.cust.name}`) : `new customer "Client ${p.label}"`;
  const changes = plan.filter(p => !(p.cust && p.cust.phone));
  openSheet("Import WhatsApp Contacts", `<p class="lead">${plural(contacts.length, "contact")} read. ${plural(plan.length, "contact")} match your orders or customers; ${plural(changes.length, "change")} will be made.</p>
    ${missing.length ? `<div class="note warn">These order numbers are saved in your contacts but do not exist in the system: ${missing.map(qfmt).join(", ")}. Record them with Record Past Order if they were real orders.</div>` : ""}
    <div class="tw"><table class="dt"><tbody>${plan.map(p => `<tr><td class="no">${esc(p.label)}</td><td><div class="nm">${esc(p.ct.name)}</div><div class="sub">${esc(p.ct.phone)}</div></td><td class="r"><span class="sub">${esc(what(p))}</span></td></tr>`).join("") || emptyRow(3, "Nothing to import.")}</tbody></table></div>
    <p class="hint">Other contacts are left out because they do not match an order number or a customer name. Customers created here can be renamed on the Customers page; every order follows.</p>
    <div class="row btns"><button class="btn primary" data-a="ok" type="button" ${changes.length ? "" : "disabled"}>Apply ${plural(changes.length, "Change")}</button><button class="btn" data-close type="button">Cancel</button></div>`, async e => {
    if (e.target.closest("[data-a]")?.dataset.a !== "ok") return; e.target.disabled = true;
    const r = await applyVcfChanges(changes);
    closeSheet(); toast(`${r.nc} customers created, ${r.np} numbers added, ${plural(r.nl, "order")} linked`); go("customers");
  }, { wide: true });
}
async function applyVcfChanges(changes) {
  let nc = 0, np = 0, nl = 0;
  for (const p of changes) {
    let c = p.cust;
    if (c) { await saveCustomer({ ...c, phone: p.ct.phone }); np++; }
    else { c = await saveCustomer({ id: uid("c"), name: `Client ${p.label}`, phone: p.ct.phone, note: `Imported from WhatsApp contact "${p.ct.name}"`, source: "WhatsApp" }); nc++; }
    const link = p.orders.filter(o => !o.customerId).map(o => ({ ...o, customerId: c.id, updatedAt: Date.now() }));
    if (link.length) { await Store.putMany("orders", link); nl += link.length; }
  }
  await audit(`WhatsApp contacts imported: ${nc} customers created, ${np} numbers added, ${nl} orders linked`, "customers");
  return { nc, np, nl };
}
/* a bundled contact list (js/import-wa-contacts.js) is applied once per device, then remembered */
async function pendingContactImport() {
  const P = window.MB_PENDING_CONTACTS; if (!P || (S.settings.importsDone || []).includes(P.id)) return null;
  const changes = vcfPlan(P.contacts).plan.filter(p => !(p.cust && p.cust.phone));
  const r = await applyVcfChanges(changes);
  await saveSettings({ importsDone: [...(S.settings.importsDone || []), P.id] });
  return r;
}

/* ===================== BOOT ===================== */
/* a start-up problem is shown in plain words with a way forward, instead of an endless "Loading…" */
function bootProblem(msg, detail) {
  const m = $("#main"); if (!m || bootProblem.shown === msg) return; bootProblem.shown = msg;
  m.innerHTML = page("System", "The system could not start", "", "", panel("What happened", `<p class="lead">${esc(msg)}</p>${detail ? `<p class="hint">Technical detail: <code>${esc(detail)}</code></p>` : ""}
    <p class="hint">Your data has not been deleted. Once this is fixed, everything reappears.</p>
    <div class="row btns"><button class="btn primary" type="button" onclick="location.reload()">Try Again</button><a class="btn" href="#/dashboard" onclick="setTimeout(()=>location.reload(),50)">Open Dashboard</a></div>`));
}
/* any unexpected error becomes visible, so it can be reported instead of failing silently */
addEventListener("error", e => { if (e.message && !/ResizeObserver|Script error/.test(e.message)) toast("Error: " + e.message); });
addEventListener("unhandledrejection", e => { const m = e.reason && (e.reason.message || String(e.reason)); if (m) toast("Error: " + m); });
(async function boot() {
  document.body.insertAdjacentHTML("afterbegin", shellHtml());
  wireShell();
  $("#main").innerHTML = `<p class="empty">Loading…</p>`;
  await Auth.gate();   /* nothing is read until this device is signed in (only when the sign-in server is set up) */
  try { await Store.init(); } catch (e) { return bootProblem("The data on this device could not be read.", e.message || String(e)); }
  /* each start-up step is independent: one failing must never leave the screen stuck on "Loading…" */
  let seeded = false, imported = null;
  try { seeded = await seedIfEmpty(); } catch (e) { console.error("Seeding failed", e); toast("Some bundled data could not be loaded: " + (e.message || e)); }
  try { imported = await pendingContactImport(); } catch (e) { console.error("Contact import failed", e); }
  try { applyTheme(); await loadImages(); updateStoreInfo(); } catch (e) { console.error(e); }
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  try { render(); } catch (e) { return bootProblem("This page could not be shown.", e.message || String(e)); }
  if (imported) toast(`WhatsApp contacts imported: ${imported.nc} customers created, ${imported.np} numbers added, ${plural(imported.nl, "order")} linked`);
  else if (seeded) toast(`Loaded ${plural(S.orders.length, "order")}, ${plural(S.customers.length, "customer")} and ${plural(S.prices.length, "service")}`);
  Cloud.init().then(() => { updateStoreInfo(); if (ROUTE.name === "settings") refresh(); });
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  /* installable app (Android home screen / Windows app window): offline files via the service worker */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").then(watchUpdates).catch(e => console.warn("Service worker", e));
})();

/* updates: each publish ships a new service worker. When it is ready, a bar offers "Update now";
   tapping it switches to the new version and reloads. Checked on start, when the app comes back into view and every 10 minutes. */
function watchUpdates(reg) {
  const offer = w => { if (w && navigator.serviceWorker.controller) updateBar(w); };
  offer(reg.waiting);
  reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed") offer(w); }); });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; location.reload(); } });
  const check = () => reg.update().catch(() => {});
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  setInterval(check, 10 * 60e3);
}
function updateBar(w) {
  if ($("#updBar")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="upd-bar" id="updBar" role="status"><span><b>A new version is available.</b> Update to get the latest changes.</span><button class="btn primary sm" type="button">Update Now</button><button class="ib" type="button" aria-label="Later" title="Later">${ic("x")}</button></div>`);
  const bar = $("#updBar"), [go, later] = bar.querySelectorAll("button");
  go.onclick = async () => { if (["new", "past", "edit"].includes(ROUTE.name) && !await confirmSheet("Update now", "The order you are editing has not been saved yet. Update anyway?", "Update")) return; go.disabled = true; go.textContent = "Updating…"; w.postMessage("skip"); };
  later.onclick = () => bar.remove();
}
