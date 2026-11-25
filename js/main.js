import { initPrototype } from './prototype.js';
import { initSecurity } from './security.js';

window.__ns = true;
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const gsap = window.gsap;
const ST = window.ScrollTrigger;
const motion = !reduce && !!gsap && !!ST;
if (!motion) root.classList.add('no-motion');
if (motion) gsap.registerPlugin(ST);

/* ---------------- film grain ---------------- */
(function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const x = c.getContext('2d');
  const d = x.createImageData(220, 220);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ---------------- inner scroll areas ---------------- */
document.querySelectorAll('.backstage__body, .code__body, #app, .lane__track').forEach((el) => el.setAttribute('data-lenis-prevent', ''));

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (motion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ST.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -20, duration: 1.6 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------------- split lines ---------------- */
document.querySelectorAll('.split .line').forEach((l) => {
  l.innerHTML = `<span>${l.innerHTML}</span>`;
});

/* ---------------- intro ---------------- */
function intro() {
  return new Promise((resolve) => {
    if (reduce) return resolve();
    const num = document.querySelector('.leader__num');
    let n = 3;
    const t = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(t);
        resolve();
      } else num.textContent = n;
    }, 600);
  });
}

const heroVideo = document.querySelector('.hero__video');
const videoReady = new Promise((r) => {
  if (heroVideo.readyState >= 3) r();
  heroVideo.addEventListener('canplay', r, { once: true });
  setTimeout(r, 2600);
});

Promise.all([intro(), videoReady]).then(() => {
  document.body.classList.remove('is-loading');
  lenis?.start();
  heroVideo.play?.().catch(() => {});
  if (!motion) return;
  const tl = gsap.timeline({ delay: 0.35 });
  tl.from('.hero__video', { scale: 1.35, duration: 2.6, ease: 'expo.out' }, 0)
    .from('.hero .display .line > span', { yPercent: 110, duration: 1.4, stagger: 0.12, ease: 'expo.out' }, 0.2)
    .to('.hero .reveal', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.6)
    .from('.eyebrow', { opacity: 0, x: -30, duration: 1, ease: 'expo.out' }, 0.4)
    .from('.hero__stage .tilt', { opacity: 0, y: 120, rotateX: 25, rotateY: -25, duration: 2, ease: 'expo.out' }, 0.3)
    .from('.float', { opacity: 0, scale: 0.6, duration: 1.2, stagger: 0.15, ease: 'back.out(1.6)' }, 1)
    .from('.hero__foot .stats > div', { opacity: 0, y: 30, duration: 1, stagger: 0.08, ease: 'expo.out' }, 0.9)
    .from('.nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out' }, 0.5);
});

/* ---------------- scroll animations ---------------- */
if (motion) {
  // section headlines
  document.querySelectorAll('.chapter .split, .end__title').forEach((h) => {
    gsap.from(h.querySelectorAll('.line > span'), {
      yPercent: 110, duration: 1.3, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 85%' },
    });
  });
  // reveals
  gsap.utils.toArray('.reveal').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  // image wipes + camera push
  gsap.utils.toArray('.wipe').forEach((el) => {
    const media = el.querySelector('img, video');
    gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%' } })
      .to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1.5, ease: 'expo.inOut' })
      .from(media, { scale: 1.5, duration: 2, ease: 'expo.out' }, 0.2);
  });
  // mosaic parallax
  gsap.utils.toArray('[data-speed]').forEach((el) => {
    const s = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { y: () => s * 500 }, { y: () => -s * 500, ease: 'none', scrollTrigger: { trigger: '.mosaic', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  });
  // hero scroll out
  gsap.to('.hero__video', { yPercent: 18, scale: 1.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__inner', { yPercent: -12, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true } });
  // slates: letterbox flash
  gsap.utils.toArray('.chapter > .slate').forEach((s) => {
    gsap.from(s, { clipPath: 'inset(0 100% 0 0)', duration: 1.1, ease: 'expo.inOut', scrollTrigger: { trigger: s, start: 'top 90%' } });
  });
  // big background media drift
  ['.updates__media video', '.end__media img', '.security__bg img'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, { yPercent: -8, scale: 1.15 }, { yPercent: 8, scale: 1.15, ease: 'none', scrollTrigger: { trigger: el.parentElement.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // checks / frames stagger
  gsap.from('.checks li', { opacity: 0, y: 30, stagger: 0.08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.checks', start: 'top 90%' } });
}

/* ---------------- marquee ---------------- */
(function marquee() {
  const track = document.querySelector('.marquee__track');
  track.innerHTML += track.innerHTML;
  if (!motion) return;
  const tw = gsap.to(track, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });
  let boost = 1;
  ST.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => {
      boost = 1 + Math.min(Math.abs(self.getVelocity()) / 400, 6);
      tw.timeScale(boost * (self.direction < 0 ? -1 : 1));
    },
  });
  gsap.ticker.add(() => {
    const ts = tw.timeScale();
    const sign = ts < 0 ? -1 : 1;
    const next = Math.abs(ts) + (1 - Math.abs(ts)) * 0.05;
    tw.timeScale(next * sign);
  });
})();

/* ---------------- hero tilt ---------------- */
(function tilt() {
  const el = document.getElementById('heroTilt');
  if (!el || reduce) return;
  const cur = { x: 0, y: 0 };
  const tgt = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    tgt.x = (e.clientX / innerWidth - 0.5) * 2;
    tgt.y = (e.clientY / innerHeight - 0.5) * 2;
  });
  let t = 0;
  (function loop() {
    t += 0.012;
    cur.x += (tgt.x - cur.x) * 0.06;
    cur.y += (tgt.y - cur.y) * 0.06;
    const ry = -14 + cur.x * 16 + Math.sin(t) * 3;
    const rx = 6 - cur.y * 10 + Math.cos(t * 0.8) * 2;
    el.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg) translateY(${Math.sin(t * 1.3) * 10}px)`;
    requestAnimationFrame(loop);
  })();
})();

/* ---------------- nav + timecode ---------------- */
(function navTc() {
  const nav = document.querySelector('.nav');
  const tc = document.getElementById('timecode');
  const REEL = 4 * 60 + 12; // seconds of "film"
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    const max = document.documentElement.scrollHeight - innerHeight;
    const secs = (y / Math.max(1, max)) * REEL;
    const frames = Math.floor((secs % 1) * 24);
    tc.textContent = `00:${pad(secs / 60)}:${pad(secs % 60)}:${pad(frames)}`;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const links = [...document.querySelectorAll('.nav__links a')];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((l) => {
    const s = document.querySelector(l.getAttribute('href'));
    if (s) io.observe(s);
  });
})();

/* ---------------- cursor + magnetic ---------------- */
if (finePointer && !reduce) {
  const cur = document.querySelector('.cursor');
  const dot = cur.querySelector('.cursor__dot');
  const ring = cur.querySelector('.cursor__ring');
  const label = cur.querySelector('.cursor__label');
  const p = { x: innerWidth / 2, y: innerHeight / 2 };
  const r = { ...p };
  window.addEventListener('pointermove', (e) => {
    cur.classList.add('is-on');
    p.x = e.clientX;
    p.y = e.clientY;
    dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });
  (function loop() {
    r.x += (p.x - r.x) * 0.16;
    r.y += (p.y - r.y) * 0.16;
    ring.style.transform = `translate(${r.x}px, ${r.y}px)`;
    requestAnimationFrame(loop);
  })();
  const LABELS = [['.money__stage', 'Drag'], ['.phone--app', 'Tap'], ['.m', 'View']];
  document.addEventListener('pointerover', (e) => {
    const lab = LABELS.find(([s]) => e.target.closest(s));
    const hov = e.target.closest('a, button, input, select, [data-magnetic]');
    cur.classList.toggle('is-label', !!lab && !hov);
    cur.classList.toggle('is-hover', !!hov && !e.target.closest('.phone--app, .backstage, .tester, .code'));
    label.textContent = lab ? lab[1] : '';
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-hover', 'is-label'));

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const x = e.clientX - b.left - b.width / 2;
      const y = e.clientY - b.top - b.height / 2;
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .6s cubic-bezier(.2,.7,.1,1)';
      el.style.transform = '';
      setTimeout(() => (el.style.transition = ''), 600);
    });
  });
}

/* ---------------- EAS update lanes ---------------- */
(function lanes() {
  const msg = document.getElementById('otaMsg');
  const tracks = {};
  document.querySelectorAll('.lane').forEach((l) => (tracks[l.dataset.lane] = l.querySelector('.lane__track')));
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, '0')).join('');
  const fpName = () => `${hex()}...${hex().slice(0, 3)}`;

  let codeFp = '7c1e...a90';
  let buildNo = 12;
  let updNo = 0;
  const lanes = {
    development: [{ kind: 'build', label: 'dev client', fp: codeFp }],
    preview: [{ kind: 'build', label: `1.0.0 (${buildNo})`, fp: codeFp }],
    production: [{ kind: 'build', label: `1.0.0 (${buildNo})`, fp: codeFp }],
  };

  function say(text, tone = '') {
    msg.className = 'ota__msg ' + tone;
    msg.innerHTML = text;
  }

  function render() {
    for (const [name, items] of Object.entries(lanes)) {
      const lastBuildIdx = items.map((i) => i.kind).lastIndexOf('build');
      const build = items[lastBuildIdx];
      // live = newest update after the build with a matching runtime, not rolled back
      let liveIdx = -1;
      for (let i = items.length - 1; i > lastBuildIdx; i--) {
        if (items[i].kind === 'update' && items[i].fp === build.fp && !items[i].rolled) { liveIdx = i; break; }
      }
      if (liveIdx < 0) liveIdx = lastBuildIdx;
      tracks[name].innerHTML = items.map((it, i) => {
        let cls = `chip chip--${it.kind}`;
        if (i === liveIdx) cls += ' chip--live';
        else if (it.kind === 'update' && i > lastBuildIdx && it.fp !== build.fp) cls += ' chip--blocked';
        else cls += ' chip--old';
        const meta = it.kind === 'build' ? `runtime ${it.fp}` : `${it.note} &middot; runtime ${it.fp}${it.rolled ? ' &middot; rolled back' : ''}`;
        return `<div class="${cls}" style="${it.fresh ? '' : 'animation:none'}"><b>${it.label}</b><span>${meta}</span></div>`;
      }).join('');
      items.forEach((it) => (it.fresh = false));
      tracks[name].scrollLeft = tracks[name].scrollWidth;
    }
  }

  const NOTES = ['fix: checkout copy', 'fix: empty orders state', 'feat: seller badge', 'fix: deep link on return', 'perf: image cache'];
  const actions = {
    publish() {
      updNo++;
      const prevBuild = [...lanes.preview].reverse().find((i) => i.kind === 'build');
      const u = { kind: 'update', label: `update #${updNo}`, note: NOTES[(updNo - 1) % NOTES.length], fp: codeFp, fresh: true };
      lanes.preview.push(u);
      if (u.fp === prevBuild.fp) {
        say(`Published update #${updNo} to <b>preview</b>. Preview builds with runtime ${codeFp} load it on next launch. Test it there before production.`, 'good');
      } else {
        say(`Update #${updNo} has runtime ${codeFp}, but preview builds run ${prevBuild.fp}. They ignore it, which is exactly what protects them. Ship a new build first.`, 'bad');
      }
    },
    promote() {
      const prodBuild = [...lanes.production].reverse().find((i) => i.kind === 'build');
      const src = [...lanes.preview].reverse().find((i) => i.kind === 'update' && !i.rolled);
      if (!src) return say('Nothing to promote yet. Publish an update to preview first.', 'bad');
      if (lanes.production.some((i) => i.label === src.label && !i.rolled)) return say(`${src.label} is already in production.`);
      lanes.production.push({ ...src, fresh: true });
      if (src.fp === prodBuild.fp) say(`Republished ${src.label} to <b>production</b>. Same bundle that was tested on preview, no rebuild.`, 'good');
      else say(`${src.label} reached the production branch, but its runtime ${src.fp} does not match the store build ${prodBuild.fp}. Users are safe: their app keeps the current bundle.`, 'bad');
    },
    native() {
      const old = codeFp;
      codeFp = fpName();
      say(`Added a native module. Fingerprint changed ${old} &rarr; <b>${codeFp}</b>. From now on, JS updates need a new binary. Any update you publish now is blocked for old builds.`, 'bad');
    },
    build() {
      buildNo++;
      for (const name of ['preview', 'production']) {
        lanes[name].push({ kind: 'build', label: `1.0.${buildNo - 12} (${buildNo})`, fp: codeFp, fresh: true });
      }
      lanes.development.push({ kind: 'build', label: 'dev client', fp: codeFp, fresh: true });
      say(`eas build finished: 1.0.${buildNo - 12} (${buildNo}) with runtime ${codeFp}. In real life this goes through eas submit and store review before users get it.`, 'good');
    },
    rollback() {
      const items = lanes.production;
      const lastBuildIdx = items.map((i) => i.kind).lastIndexOf('build');
      const build = items[lastBuildIdx];
      for (let i = items.length - 1; i > lastBuildIdx; i--) {
        if (items[i].kind === 'update' && !items[i].rolled && items[i].fp === build.fp) {
          items[i].rolled = true;
          return say(`Rolled back ${items[i].label} on production. Devices go back to the previous update (or the embedded bundle) on next launch. No store review needed.`, 'good');
        }
      }
      say('Production is already running the bundle embedded in the store build. Nothing to roll back.');
    },
  };

  document.querySelectorAll('[data-ota]').forEach((b) => {
    b.addEventListener('click', () => {
      actions[b.dataset.ota]();
      render();
    });
  });
  render();
})();

/* ---------------- store checklist ---------------- */
(function stores() {
  const C = 2 * Math.PI * 52;
  function refresh(store) {
    const items = store.querySelectorAll('li');
    const done = store.querySelectorAll('li.done').length;
    store.querySelector('.score').textContent = `${done} / ${items.length}`;
    store.querySelector('.ring__val').style.strokeDashoffset = C * (1 - done / items.length);
  }
  document.querySelectorAll('.store').forEach((store) => {
    store.querySelector('.ring__val').style.strokeDasharray = C;
    store.querySelectorAll('li button').forEach((b) => {
      b.addEventListener('click', () => {
        b.parentElement.classList.toggle('done');
        refresh(store);
      });
    });
    refresh(store);
  });
  const run = document.getElementById('runChecks');
  run.addEventListener('click', () => {
    const all = [...document.querySelectorAll('.store li:not(.done)')];
    all.forEach((li, i) => {
      setTimeout(() => {
        li.classList.add('done');
        refresh(li.closest('.store'));
      }, 160 * i + 100);
    });
    run.querySelector('span').textContent = all.length ? 'Checking...' : 'All clear';
    setTimeout(() => (run.querySelector('span').textContent = 'All clear'), 160 * all.length + 300);
  });
})();

/* ---------------- 3D reel ---------------- */
(function reel() {
  const ring = document.getElementById('reelRing');
  if (!ring) return;
  const cells = [...ring.children];
  const n = cells.length;
  const step = 360 / n;
  const no = document.getElementById('reelNo');
  let radius = 0;
  function layout() {
    const w = cells[0].offsetWidth;
    radius = Math.round(w / 2 / Math.tan(Math.PI / n)) + 70;
    cells.forEach((c, i) => (c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`));
  }
  layout();
  window.addEventListener('resize', layout);
  const state = { rot: 0, drift: 0 };
  function apply() {
    const r = state.rot + state.drift;
    ring.style.transform = `translateZ(${-radius}px) rotateX(-6deg) rotateY(${r}deg)`;
    const idx = ((Math.round(-r / step) % n) + n) % n;
    no.textContent = String(idx + 1).padStart(2, '0');
  }
  if (motion) {
    ST.create({ trigger: '.reel', start: 'top top', end: 'bottom bottom', scrub: 1.2, onUpdate: (s) => { state.rot = -s.progress * 360; } });
    gsap.ticker.add((t, dt) => { state.drift -= dt * 0.004; apply(); });
    gsap.from('.reel__copy', { opacity: 0, y: 60, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.reel', start: 'top 40%' } });
  } else apply();
})();

/* ---------------- plan film strip ---------------- */
if (motion) {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 641px)', () => {
    const strip = document.getElementById('strip');
    const dist = () => Math.max(0, strip.scrollWidth - innerWidth);
    gsap.to(strip, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: { trigger: '.plan', pin: true, start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.utils.toArray('.frame').forEach((f, i) => {
      gsap.from(f, { opacity: 0, y: 60, rotate: i % 2 ? 1.5 : -1.5, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.plan', start: 'top 70%' }, delay: i * 0.06 });
    });
  });
}

/* ---------------- modules ---------------- */
initPrototype();
initSecurity();
// 3D scene loads lazily when the section gets near
const moneyEl = document.getElementById('money');
const lazy3d = new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) return;
  lazy3d.disconnect();
  import('./money3d.js').then((m) => m.initMoney()).catch((err) => {
    console.warn('3D scene unavailable', err);
    document.querySelector('.money__stage')?.classList.add('no-webgl');
  });
}, { rootMargin: '600px' });
lazy3d.observe(moneyEl);

window.addEventListener('load', () => ST?.refresh());
