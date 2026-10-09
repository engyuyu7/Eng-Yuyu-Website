/* =====================================================================
   Blog filter, forms
   ===================================================================== */
if (has('#blogFilters')) $('#blogFilters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  blogFilter = b.dataset.cat; renderBlog(); $(`.chip[data-cat="${blogFilter}"]`).focus();
});

const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const nlForm = $('#nlForm'), nlMsg = $('#nlMsg'), nlEmail = $('#nlEmail');
function say(el, text, ok) { el.textContent = text; el.classList.toggle('ok', ok); el.classList.toggle('bad', !ok); }
if (has('#nlForm')) nlForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = nlEmail.value.trim();
  if (!validEmail(email)) { nlEmail.setAttribute('aria-invalid', 'true'); say(nlMsg, t('nl.bad'), false); nlEmail.focus(); return; }
  nlEmail.removeAttribute('aria-invalid');
  const btn = nlForm.querySelector('button'); btn.disabled = true;
  try {
    if (API || CONFIG.newsletterEndpoint) {
      const r = await fetch(API ? API + '/api/subscribe' : CONFIG.newsletterEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, lang, source: document.body.dataset.page }) });
      if (!r.ok) throw new Error(r.status);
      say(nlMsg, API ? t('nl.done') : t('nl.ok'), true); nlForm.reset(); track('newsletter');
    } else { // no provider connected yet: hand off to the user's mail app rather than pretend it saved
      say(nlMsg, t('nl.mail'), true);
      location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Newsletter subscription')}&body=${encodeURIComponent('Please subscribe: ' + email)}`;
    }
  } catch { say(nlMsg, t('nl.err'), false); }
  btn.disabled = false;
});

/* ---------- "Invite me to speak" form (events page) ---------- */
if (has('#inviteForm')) {
  const f = $('#inviteForm'), msg = $('#invMsg');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => $('#' + id).value.trim(), name = v('invName'), mail = v('invEmail'), org = v('invOrg'), type = $('#invType').selectedOptions[0].textContent, when = v('invDate'), where = v('invPlace'), size = v('invSize'), note = v('invNote');
    const bad = [fieldErr('invName', name ? '' : t('ct.eName')), fieldErr('invEmail', validEmail(mail) ? '' : t('ct.eEmail')), fieldErr('invNote', note ? '' : t('ev.inv.eMsg'))];
    if (bad.includes(false)) { f.querySelector('[aria-invalid="true"]').focus(); return; }
    const message = [`Event type: ${type}`, org && `Organisation: ${org}`, when && `Date: ${when}`, where && `Place: ${where}`, size && `Audience size: ${size}`, '', note].filter(x => x !== '' ? Boolean(x) : true).join('\n');
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      if (API) {
        const r = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: mail, type: 'events', message, lang }) });
        if (!r.ok) throw new Error(r.status);
        say(msg, t('ev.inv.sent'), true); f.reset(); track('invite');
      } else { say(msg, t('ct.ok'), true); location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Event invitation: ' + type + (org ? ', ' + org : ''))}&body=${encodeURIComponent(message + '\n\n- ' + name + ' (' + mail + ')')}`; }
    } catch { say(msg, t('nl.err'), false); }
    btn.disabled = false;
  });
  f.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') { el.setAttribute('aria-invalid', 'false'); const er = $('#' + el.id + '-e'); if (er !== NULL) er.textContent = ''; } }));
}
const ctForm = $('#ctForm');
function fieldErr(id, msg) { const f = $('#' + id), e = $('#' + id + '-e'); f.setAttribute('aria-invalid', msg ? 'true' : 'false'); e.textContent = msg || ''; return !msg; }
if (has('#ctForm')) ctForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#ctName').value.trim(), mail = $('#ctEmail').value.trim(), msg = $('#ctMsg').value.trim();
  const ok = [fieldErr('ctName', name ? '' : t('ct.eName')), fieldErr('ctEmail', validEmail(mail) ? '' : t('ct.eEmail')), fieldErr('ctMsg', msg ? '' : t('ct.eMsg'))];
  if (ok.includes(false)) { ctForm.querySelector('[aria-invalid="true"]').focus(); return; }
  const type = $('#ctType').selectedOptions[0].textContent;
  if (API) {   // backend: stored in the dashboard inbox, you get an email, the sender gets an automatic reply
    const btn = ctForm.querySelector('button[type="submit"]'); btn.disabled = true;
    try {
      const r = await fetch(API + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email: mail, type: $('#ctType').value, message: msg, lang }) });
      if (!r.ok) throw new Error(r.status);
      say($('#ctOk'), t('ct.sent'), true); ctForm.reset(); track('contact');
    } catch { say($('#ctOk'), t('nl.err'), false); }
    btn.disabled = false; return;
  }
  say($('#ctOk'), t('ct.ok'), true);
  location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(`[${type}] ${name}`)}&body=${encodeURIComponent(msg + `\n\n- ${name} (${mail})`)}`;
});
$$('#ctForm input, #ctForm textarea').forEach(el => el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') { el.setAttribute('aria-invalid', 'false'); $('#' + el.id + '-e').textContent = ''; } }));


