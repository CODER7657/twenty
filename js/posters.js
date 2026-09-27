/* Poster 11 (Pixel Art): a 60×80 scene drawn pixel by pixel, scaled up with
   image-rendering: pixelated. Limited palette, stepped bands, dithering.
   When the poster is live it animates like a real 16-bit sprite: a two-frame
   gallop, sun bands scrolling down, clouds drifting a pixel at a time. */
(function () {
  const cv = document.querySelector('.p11-canvas');
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = 60, H = 80;
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

  const sky = ['#3B1530', '#5A1B38', '#86263D', '#B23A3A', '#D8553A', '#EE7E3E', '#F7B267'];
  const RIDER = [
    '.....###......',
    '....#####.....',
    '.....##.......',
    '.....###......',
    '....####......',
    '....####....##',
    '..##########.#',
    '.###########..',
    '############..',
    '.##########...'
  ];
  const LEGS = [
    ['.#.#....#.#...', '.#.#....#.#...', '.#.#....#.#...'],
    ['#...#..#...#..', '#....#.#....#.', '.....#......#.']
  ];

  function draw(f) {
    const bandH = 7;
    for (let y = 0; y < 52; y++) {
      const b = Math.min(sky.length - 1, Math.floor(y / bandH));
      for (let x = 0; x < W; x++) {
        const edge = y % bandH === bandH - 1 && b < sky.length - 1;
        px(x, y, edge && (x + y) % 2 ? sky[b + 1] : sky[b]);
      }
    }
    // clouds drift one pixel per step and wrap
    [[6, 9, 10], [40, 14, 12], [18, 22, 8]].forEach(([x0, y, w], k) => {
      const x = ((x0 + Math.floor(f / (2 + k))) % (W + w)) - w;
      for (let i = 0; i < w; i++) px(x + i, y, '#F29A6B');
      for (let i = 2; i < w - 3; i++) px(x + i, y - 1, '#F7B98C');
    });
    // banded sun: the gaps scroll downward
    const cx = 30, cy = 44, r = 12, shift = f % 3;
    for (let y = cy - r; y <= cy; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r && !(y > cy - 7 && (y - cy + shift) % 3 === 0)) px(x, y, d > r - 1.2 ? '#F9D48B' : '#FCE4A8');
    }
    const mesa = (x0, x1, top, c, shade) => {
      for (let x = x0; x <= x1; x++) for (let y = top; y < 56; y++) px(x, y, x > x1 - 3 ? shade : c);
      for (let x = x0 + 1; x < x1 - 2; x++) if (x % 3 === 0) px(x, top + 4, shade);
    };
    mesa(0, 13, 30, '#8A2A22', '#5E1A17'); mesa(5, 17, 38, '#6B1E1E', '#4A1414');
    mesa(46, 59, 27, '#8A2A22', '#5E1A17'); mesa(43, 52, 36, '#6B1E1E', '#4A1414');
    for (let y = 52; y < H; y++) for (let x = 0; x < W; x++) {
      let c = y < 58 ? '#C9542A' : y < 66 ? '#A63E1F' : y < 73 ? '#7A2A17' : '#3E1511';
      if ((y === 57 || y === 65 || y === 72) && (x + y) % 2) c = y === 57 ? '#A63E1F' : y === 65 ? '#7A2A17' : '#3E1511';
      px(x, y, c);
    }
    const cac = '#2F4A2A', cacL = '#46693A';
    for (let y = 44; y < 64; y++) { px(49, y, cac); px(50, y, cacL); }
    for (let y = 48; y < 54; y++) px(46, y, cac); for (let x = 46; x < 49; x++) px(x, 54, cac);
    for (let y = 46; y < 52; y++) px(53, y, cac); for (let x = 51; x < 54; x++) px(x, 52, cac);
    // rider + horse, with a one-pixel bounce on the gallop frame
    const frame = f % 2, ox = 16, oy = 50 - frame;
    RIDER.concat(LEGS[frame]).forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') px(ox + x, oy + y, '#1B0A12'); }));
    px(ox + 6, oy + 4, '#E8672A');
    for (let x = 0; x < 16; x++) px(ox + 2 + x, 63, (x % 2) ? '#5A1F14' : '#3E1511');
  }

  draw(0);
  const poster = cv.closest('.poster');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let f = 0;
  if (!still) setInterval(() => { if (poster.classList.contains('live')) draw(++f); }, 170);
})();
