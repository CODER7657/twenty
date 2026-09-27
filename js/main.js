/* ─────────────────────────────────────────────────────────────────────────
   Motion system
   Techniques (epic-design catalogue): count-up loader → clip wipe, masked
   line reveal, variable-font proximity wave, velocity marquee, word-by-word
   scroll lighting, pinned horizontal scrub with 3D card tilt, FLIP-style
   result stagger, magnetic controls, custom cursor. The WebGL core follows
   every section via Core.pose / Core.setStyle.
   v2 (after Codrops/Awwwards research): smoothed scroll velocity drives card
   skew, marquee shear, RGB split and ring spin; a scrubbed "dive" through the
   core into the index; ScrambleText swaps; glare tilt; kinetic matcher title;
   nearest-card focus; keyboard stepping; posters come alive when in focus.
   ───────────────────────────────────────────────────────────────────────── */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  let matchPick = null; // top style of the current matcher brief

  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);
  const GLYPHS = '▚▞▙▟▛▜░▒01/+';
  // Scramble a text swap (instant under reduced motion)
  const scramble = (el, text, duration = 0.6, chars = GLYPHS) => {
    if (reduce) { el.textContent = text; return; }
    gsap.to(el, { duration, scrambleText: { text, chars, speed: 0.9, revealDelay: 0.08 }, overwrite: true });
  };

  /* ── Smooth scroll ── */
  let lenis = null, velocity = 0;
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9 });
    if (location.hash === '#qa' || location.search.includes('qa')) window.__lenis = lenis; // test hook
    lenis.stop();
    let navHidden = false;
    const navLinks = document.querySelector('.nav-links');
    lenis.on('scroll', (e) => {
      velocity = e.velocity; ScrollTrigger.update(); Core.kick(e.velocity); Core.setVelocity(e.velocity);
      const hide = e.direction === 1 && e.scroll > 300;
      if (hide !== navHidden && Math.abs(e.velocity) > 0.6) {
        navHidden = hide;
        gsap.to(navLinks, { yPercent: hide ? -160 : 0, opacity: hide ? 0 : 1, duration: 0.55, ease: hide ? 'power3.in' : 'expo.out', overwrite: true });
      }
    });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else if (typeof target === 'number') scrollTo_(target);
    else (typeof target === 'string' ? $(target) : target).scrollIntoView();
  };
  const scrollTo_ = (y) => window.scrollTo(0, y);
  // Smoothed velocity for DOM effects (Lenis reports 0 once it settles, so this eases back)
  let vs = 0;
  gsap.ticker.add(() => { vs += ((lenis ? lenis.velocity : 0) - vs) * 0.12; if (Math.abs(vs) < 0.01) vs = 0; });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 && id !== '#') return;
    e.preventDefault();
    scrollTo(id === '#top' ? 0 : id);
  }));

  /* ── Accent colour follows the active style ── */
  const setAccent = (a, b) => { root.style.setProperty('--accent', a); root.style.setProperty('--accent-2', b); };

  /* ── Marquee: every name in its own face ── */
  const rows = $$('.mq-row');
  const order = [STYLES.map((_, i) => i), STYLES.map((_, i) => (i * 7 + 3) % 20)];
  rows.forEach((row, r) => {
    const track = $('.mq-track', row);
    const html = order[r].map((i) => `<span class="mq-item" data-i="${i}" style="font-family:${STYLES[i].font}"><sup>${pad(i + 1)}</sup>${STYLES[i].name}</span><span class="mq-sep" aria-hidden="true">✳</span>`).join('');
    track.innerHTML = html + html;
    track.children.length && [...track.children].slice(STYLES.length * 2).forEach((el) => el.setAttribute('aria-hidden', 'true'));
  });
  const mq = rows.map((row) => ({ el: $('.mq-track', row), dir: +row.dataset.dir, x: 0, w: 0, k: 1, slow: false }));
  rows.forEach((row, r) => {
    row.addEventListener('pointerenter', () => { mq[r].slow = true; });
    row.addEventListener('pointerleave', () => { mq[r].slow = false; });
    row.addEventListener('click', (e) => { const it = e.target.closest('.mq-item'); if (it) focusStyle(+it.dataset.i); });
  });
  const measureMq = () => mq.forEach((m) => { m.w = m.el.scrollWidth / 2; });
  measureMq(); addEventListener('resize', measureMq);
  document.fonts && document.fonts.ready.then(measureMq);
  if (!reduce) {
    gsap.ticker.add((_, dt) => {
      const boost = 1 + Math.min(Math.abs(velocity) * 0.12, 6);
      mq.forEach((m) => {
        const w = m.w;
        if (!w) return;
        m.k += ((m.slow ? 0.12 : 1) - m.k) * 0.07; // ease to a crawl under the pointer
        m.x += m.dir * (dt / 1000) * 48 * boost * m.k * (velocity < 0 ? -1 : 1);
        m.x = ((m.x % w) + w) % w;
        m.el.style.transform = `translate3d(${-m.x}px,0,0) skewX(${gsap.utils.clamp(-14, 14, -vs * 0.35).toFixed(2)}deg)`;
      });
    });
  }

  /* ── Index: info panel + card captions ── */
  const info = {
    count: $('.ii-count'), num: $('.ii-num'), name: $('.ii-name'), essence: $('.ii-essence'),
    moves: $('.ii-moves'), sw: $('.ii-swatches'), fonts: $('.ii-fonts'), bar: $('.ii-progress i'), all: $('.index-info')
  };
  const cards = $$('.card');
  // Static (mobile / reduced-motion) captions live inside each card
  cards.forEach((c, i) => {
    const st = STYLES[i];
    const d = document.createElement('div');
    d.className = 'card-info';
    d.innerHTML = `<p>${st.essence}</p><div class="ci-sw">${st.palette.map((h) => `<i style="background:${h}"></i>`).join('')}</div><p class="mono">${st.fonts}</p>`;
    c.appendChild(d);
    const g = document.createElement('span'); // moving highlight for the glare tilt
    g.className = 'glare'; g.setAttribute('aria-hidden', 'true');
    $('.poster', c).appendChild(g);
    const sw = document.createElement('span'); // sheen that crosses the poster when it takes focus
    sw.className = 'sweep'; sw.setAttribute('aria-hidden', 'true');
    $('.poster', c).appendChild(sw);
  });

  /* ── Index extras: odometer number, tick scrubber, giant outline name ── */
  const odoCols = $$('.odo-col');
  odoCols.forEach((c) => { c.innerHTML = '0123456789'.split('').map((d) => `<i>${d}</i>`).join(''); });
  const setOdo = (n, instant) => pad(n).split('').forEach((d, k) => gsap.to(odoCols[k], {
    yPercent: -d * 10, duration: instant || reduce ? 0 : 0.95, delay: instant ? 0 : k * 0.08, ease: 'expo.out', overwrite: true
  }));
  const ticksEl = $('.ii-ticks');
  ticksEl.innerHTML = STYLES.map((st, k) => `<button type="button" aria-label="${pad(k + 1)} ${st.name}"></button>`).join('');
  const ticks = [...ticksEl.children];
  ticks.forEach((t, k) => t.addEventListener('click', () => focusStyle(k)));
  const setTicks = (i) => ticks.forEach((t, k) => { t.classList.toggle('on', k === i); t.classList.toggle('near', Math.abs(k - i) === 1); });
  const bleed = $('.index-bleed'), bleedTxt = $('.index-bleed span');
  const swapBleed = (st) => {
    const put = () => { bleedTxt.textContent = st.name; bleedTxt.style.fontFamily = st.font; };
    if (reduce) return put();
    gsap.to(bleedTxt, { yPercent: -55, opacity: 0, duration: 0.24, ease: 'power2.in', overwrite: true, onComplete: () => {
      put(); gsap.fromTo(bleedTxt, { yPercent: 55, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
    } });
  };

  const nowText = $('.nav-now-text');
  let current = -1, prevCard = null;
  function fillInfo(i) {
    const st = STYLES[i];
    info.count.textContent = `${pad(i + 1)} / 20`;
    info.name.textContent = st.name;
    info.name.style.fontFamily = '';
    info.essence.textContent = st.essence;
    info.moves.innerHTML = st.moves.map((m) => `<li>${m}</li>`).join('');
    info.sw.innerHTML = st.palette.map((h) => `<span style="background:${h}" title="${h}"><em>${h}</em></span>`).join('');
    info.fonts.textContent = st.fonts;
  }
  function setActive(i, instant) {
    if (i === current) return;
    current = i;
    const st = STYLES[i];
    Core.setStyle(i); // GPU side reacts this frame
    setOdo(i + 1, instant);
    // DOM side on the next frame, touching only the two cards that change
    requestAnimationFrame(() => {
      if (current !== i) return;
      setAccent(st.glow[0], st.glow[1]);
      scramble(nowText, `${pad(i + 1)} ${st.name}`, 0.5);
      if (prevCard) { prevCard.classList.remove('is-active'); prevCard.querySelector('.poster').classList.remove('live'); }
      prevCard = cards[i]; prevCard.classList.add('is-active'); prevCard.querySelector('.poster').classList.add('live');
      setTicks(i); swapBleed(st);
    });
    if (instant || reduce) { fillInfo(i); return; }
    const parts = [info.name, info.essence, info.moves, $('.ii-row')];
    gsap.killTweensOf(parts);
    gsap.to(parts, {
      y: -14, opacity: 0, duration: 0.16, stagger: 0.02, ease: 'power2.in',
      onComplete: () => {
        fillInfo(i);
        scramble(info.name, st.name, 0.55);
        gsap.fromTo(parts, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.045, ease: 'expo.out' });
        gsap.from($$('span', info.sw), { scaleY: 0, transformOrigin: 'bottom', duration: 0.45, stagger: 0.04, ease: 'expo.out' });
      }
    });
  }
  fillInfo(0); setOdo(1, true); setTicks(0);

  const clearStyle = () => {
    if (current === -1) return;
    current = -1;
    Core.setStyle(null);
    setAccent(CORE_DEFAULT.glow[0], CORE_DEFAULT.glow[1]);
    scramble(nowText, 'Field guide · 20 styles', 0.5);
    if (prevCard) { prevCard.classList.remove('is-active'); prevCard.querySelector('.poster').classList.remove('live'); prevCard = null; }
  };

  /* ── Core choreography: where the sculpture sits in each section ── */
  const POSES = {
    hero: { x: 0.5, y: 0.04, s: 0.92, spin: 0 },
    manifesto: { x: -0.56, y: 0.04, s: 0.78, spin: 0.9 },
    index: { x: -0.66, y: 0.36, s: 0.5, spin: 1.8 },
    palettes: { x: 0.74, y: 0.66, s: 0.34, spin: 2.1 },
    type: { x: 0.27, y: 0.78, s: 0.22, spin: 2.4 },
    quiz: { x: 0.74, y: 0.02, s: 0.5, spin: 2.8 },
    pairs: { x: 0.76, y: 0.64, s: 0.32, spin: 3.1 },
    matcher: { x: 0.6, y: 0.1, s: 0.66, spin: 3.4 },
    colophon: { x: 0.02, y: -0.3, s: 0.95, spin: 4.2 }
  };
  const MOBILE_POSES = {
    hero: { x: 0.12, y: 0.44, s: 0.5, spin: 0 },
    manifesto: { x: 0.45, y: 0.74, s: 0.34, spin: 0.9 },
    index: { x: 0.7, y: 0.62, s: 0.36, spin: 1.8 },
    palettes: { x: 0.62, y: 0.72, s: 0.28, spin: 2.1 },
    type: { x: 0.62, y: 0.72, s: 0.28, spin: 2.4 },
    quiz: { x: 0.62, y: 0.72, s: 0.3, spin: 2.8 },
    pairs: { x: 0.62, y: 0.72, s: 0.28, spin: 3.1 },
    matcher: { x: 0.6, y: 0.6, s: 0.4, spin: 3.4 },
    colophon: { x: 0.5, y: 0.66, s: 0.3, spin: 4.2 }
  };
  const goPose = (name) => {
    const p = (innerWidth < 900 ? MOBILE_POSES : POSES)[name];
    gsap.to(Core.pose, { ...p, duration: reduce ? 0 : 1.6, ease: 'expo.inOut', overwrite: true });
  };
  Object.assign(Core.pose, (innerWidth < 900 ? MOBILE_POSES : POSES).hero);
  // Each section only marks where it starts; the pose belongs to the last section passed.
  // (Toggle ranges break around the pinned index; start markers don't.)
  function poseTriggers() {
    const marks = [['.hero', 'hero'], ['.manifesto', 'manifesto'], ['.index', 'index'], ['.palettes', 'palettes'], ['.type', 'type'],
      ['.quiz', 'quiz'], ['.pairs', 'pairs'], ['.matcher', 'matcher'], ['.colophon', 'colophon']]
      .map(([sel, name], k) => ({ name, st: ScrollTrigger.create({ trigger: sel, start: k === 0 ? 'top top' : 'top 55%' }) }));
    let now = null;
    const pick = (y) => {
      let name = marks[0].name;
      marks.forEach((m) => { if (y >= m.st.start) name = m.name; });
      if (name === now) return;
      now = name;
      goPose(name);
      if (name !== 'index' && name !== 'matcher') clearStyle();
      if (window.Twenty && Twenty.onSection) Twenty.onSection(name);
      if (name === 'matcher' && matchPick != null) setActive(matchPick, true);
    };
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => pick(self.scroll()), onRefresh: (self) => pick(self.scroll()) });
  }

  /* ── Hero title: masked line reveal + variable-width proximity wave ── */
  let heroChars = [];
  function buildHero() {
    const split = new SplitText('.ht-line', { type: 'lines,chars', mask: 'lines', linesClass: 'ht-l', charsClass: 'ht-c' });
    heroChars = split.chars;
    return split;
  }
  function heroWave() {
    if (!fine || reduce || !heroChars.length) return;
    const title = $('.hero-title');
    let mx = -9999, my = -9999, on = false;
    const rects = () => heroChars.map((c) => { const r = c.getBoundingClientRect(); return { c, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    let cache = [];
    title.addEventListener('pointerenter', () => { on = true; cache = rects(); });
    title.addEventListener('pointerleave', () => { on = false; });
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    addEventListener('scroll', () => { if (on) cache = rects(); }, { passive: true });
    const w = heroChars.map(() => ({ v: 92 }));
    gsap.ticker.add(() => {
      if (!cache.length) return;
      let moving = false;
      cache.forEach((o, k) => {
        const d = on ? Math.hypot(o.x - mx, (o.y - my) * 1.4) : 9999;
        const want = 92 + 58 * Math.exp(-(d * d) / 16000);
        const dv = (want - w[k].v) * 0.14;
        if (Math.abs(dv) < 0.02) return;
        moving = true;
        w[k].v += dv;
        o.c.style.setProperty('--wd', w[k].v.toFixed(1));
      });
      if (!moving && !on) cache = []; // settled: stop touching the DOM until the next hover
    });
  }

  /* ── Hero morph: "picture" is re-set in a different style every few seconds ── */
  const LOOKS = [
    { i: -1, cls: 'lk-min', label: 'Newsreader Italic' },
    { i: 7, cls: 'lk-pop' }, { i: 12, cls: 'lk-y2k' }, { i: 11, cls: 'lk-edit' }, { i: 10, cls: 'lk-pix' },
    { i: 17, cls: 'lk-graf' }, { i: 6, cls: 'lk-cyber' }, { i: 19, cls: 'lk-hand' }, { i: 16, cls: 'lk-vict' },
    { i: 13, cls: 'lk-swiss' }, { i: 5, cls: 'lk-retro' }, { i: 9, cls: 'lk-clay' }, { i: 18, cls: 'lk-aur' }, { i: 2, cls: 'lk-fut' }
  ];
  const morph = $('.morph'), setName = $('.hero-set b'), setLine = $('.hero-set');
  let lookIdx = 0, heroLive = true, tail = null;
  const makeWord = (cls) => {
    const w = document.createElement('span');
    w.className = 'mword ' + cls;
    w.innerHTML = [...'picture'].map((ch) => `<span class="mc">${ch}</span>`).join('');
    return w;
  };
  // All 14 words are built ONCE, stacked in the same grid cell, each letter on its own
  // permanent compositor layer. A change then creates nothing, measures nothing (widths are
  // cached) and re-lays out nothing but one width: it only animates transform and opacity.
  let words = [], widths = [];
  const HIDDEN = 0.001; // not 0: fully transparent layers can be dropped and re-drawn later
  function initMorph() {
    words = LOOKS.map((l) => makeWord(l.cls));
    words.forEach((w, k) => { w.setAttribute('aria-hidden', 'true'); if (k) gsap.set(w.children, { opacity: HIDDEN }); });
    morph.replaceChildren(...words);
    widths = words.map((w) => w.offsetWidth);          // one layout, at start
    gsap.set(morph, { width: widths[0] });
    // the headline scales with the window, so cached widths are re-measured on resize/rotation
    let rz;
    addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        gsap.set(morph, { width: 'auto' });
        widths = words.map((w) => w.offsetWidth);
        gsap.set(morph, { width: widths[lookIdx] });
        gsap.set(tail, { x: 0 });
      }, 120);
    });
    // Gather the rest of the line (" speak.") into one wrapper, so it can glide by transform
    tail = document.createElement('span');
    tail.className = 'morph-tail';
    morph.after(tail);
    while (tail.nextSibling) tail.appendChild(tail.nextSibling);
    // a leading space inside an inline-block collapses, so the word gap becomes a margin instead
    if (tail.firstChild && tail.firstChild.nodeType === 3 && !tail.firstChild.textContent.trim()) tail.firstChild.remove();
    morph.setAttribute('aria-label', 'picture');
    if (reduce) return;
    setInterval(nextLook, 2600);
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom 25%',
      onToggle: (self) => { heroLive = self.isActive; if (!heroLive && current === -1) Core.setStyle(null, true); }
    });
  }
  function nextLook() {
    if (!heroLive || document.hidden) return;
    const prev = lookIdx;
    lookIdx = (lookIdx + 1) % LOOKS.length;
    const look = LOOKS[lookIdx], st = look.i >= 0 ? STYLES[look.i] : null;
    const old = words[prev], neu = words[lookIdx], w0 = widths[prev], w1 = widths[lookIdx];
    // FLIP: the box takes its new width in ONE layout step; the rest of the line is pushed back
    // to where it was with a transform and glides home (compositor only, no reflow)
    gsap.set(morph, { width: w1 });
    gsap.fromTo(tail, { x: w0 - w1 }, { x: 0, duration: 0.85, ease: 'expo.inOut', overwrite: true });
    gsap.to(old.children, { yPercent: -70, rotateX: 95, opacity: HIDDEN, duration: 0.42, stagger: 0.028, ease: 'power3.in', overwrite: true });
    gsap.fromTo(neu.children, { yPercent: 70, rotateX: -95, opacity: HIDDEN }, { yPercent: 0, rotateX: 0, opacity: 1, duration: 0.85, stagger: 0.034, ease: 'expo.out', delay: 0.16, overwrite: true });
    scramble(setName, st ? st.name : look.label, 0.6);
    setLine.style.setProperty('--dot', st ? st.glow[0] : CORE_DEFAULT.glow[0]);
    if (current === -1) Core.setStyle(st ? look.i : null, true); // the core quietly follows the word
  }

  /* ── Loader → intro ── */
  function runLoader() {
    const num = $('.loader-num'), name = $('.loader-name'), bar = $('.loader-bar i');
    const state = { n: 0 };
    const minTime = new Promise((r) => setTimeout(r, reduce ? 200 : 1600));
    // Wait for the scene and the site's own faces only (poster faces stream in behind), max 3s.
    const siteFonts = document.fonts ? Promise.all(["800 1em Anybody", "400 1em Geist", "italic 300 1em Newsreader", "400 1em 'Geist Mono'"].map((f) => document.fonts.load(f))) : null;
    const assets = Promise.race([Promise.all([Core.ready, siteFonts]), new Promise((r) => setTimeout(r, 2600))]);
    const counter = gsap.to(state, {
      n: 20, duration: reduce ? 0.2 : 1.6, ease: 'power2.inOut',
      onUpdate: () => {
        const n = Math.max(1, Math.round(state.n));
        num.textContent = pad(Math.round(state.n));
        name.textContent = STYLES[n - 1].name;
        name.style.fontFamily = STYLES[n - 1].font;
        bar.style.transform = `scaleX(${state.n / 20})`;
      }
    });
    return Promise.all([minTime, assets, counter.then()]);
  }

  function intro() {
    document.body.classList.remove('is-loading');
    const split = buildHero();
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: reduce ? 0 : 1.1, ease: 'expo.inOut' })
      .from('#core', { opacity: 0, scale: 1.08, duration: 1.6 }, '<0.35')
      .from(split.chars, { yPercent: 115, duration: 1.2, stagger: 0.018, '--wd': 50 }, '<0.1')
      .from('.hero-meta span, .hero-lede, .hero-cue, .hero-side, .nav > *', { y: 20, opacity: 0, duration: 1, stagger: 0.06 }, '<0.4')
      .add(() => { $$('.hero-meta span').forEach((el, k) => gsap.delayedCall(k * 0.12, () => scramble(el, el.textContent, 0.9))); }, '<')
      .from('.hero-set', { y: 16, opacity: 0, duration: 0.9 }, '<0.2')
      .add(() => { $('.loader').remove(); lenis && lenis.start(); heroWave(); gsap.set('.hero-title [class*="-mask"]', { overflow: 'visible' }); initMorph(); });
    return tl;
  }

  /* ── Scroll scenes ── */
  function scenes() {
    // hero parallax out: lines drift at different depths
    if (!reduce) {
      // scroll-out: the headline's letters scatter in 3D (the morph word travels as one piece)
      const rnd = gsap.utils.random;
      const heroBits = $$('.ht-c').filter((c) => !c.closest('.morph')).concat([$('.morph')]);
      gsap.to(heroBits, {
        x: () => rnd(-280, 280), y: () => rnd(-380, -80), rotation: () => rnd(-55, 55), rotationX: () => rnd(-75, 75),
        opacity: 0.12, ease: 'none', stagger: 0,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
      gsap.to('.hero-foot, .hero-meta', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });
    }

    // manifesto: word-by-word lighting
    const ms = new SplitText('.manifesto-text', { type: 'words', wordsClass: 'mw' });
    if (!reduce) $$('.manifesto .hl').forEach((h) => gsap.fromTo(h, { '--hl': 0 }, {
      '--hl': 1, ease: 'none', scrollTrigger: { trigger: h, start: 'top 74%', end: 'top 50%', scrub: 0.5 }
    }));
    else $$('.manifesto .hl').forEach((h) => h.style.setProperty('--hl', 1));
    gsap.fromTo(ms.words, { opacity: 0.3 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 60%', scrub: true }
    });

    // generic reveals
    // dive: as the index rises, the camera plunges through the core and out the other side
    if (!reduce) {
      const flash = $('.dive-flash');
      ScrollTrigger.create({
        trigger: '.index', start: 'top 100%', end: 'top top', scrub: 0.8,
        onUpdate: (self) => {
          const d = Math.sin(self.progress * Math.PI);
          Core.dive = d * d;
          flash.style.opacity = (d * d * 0.5).toFixed(3);
          flash.style.visibility = d > 0.01 ? 'visible' : 'hidden';
        },
        onLeave: () => { Core.dive = 0; flash.style.opacity = 0; },
        onLeaveBack: () => { Core.dive = 0; flash.style.opacity = 0; }
      });
      // kinetic section titles: letters arrive stretched and scattered, then snap to width
      $$('.sec-title').forEach((title) => {
        const mt = new SplitText(title, { type: 'chars', charsClass: 'mt-c' });
        // width stretch only where the title can't wrap (desktop); phones get the motion without it
        const stretch = innerWidth >= 900;
        gsap.fromTo(mt.chars, { '--wd': stretch ? 150 : 78, yPercent: (k) => [60, -40, 30, -70][k % 4], rotate: (k) => [-8, 6, -4, 9][k % 4] }, {
          '--wd': 78, yPercent: 0, rotate: 0, ease: 'none', stagger: 0.04,
          scrollTrigger: { trigger: title, start: 'top 98%', end: 'top 55%', scrub: 0.6 }
        });
      });
    }
    // section labels draw an accent rule as the section arrives
    $$('.sec-head, .matcher-head').forEach((h) => ScrollTrigger.create({ trigger: h, start: 'top 85%', once: true, onEnter: () => h.classList.add('in') }));
    // progress rail
    const rail = $('.rail i');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { rail.style.transform = `scaleY(${self.progress.toFixed(4)})`; } });

    $$('.matcher-head > :not(.sec-title), .sec-head > :not(.sec-title), .sec-head--row > div > .mono, .col-grid > div').forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    // colophon wordmark: chars rise, then width follows the pointer
    const cw = new SplitText('.col-word', { type: 'chars', charsClass: 'cw' });
    let waveOn = false, hoverWord = false, footVis = false, amp = 0;
    gsap.from(cw.chars, { yPercent: 100, '--wd': 50, duration: 1.3, stagger: 0.05, ease: 'expo.out', onComplete: () => { waveOn = true; }, scrollTrigger: { trigger: '.col-word', start: 'top bottom', once: true } });
    ScrollTrigger.create({ trigger: '.col-grid', start: 'top 88%', once: true, onEnter: () => $('.col-grid').classList.add('in') });
    if (!reduce) {
      ScrollTrigger.create({ trigger: '.colophon', start: 'top bottom', end: 'bottom top', onToggle: (self) => { footVis = self.isActive; } });
      gsap.ticker.add((t) => {
        if (!footVis || !waveOn) return;
        amp += ((hoverWord ? 0 : 26) - amp) * 0.05;
        if (hoverWord && amp < 0.5) return;
        cw.chars.forEach((c, k) => c.style.setProperty('--wd', (100 + amp * Math.sin(t * 1.25 - k * 0.75)).toFixed(1)));
      });
    }
    if (fine && !reduce) {
      const word = $('.col-word');
      word.addEventListener('pointerenter', () => { hoverWord = true; });
      word.addEventListener('pointermove', (e) => {
        const r = word.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
        cw.chars.forEach((c, k) => {
          const cx = (k + 0.5) / cw.chars.length, d = Math.abs(cx - x);
          gsap.to(c, { '--wd': 60 + 90 * Math.exp(-(d * d) / 0.02), duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
        });
      });
      word.addEventListener('pointerleave', () => { hoverWord = false; });
    }

    // index: pinned horizontal gallery on desktop, stacked on mobile / reduced motion
    const mm = gsap.matchMedia();
    mm.add({ wide: '(min-width: 900px)', narrow: '(max-width: 899px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      const { wide, reduce: rm } = ctx.conditions;
      if (wide && !rm) {
        root.classList.remove('index-static');
        const track = $('.track'), view = $('.track-view');
        const dist = () => Math.max(0, track.scrollWidth - view.clientWidth);
        // The focus point slides from the view's left edge to its right edge over the pin;
        // the active style is whichever card centre is nearest to it.
        let lastP = 0, inIndex = false;
        // Card centres come from cached offsets + the track's current x, so the loop
        // never touches layout; transforms are written through quickSetters.
        let geo = null;
        const measure = () => { geo = { vw: view.clientWidth, cw: cards[0].offsetWidth, offs: cards.map((c) => c.offsetLeft) }; };
        const setters = cards.map((c) => ({
          ry: gsap.quickSetter(c, 'rotateY', 'deg'), z: gsap.quickSetter(c, 'z', 'px'),
          sk: gsap.quickSetter(c, 'skewX', 'deg'), op: gsap.quickSetter(c, 'opacity')
        }));
        gsap.set(cards, { transformPerspective: 1100 });
        const bleedX = gsap.quickSetter(bleed, 'x', 'px');
        const tilt = (p) => {
          if (!geo) measure();
          const { vw, cw, offs } = geo, tx = gsap.getProperty(track, 'x');
          bleedX(40 - p * 260); // the outline name drifts far slower than the cards: depth
          const focus = cw / 2 + p * (vw - cw);
          const skew = gsap.utils.clamp(-9, 9, -vs * 0.22);
          let best = 0, bestD = Infinity;
          for (let k = 0; k < cards.length; k++) {
            const d = (offs[k] + cw / 2 + tx - focus) / vw, ad = Math.abs(d);
            if (ad < bestD) { bestD = ad; best = k; }
            const f = setters[k];
            f.ry(gsap.utils.clamp(-26, 26, d * -34)); f.z(-Math.min(ad, 0.8) * 240); f.sk(skew); f.op(1 - Math.min(ad, 0.9) * 0.55);
          }
          return best;
        };
        indexGeo = { track, view, dist };
        const idle = () => { if (inIndex && vs !== 0) setActive(tilt(lastP)); };
        gsap.ticker.add(idle);
        const tw = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: {
            id: 'index', trigger: '.index', pin: true, start: 'top top', refreshPriority: 1,
            end: () => '+=' + Math.round(dist() * 1.15 + innerHeight * 0.4),
            scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
            // when scrolling stops, ease the nearest card exactly into the focus point
            snap: {
              snapTo: (v) => {
                if (!geo) measure();
                const denom = dist() + geo.vw - geo.cw;
                let best = v, bd = Infinity;
                for (const o of geo.offs) { const q = Math.min(1, Math.max(0, o / denom)); const d = Math.abs(q - v); if (d < bd) { bd = d; best = q; } }
                return best;
              },
              duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: 'power3.inOut'
            },
            onUpdate: (self) => {
              lastP = self.progress;
              info.bar.style.transform = `scaleX(${self.progress})`;
              setActive(tilt(self.progress));
            },
            onToggle: (self) => { inIndex = self.isActive; if (self.isActive) setActive(tilt(self.progress)); },
            onRefresh: (self) => { measure(); lastP = self.progress; tilt(self.progress); }
          }
        });
        gsap.from(cards, { xPercent: 60, opacity: 0, duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.index', start: 'top 70%' } });
        gsap.from('.index-info > *', { y: 30, opacity: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '.index', start: 'top 60%' } });
        ScrollTrigger.sort();
        return () => { gsap.ticker.remove(idle); indexGeo = null; gsap.set(cards, { clearProps: 'all' }); tw.scrollTrigger && tw.scrollTrigger.kill(); };
      }
      // Static: every card carries its own caption; the core follows whichever card is centred
      root.classList.add('index-static');
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) setActive(+en.target.dataset.i, true); }), { rootMargin: '-45% 0px -45% 0px' });
      cards.forEach((c) => io.observe(c));
      return () => io.disconnect();
    });

    // clicking a card lands it in focus
    cards.forEach((c, i) => c.addEventListener('click', () => focusStyle(i)));
    poseTriggers();
  }

  // Exact progress that puts card i under the focus point:
  // centre(i) - p*dist = cw/2 + p*(viewW - cw)  =>  p = offsetLeft(i) / (dist + viewW - cw)
  let indexGeo = null;
  function focusStyle(i) {
    const st = ScrollTrigger.getById('index');
    if (st && indexGeo) {
      const c = cards[i], p = c.offsetLeft / (indexGeo.dist() + indexGeo.view.clientWidth - c.offsetWidth);
      scrollTo(st.start + gsap.utils.clamp(0, 1, p) * (st.end - st.start) + 1);
    } else scrollTo(cards[i], { offset: -innerHeight * 0.2 });
  }
  // Arrow keys step through the index while it is pinned
  addEventListener('keydown', (e) => {
    const st = ScrollTrigger.getById('index');
    if (!st || !st.isActive || e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focusStyle(gsap.utils.clamp(0, 19, current + (e.key === 'ArrowRight' ? 1 : -1)));
    }
  });

  /* ── Matcher ── */
  const chipsEl = $('.chips'), resEl = $('.results');
  chipsEl.innerHTML = MOODS.map((m, k) => `<button type="button" class="chip" data-k="${k}" aria-pressed="false">${m.label}</button>`).join('');
  const chipInd = document.createElement('span');
  chipInd.className = 'chip-ind'; chipInd.setAttribute('aria-hidden', 'true');
  chipsEl.prepend(chipInd);
  const moveInd = (b, instant) => gsap.to(chipInd, {
    x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight,
    duration: instant || reduce ? 0 : 0.65, ease: 'expo.out', overwrite: true
  });
  addEventListener('resize', () => { const on = $('.chip[aria-pressed="true"]', chipsEl); if (on) moveInd(on, true); });
  function renderMatch(k, animate = true) {
    const mood = MOODS[k];
    $$('.chip', chipsEl).forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.k === k)));
    moveInd($(`.chip[data-k="${k}"]`, chipsEl), !animate);
    resEl.innerHTML = `<p class="res-why">${mood.why}</p>` + mood.ids.map((id, r) => {
      const st = STYLES[id];
      return `<article class="res" data-i="${id}">
        <div class="res-poster"></div>
        <div class="res-body">
          <p class="mono">${r === 0 ? 'Best fit' : 'Also works'} · ${pad(id + 1)}</p>
          <h3 style="font-family:${st.font}">${st.name}</h3>
          <p>${st.essence}</p>
          <div class="ci-sw">${st.palette.map((h) => `<i style="background:${h}"></i>`).join('')}</div>
          <button type="button" class="res-go" data-i="${id}">Open in the index <span aria-hidden="true">→</span></button>
        </div>
      </article>`;
    }).join('');
    // live mini posters: clone the real poster (cqw units make it scale)
    $$('.res', resEl).forEach((art) => {
      const i = +art.dataset.i, src = $(`.card[data-i="${i}"] .poster`), clone = src.cloneNode(true);
      clone.removeAttribute('role'); clone.setAttribute('aria-hidden', 'true'); clone.classList.add('live');
      const cv = clone.querySelector('canvas');
      if (cv) cv.getContext('2d').drawImage(src.querySelector('canvas'), 0, 0);
      $('.res-poster', art).appendChild(clone);
    });
    $$('.res-go', resEl).forEach((b) => b.addEventListener('click', () => focusStyle(+b.dataset.i)));
    matchPick = mood.ids[0];
    const inMatcher = ScrollTrigger.isInViewport($('.matcher'), 0.3);
    if (inMatcher) setActive(matchPick, true);
    if (animate && !reduce) {
      gsap.from($$('.res', resEl), { rotateY: -38, x: 90, opacity: 0, transformPerspective: 1100, transformOrigin: '0% 50%', duration: 1.15, stagger: 0.1, ease: 'expo.out' });
      gsap.from('.res-why', { opacity: 0, y: 10, duration: 0.6 });
    }
  }
  chipsEl.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) renderMatch(+b.dataset.k); });
  renderMatch(1, false);
  document.fonts && document.fonts.ready.then(() => moveInd($('.chip[aria-pressed="true"]', chipsEl), true));

  /* ── Cursor + magnetic controls ── */
  if (fine && !reduce) {
    const cur = $('.cursor'), label = $('.cursor-label');
    const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const card = e.target.closest('.card'), link = e.target.closest('a,button');
      cur.classList.toggle('is-card', !!card); cur.classList.toggle('is-link', !card && !!link);
      label.textContent = card ? 'Focus' : '';
    });
    // Glare tilt: posters lean toward the pointer and catch a moving highlight
    $$('.card .poster, .results').forEach((host) => {
      host.addEventListener('pointermove', (e) => {
        const el = e.target.closest('.poster'); if (!el) return;
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        gsap.to(el, { rotateX: (0.5 - y) * 14, rotateY: (x - 0.5) * 16, transformPerspective: 900, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      });
      host.addEventListener('pointerout', (e) => {
        const el = e.target.closest('.poster'); if (!el || el.contains(e.relatedTarget)) return;
        gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'elastic.out(1,.45)', overwrite: 'auto' });
      });
    });
    $$('.chip, .nav-links a, .hero-cue, .res-go').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,.4)' }));
    });
  } else {
    $('.cursor').remove();
  }

  /* ── API for the extra sections (sections.js) ── */
  window.Twenty = { setActive, clearStyle, scramble, scrollTo, focusStyle, pad, reduce, fine, onSection: null, get vs() { return vs; } };

  /* ── Boot ── */
  setAccent(CORE_DEFAULT.glow[0], CORE_DEFAULT.glow[1]);
  runLoader().then(() => {
    intro();
    scenes();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    // Keep every trigger honest: re-measure when late fonts land or the page height changes
    // (otherwise triggers near the bottom can end up past the maximum scroll and never fire).
    document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
    // A refresh re-measures everything (~90 ms), so never run it mid-scroll: note the change,
    // then apply it once scrolling has been idle for half a second.
    let lastH = document.body.scrollHeight, dirty = false, idleSince = performance.now();
    new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (Math.abs(h - lastH) >= 2) { lastH = h; dirty = true; }
    }).observe(document.querySelector('main'));
    gsap.ticker.add(() => {
      if (Math.abs(lenis ? lenis.velocity : 0) > 0.05) { idleSince = performance.now(); return; }
      if (dirty && performance.now() - idleSince > 500) { dirty = false; ScrollTrigger.refresh(); lastH = document.body.scrollHeight; }
    });
  });
})();
