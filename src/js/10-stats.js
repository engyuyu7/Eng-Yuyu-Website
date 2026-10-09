/* =====================================================================
   Live stats
   ===================================================================== */
const stats = { ...CONFIG.sample };
let statsSource = 'sample', lastUpdate = null;
const shown = {}; // currently displayed (animated) values
const sum = s => s.youtube + s.facebook + s.tiktok + s.instagram;

function targetFor(key) { return key === 'followers' ? sum(stats) : stats[key]; }
function label(key, v) { return key === 'followers' ? fmtNum(v) + '+' : key === 'views' ? fmtNum(v) + '+' : fmtNum(v); }
function paintStats() {
  $$('[data-count]').forEach(el => { const k = el.dataset.count; el.textContent = label(k, shown[k] ?? targetFor(k)); });
  const u = $('#updated');
  u.removeAttribute('data-i18n');
  u.textContent = statsSource === 'live' && lastUpdate
    ? `${t('aud.updated')} ${lastUpdate.toLocaleTimeString(lang === 'so' ? 'so' : 'en', { hour: '2-digit', minute: '2-digit' })}`
    : t('aud.sample');
}
function animateTo(key, to, dur = 1400) {
  const els = $$(`[data-count="${key}"]`); if (!els.length) return;
  const from = shown[key] ?? 0;
  if (reduceMotion.matches || from === to) { shown[key] = to; els.forEach(e => e.textContent = label(key, to)); return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
    shown[key] = from + (to - from) * e;
    els.forEach(el => el.textContent = label(key, shown[key]));
    if (p < 1) requestAnimationFrame(step); else shown[key] = to;
  };
  requestAnimationFrame(step);
}
function refreshAll(animate) {
  ['followers', 'views', 'youtube', 'facebook', 'tiktok', 'instagram'].forEach(k => animate ? animateTo(k, targetFor(k)) : (shown[k] = targetFor(k)));
  paintStats();
}
async function pollStats() {
  if (!CONFIG.statsEndpoint) return;
  try {
    const r = await fetch(CONFIG.statsEndpoint, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    ['youtube', 'facebook', 'tiktok', 'instagram', 'views'].forEach(k => { if (Number.isFinite(d[k])) stats[k] = d[k]; });
    statsSource = 'live'; lastUpdate = new Date();
    refreshAll(true);
  } catch { /* keep last known values */ }
}
// count up the first time the audience strip / hero is on screen
let statsStarted = false;
function startStats() { if (statsStarted) return; statsStarted = true; refreshAll(true); pollStats(); setInterval(pollStats, CONFIG.pollMs); }

