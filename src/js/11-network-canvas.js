/* =====================================================================
   Particle network
   ===================================================================== */
const nets = [];
function createNet(canvas, opts) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, pts = [], raf = 0, visible = true, rgb = opts.rgb();
  const mouse = { x: -9999, y: -9999 };
  const parent = canvas.parentElement;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(24, Math.min(opts.max, Math.round(w * h / opts.density)));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.4 + .8 }));
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const link = opts.link;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) { ctx.strokeStyle = `rgba(${rgb},${(1 - d / link) * opts.lineAlpha})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < 150) { ctx.strokeStyle = `rgba(${rgb},${(1 - md / 150) * .55})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      ctx.fillStyle = `rgba(${rgb},${opts.dotAlpha})`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
    }
  }
  function tick() {
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 110 && d > 0) { p.x += dx / d * .6; p.y += dy / d * .6; } // gentle repel
    }
    draw();
    raf = visible && !reduceMotion.matches && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  const start = () => { if (!raf && visible && !reduceMotion.matches && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(parent);
  document.addEventListener('visibilitychange', start);
  parent.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  parent.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 120); }).observe(canvas);
  reduceMotion.addEventListener?.('change', () => { reduceMotion.matches ? draw() : start(); });
  resize(); start();
  const api = { recolor() { rgb = opts.rgb(); draw(); } };
  nets.push(api); return api;
}
const cssRGB = () => getComputedStyle(root).getPropertyValue('--particle').trim() || '76,154,255';
if (has('#net')) createNet($('#net'), { rgb: cssRGB, density: 9000, max: innerWidth < 700 ? 42 : 110, link: 130, lineAlpha: .32, dotAlpha: .75 });
if (has('#nlNet')) createNet($('#nlNet'), { rgb: () => '255,255,255', density: 11000, max: 60, link: 110, lineAlpha: .28, dotAlpha: .6 });

