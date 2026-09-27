/* ─────────────────────────────────────────────────────────────────────────
   Extra sections: Palettes wall, Typefaces specimen, Spot-the-style quiz,
   Pairings. Hovering anything tied to a style previews it on the core.
   Depends on window.Twenty (main.js) and window.STYLES (data.js).
   ───────────────────────────────────────────────────────────────────────── */
(() => {
  const T = window.Twenty;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = T.pad;
  const hover = matchMedia('(hover: hover)').matches;

  // Readable ink for any background colour (relative luminance)
  const ink = (hex) => {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.36 ? '#111014' : '#F6F2EA';
  };
  const family = (st) => (st.font.match(/'([^']+)'/) || [0, st.font])[1];
  const preview = (i) => { if (hover) T.setActive(i, true); };
  const reveal = (targets, trigger, vars = {}) => {
    if (T.reduce) return;
    gsap.from(targets, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.04, ...vars, scrollTrigger: { trigger, start: 'top 85%' } });
  };

  /* ── Palettes: a wall of strips; open one, copy a colour ── */
  const wall = $('.pal-wall'), toast = $('.toast');
  wall.innerHTML = STYLES.map((st, i) => `
    <div class="pal-strip" role="listitem" data-i="${i}">
      <span class="pal-num" style="color:${ink(st.palette[0])}">${pad(i + 1)}</span>
      ${st.palette.map((h) => `<button type="button" class="pal-sw" style="--c:${h};color:${ink(h)}" data-hex="${h}" aria-label="Copy ${h}, ${st.name}"><em>${h}</em></button>`).join('')}
      <span class="pal-label"><b style="font-family:${st.font}">${st.name}</b></span>
    </div>`).join('');
  let toastTw;
  wall.addEventListener('click', (e) => {
    const b = e.target.closest('.pal-sw'); if (!b) return;
    const hex = b.dataset.hex;
    const r = b.getBoundingClientRect(), dot = document.createElement('i');
    dot.className = 'ripple'; dot.style.left = (e.clientX - r.left) + 'px'; dot.style.top = (e.clientY - r.top) + 'px';
    b.appendChild(dot); setTimeout(() => dot.remove(), 800);
    const done = () => {
      toast.textContent = `Copied ${hex}`;
      toastTw && toastTw.kill();
      toastTw = gsap.timeline().fromTo(toast, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }).to(toast, { opacity: 0, duration: 0.4, delay: 1.4 });
    };
    navigator.clipboard ? navigator.clipboard.writeText(hex).then(done, done) : done();
  });
  $$('.pal-strip').forEach((s) => s.addEventListener('pointerenter', () => preview(+s.dataset.i)));
  // Jelly: strips hang like swatches on a rail and lag behind fast scrolling, each at its own rate
  if (!T.reduce && innerWidth >= 900) {
    const stripEls = $$('.pal-strip'), ys = stripEls.map(() => 0), setY = stripEls.map((el) => gsap.quickSetter(el, 'y', 'px'));
    let wallVis = false;
    new IntersectionObserver(([en]) => { wallVis = en.isIntersecting; }).observe(wall);
    gsap.ticker.add(() => {
      if (!wallVis) return;
      const v = gsap.utils.clamp(-70, 70, -T.vs * 1.1);
      stripEls.forEach((el, k) => {
        const target = v * (0.3 + 0.7 * Math.sin((k / 19) * Math.PI));
        const next = ys[k] + (target - ys[k]) * (0.05 + (k % 4) * 0.015);
        if (Math.abs(next - ys[k]) < 0.01 && Math.abs(next) < 0.05) return;
        ys[k] = next; setY[k](next);
      });
    });
  }
  if (!T.reduce) {
    gsap.from('.pal-strip', { scaleY: 0, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out', stagger: 0.035, scrollTrigger: { trigger: wall, start: 'top 85%' } });
    const strips = $$('.pal-strip');
    ScrollTrigger.create({
      trigger: wall, start: 'top 55%', once: true,
      onEnter: () => strips.forEach((st, k) => {
        setTimeout(() => st.classList.add('peek'), 700 + k * 65);
        setTimeout(() => st.classList.remove('peek'), 700 + k * 65 + 420);
      })
    });
  }

  /* ── Typefaces: every style's voice, previewing the visitor's own words ── */
  const grid = $('.type-grid'), input = $('.type-input input');
  grid.innerHTML = STYLES.map((st, i) => `
    <div class="tf" data-i="${i}" style="--k:${st.glow[0]};--kt:${ink(st.glow[0])}">
      <p class="tf-spec" style="font-family:${st.font}">Aa</p>
      <p class="tf-alpha" style="font-family:${st.font}">Abc Xyz 0123</p>
      <p class="tf-meta"><span>${pad(i + 1)} ${st.name}</span><span>${family(st)}</span></p>
    </div>`).join('');
  const specs = $$('.tf-spec', grid);
  let typeTimer;
  input.addEventListener('input', () => {
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      const v = input.value.trim();
      grid.dataset.len = !v ? '' : v.length <= 4 ? 's' : v.length <= 10 ? 'm' : 'l';
      specs.forEach((el) => { el.textContent = v || 'Aa'; });
      if (!T.reduce) gsap.fromTo(specs, { yPercent: 25, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out', stagger: { each: 0.012, from: 'random' } });
    }, 90);
  });
  $$('.tf', grid).forEach((t) => t.addEventListener('pointerenter', () => preview(+t.dataset.i)));
  if (!T.reduce) gsap.from('.tf', {
    rotateX: -80, y: 30, opacity: 0, transformPerspective: 900, transformOrigin: '50% 0%', duration: 1.1, ease: 'expo.out',
    stagger: { each: 0.035, grid: 'auto', from: 'center' }, scrollTrigger: { trigger: grid, start: 'top 85%' }
  });
  if (T.fine && !T.reduce) {
    const tiles = $$('.tf', grid);
    let offs = [];
    const measureTiles = () => { offs = tiles.map((t) => [t.offsetLeft, t.offsetTop]); };
    measureTiles(); addEventListener('resize', measureTiles);
    grid.addEventListener('pointermove', (e) => {
      const g = grid.getBoundingClientRect(), x = e.clientX - g.left, y = e.clientY - g.top;
      grid.style.setProperty('--gx', x + 'px'); grid.style.setProperty('--gy', y + 'px');
      tiles.forEach((t, k) => { t.style.setProperty('--x', (x - offs[k][0]) + 'px'); t.style.setProperty('--y', (y - offs[k][1]) + 'px'); });
    });
    grid.addEventListener('pointerleave', () => { grid.style.setProperty('--gx', '-999px'); tiles.forEach((t) => t.style.setProperty('--x', '-999px')); });
  }


  /* ── Quiz: spot the style ── */
  const qPoster = $('.quiz-poster'), qChoices = $('.quiz-choices'), qFb = $('.quiz-feedback'), qNext = $('.quiz-next');
  const qStreak = $('.qs-streak'), qBest = $('.qs-best');
  let answer = -1, last = -1, streak = 0, locked = false, best = 0;
  try { best = +(localStorage.getItem('twenty-best') || 0); } catch (e) { /* storage blocked */ }
  qBest.textContent = `Best ${best}`;
  const rnd = (n) => Math.floor(Math.random() * n);
  const clonePoster = (i) => {
    const src = $(`.card[data-i="${i}"] .poster`), c = src.cloneNode(true);
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Mystery poster');
    c.classList.add('live');
    c.querySelectorAll('.glare').forEach((g) => g.remove());
    const cv = c.querySelector('canvas');
    if (cv) cv.getContext('2d').drawImage(src.querySelector('canvas'), 0, 0);
    return c;
  };
  function ask(first) {
    locked = false;
    do { answer = rnd(20); } while (answer === last);
    last = answer;
    const opts = [answer];
    while (opts.length < 4) { const r = rnd(20); if (!opts.includes(r)) opts.push(r); }
    opts.sort(() => Math.random() - 0.5);
    const swap = () => {
      qPoster.replaceChildren(clonePoster(answer));
      qChoices.innerHTML = opts.map((i) => `<button type="button" class="qc" data-i="${i}">${STYLES[i].name}</button>`).join('');
      qFb.textContent = '';
      qNext.classList.remove('is-on');
      if (!T.reduce && !first) {
        gsap.fromTo(qPoster, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(76% at 50% 50%)', duration: 0.95, ease: 'expo.out', onComplete: () => gsap.set(qPoster, { clearProps: 'clipPath' }) });
        gsap.from('.qc', { y: 18, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05 });
      }
    };
    if (first || T.reduce) return swap();
    gsap.fromTo(qPoster, { clipPath: 'circle(76% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)', duration: 0.42, ease: 'power3.in', onComplete: swap });
    T.clearStyle();
  }
  qChoices.addEventListener('click', (e) => {
    const b = e.target.closest('.qc'); if (!b || locked) return;
    locked = true;
    const pick = +b.dataset.i, right = pick === answer, st = STYLES[answer];
    $$('.qc', qChoices).forEach((x) => {
      x.disabled = true;
      x.classList.toggle('is-right', +x.dataset.i === answer);
      x.classList.toggle('is-wrong', x === b && !right);
    });
    streak = right ? streak + 1 : 0;
    if (streak > best) { best = streak; try { localStorage.setItem('twenty-best', String(best)); } catch (err) { /* ignore */ } }
    qStreak.textContent = `Streak ${streak}`; qBest.textContent = `Best ${best}`;
    qFb.textContent = right ? `Right, it's ${st.name}. ${st.essence}` : `It's ${st.name}. Look for: ${st.moves[0].toLowerCase()}.`;
    T.setActive(answer, true);   // the core takes the answer's colours and bursts
    if (!right) Core.kick(120);  // and shudders on a miss
    qNext.classList.add('is-on');
    if (!T.reduce) {
      if (right) {
        // confetti in the answer's own palette, thrown from the right button
        const r = b.getBoundingClientRect(), pal = st.palette;
        for (let k = 0; k < 22; k++) {
          const c = document.createElement('i');
          c.className = 'confetti'; c.style.background = pal[k % pal.length];
          c.style.left = (r.left + r.width * 0.86) + 'px'; c.style.top = (r.top + r.height / 2) + 'px';
          document.body.appendChild(c);
          gsap.to(c, { x: gsap.utils.random(-170, 190), y: gsap.utils.random(-190, 30), rotation: gsap.utils.random(-400, 400), opacity: 0,
            duration: gsap.utils.random(0.8, 1.4), ease: 'power3.out', onComplete: () => c.remove() });
        }
        gsap.fromTo(qStreak, { scale: 1.7, color: st.glow[0] }, { scale: 1, color: '', duration: 0.9, ease: 'elastic.out(1,.4)', clearProps: 'color' });
      }
      const good = qChoices.querySelector('.is-right');
      gsap.fromTo(good, { scale: 0.94 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1,.45)' });
      if (!right) gsap.fromTo(b, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.2,.25)' });
    }
    if (!T.reduce) gsap.fromTo(qFb, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
  });
  qNext.addEventListener('click', () => ask(false));
  ask(true);
  reveal('.quiz-stage > *', '.quiz-stage');

  /* ── Pairings ── */
  const PAIRS = [[13, 0, 'Structured calm'], [11, 4, 'Fashion zines'], [2, 8, 'Premium tech'], [18, 8, 'Launch glow'], [12, 6, 'Rave and techno flyers'],
    [5, 7, 'Nostalgic fun'], [10, 5, 'Indie game posters'], [15, 19, 'Artisan brands'], [14, 0, 'Conceptual ads'], [17, 4, 'Streetwear drops']];
  const CLASH = [[0, 1, 'Opposite philosophies'], [13, 17, 'Order against chaos'], [16, 6, 'Two eras that fight']];
  const ring = (st) => { const n = st.palette.length; return `conic-gradient(${st.palette.map((h, k) => `${h} ${(k / n) * 100}% ${((k + 1) / n) * 100}%`).join(',')})`; };
  $('.pair-grid').innerHTML = PAIRS.map(([a, b, use]) => {
    const A = STYLES[a], Bs = STYLES[b];
    return `<article class="pair" data-i="${a}">
      <div class="pair-dots" aria-hidden="true"><i style="background:${ring(A)}"></i><i style="background:${ring(Bs)}"></i></div>
      <h3><span>${A.name}</span><span class="pair-b"><em>+</em>&nbsp;${Bs.name}</span></h3>
      <p>${use}</p>
    </article>`;
  }).join('');
  $('.clash-list').innerHTML = CLASH.map(([a, b, why]) => `<span class="clash-pill"><s>${STYLES[a].name} + ${STYLES[b].name}</s><em>${why}</em></span>`).join('');
  $$('.pair').forEach((p) => p.addEventListener('pointerenter', () => preview(+p.dataset.i)));
  reveal('.pair', '.pair-grid', { stagger: 0.05 });
  if (!T.reduce) {
    ScrollTrigger.batch('.pair', {
      start: 'top 88%', once: true,
      onEnter: (els) => els.forEach((el, k) => {
        const [a, b] = el.querySelectorAll('.pair-dots i');
        const done = { clearProps: 'transform' }; // hand transforms back to the CSS hover orbit
        gsap.fromTo(a, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 1.3, delay: 0.15 + k * 0.06, ease: 'elastic.out(1,.55)', ...done });
        gsap.fromTo(b, { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: 1.3, delay: 0.22 + k * 0.06, ease: 'elastic.out(1,.55)', ...done });
      })
    });
    ScrollTrigger.create({ trigger: '.clash', start: 'top 92%', once: true, onEnter: () => $('.clash').classList.add('in') });
  } else $('.clash').classList.add('in');

  // Leaving a hover-preview area hands the core back to its section's default
  ['.pal-wall', '.type-grid', '.pair-grid'].forEach((sel) => $(sel).addEventListener('pointerleave', () => { if (hover) T.clearStyle(); }));
})();
