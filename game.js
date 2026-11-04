const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const D = [[0,-1],[1,0],[0,1],[-1,0]];
const COUNT = 50; // har level mein 50 arrows

let level = 1, lives = 3, snakes = [], grid = [], cols, rows, cell, ox, oy, W, H, st;
let hintId = -1, hintT = 0, restTimer;

try { level = Math.min(1000, Math.max(1, +localStorage.getItem('am_level') || 1)); } catch (e) {}
const save = () => { try { localStorage.setItem('am_level', level); } catch (e) {} };

function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// Ek koshish: diye hue grid mein 50 arrows rakhne ki
function place(L, c, attempt){
  const R = rng(L * 7919 + 13 + attempt * 101);
  cols = c; rows = Math.round(c * 1.5);
  const maxLen = Math.min(10, 3 + Math.floor(L / 60));
  const g = Array.from({length: rows}, () => Array(cols).fill(-1)), S = [];
  const free = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && g[y][x] < 0;
  let fails = 0;
  while (S.length < COUNT && fails < 150) {
    const x = Math.floor(R() * cols), y = Math.floor(R() * rows);
    if (!free(x, y)) { fails++; continue; }
    const target = 2 + Math.floor(R() * (maxLen - 1));
    const p = [[x, y]], seen = new Set([x + ',' + y]);
    while (p.length < target) {
      const [cx, cy] = p[p.length - 1];
      const order = [0,1,2,3].sort(() => R() - .5);
      let moved = false;
      for (const d of order) {
        const nx = cx + D[d][0], ny = cy + D[d][1];
        if (free(nx, ny) && !seen.has(nx + ',' + ny)) { p.push([nx, ny]); seen.add(nx + ',' + ny); moved = true; break; }
      }
      if (!moved) break;
    }
    if (p.length < 2) { fails++; continue; }
    let ok = false;
    const rev = [...p].reverse();
    for (const q of (R() < .5 ? [p, rev] : [rev, p])) {
      const h = q[q.length - 1], b = q[q.length - 2], dx = h[0] - b[0], dy = h[1] - b[1];
      let cx = h[0] + dx, cy = h[1] + dy, clear = true;
      while (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
        if (g[cy][cx] >= 0 || seen.has(cx + ',' + cy)) { clear = false; break; }
        cx += dx; cy += dy;
      }
      if (clear) {
        const id = S.length;
        q.forEach(([a, c2]) => g[c2][a] = id);
        S.push({id, p: q, dx, dy, alive: true, out: 0, bad: 0});
        ok = true; break;
      }
    }
    fails = ok ? 0 : fails + 1;
  }
  return {S, g};
}

// 50 arrows pure hone tak grid thora bara karte jao
function gen(L){
  const base = Math.min(15, 11 + Math.floor(Math.sqrt(L) / 8));
  let best = null;
  for (let a = 0; a < 40; a++) {
    const r = place(L, Math.min(22, base + Math.floor(a / 3)), a);
    r.cols = cols; r.rows = rows;
    if (!best || r.S.length > best.S.length) best = r;
    if (r.S.length >= COUNT) break;
  }
  cols = best.cols; rows = best.rows; grid = best.g;
  return best.S;
}

// Har level ka apna design. Rang page ke rang jaisa, green nahi
function mkStyle(L){
  const R = rng(L * 31 + 5);
  let hue = (L * 47) % 360;
  if (hue >= 70 && hue <= 170) hue = (hue + 110) % 360;
  return {hue, l: 28 + Math.floor(R() * 10), lw: .1 + R() * .06,
          head: L % 4, join: R() < .5 ? 'round' : 'miter', cap: R() < .5 ? 'round' : 'butt'};
}

function blocker(s){
  const h = s.p[s.p.length - 1];
  let cx = h[0] + s.dx, cy = h[1] + s.dy;
  while (cx >= 0 && cy >= 0 && cx < cols && cy < rows) {
    if (grid[cy][cx] >= 0) return grid[cy][cx];
    cx += s.dx; cy += s.dy;
  }
  return -1;
}

function layout(){
  const w = cv.parentElement, dpr = window.devicePixelRatio || 1;
  W = w.clientWidth; H = w.clientHeight;
  cell = Math.floor(Math.min(W / cols, H / rows));
  ox = (W - cell * cols) / 2; oy = (H - cell * rows) / 2;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawHead(x, y, dx, dy, k, type){
  const px = -dy, py = dx;
  ctx.beginPath();
  if (type === 0) {
    ctx.moveTo(x + dx*k, y + dy*k);
    ctx.lineTo(x - dx*k*.3 + px*k*.7, y - dy*k*.3 + py*k*.7);
    ctx.lineTo(x - dx*k*.3 - px*k*.7, y - dy*k*.3 - py*k*.7);
    ctx.closePath(); ctx.fill();
  } else if (type === 1) {
    ctx.moveTo(x - dx*k*.2 + px*k*.8, y - dy*k*.2 + py*k*.8);
    ctx.lineTo(x + dx*k*.7, y + dy*k*.7);
    ctx.lineTo(x - dx*k*.2 - px*k*.8, y - dy*k*.2 - py*k*.8);
    ctx.stroke();
  } else if (type === 2) {
    ctx.arc(x + dx*k*.2, y + dy*k*.2, k*.6, 0, 7); ctx.fill();
  } else {
    ctx.moveTo(x + dx*k, y + dy*k);
    ctx.lineTo(x + px*k*.6, y + py*k*.6);
    ctx.lineTo(x - dx*k*.6, y - dy*k*.6);
    ctx.lineTo(x - px*k*.6, y - py*k*.6);
    ctx.closePath(); ctx.fill();
  }
}

function frame(now){
  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  for (const s of snakes) {
    let a = 1, tx = 0, ty = 0, lw = cell * st.lw;
    let col = `hsl(${st.hue},55%,${st.l}%)`;
    if (s.out) {
      const t = (now - s.out) / 380;
      if (t >= 1) continue;
      a = 1 - t; const e = t * t * cell * (cols + rows) * .3;
      tx = s.dx * e; ty = s.dy * e;
    }
    if (now < s.bad) { col = '#d64545'; tx += Math.sin(now / 25) * cell * .08; }
    if (s.id === hintId && now < hintT) { col = '#f08a00'; lw *= 1.4; }
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = lw; ctx.lineJoin = st.join; ctx.lineCap = st.cap;
    ctx.beginPath();
    s.p.forEach(([x, y], i) => {
      const X = (x + .5) * cell + tx, Y = (y + .5) * cell + ty;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    });
    ctx.stroke();
    const h = s.p[s.p.length - 1];
    drawHead((h[0] + .5) * cell + tx, (h[1] + .5) * cell + ty, s.dx, s.dy, cell * .36, st.head);
  }
  ctx.restore(); ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

function dseg(px, py, ax, ay, bx, by){
  const vx = bx - ax, vy = by - ay, l = vx*vx + vy*vy;
  let t = l ? ((px - ax) * vx + (py - ay) * vy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t*vx), py - (ay + t*vy));
}

cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left - ox, y = e.clientY - r.top - oy;
  let best = null, bd = Math.max(cell * .6, 14);
  for (const s of snakes) {
    if (!s.alive) continue;
    for (let i = 1; i < s.p.length; i++) {
      const d = dseg(x, y, (s.p[i-1][0]+.5)*cell, (s.p[i-1][1]+.5)*cell, (s.p[i][0]+.5)*cell, (s.p[i][1]+.5)*cell);
      if (d < bd) { bd = d; best = s; }
    }
  }
  if (best) tap(best);
});

// Arrow hamesha jata hai. Agar kisi aur arrow se takraye to ek boond kam
function tap(s){
  const now = performance.now(), hit = blocker(s) >= 0;
  s.alive = false; s.out = now;
  if (hit) s.bad = now + 380;
  s.p.forEach(([x, y]) => grid[y][x] = -1);
  if (hit) { lives--; drops(); }
  if (lives <= 0) { setTimeout(lose, 500); return; }
  if (snakes.every(q => !q.alive)) setTimeout(win, 450);
}

$('hint').onclick = () => {
  const s = snakes.find(q => q.alive && blocker(q) < 0);
  if (s) { hintId = s.id; hintT = performance.now() + 1600; }
};

function drops(){
  const svg = '<svg class="d%" viewBox="0 0 22 30"><path d="M11 1C11 1 2 13 2 19a9 9 0 0 0 18 0C20 13 11 1 11 1z" fill="#4da6f0"/></svg>';
  $('drops').innerHTML = [0,1,2].map(i => svg.replace('d%', 'd' + (i >= lives ? ' off' : ''))).join('');
}

function ov(title, sub, btn, fn){
  $('ot').textContent = title; $('os').textContent = sub; $('ob').textContent = btn;
  $('ob').onclick = () => { $('ov').hidden = true; fn(); };
  $('ov').hidden = false;
}

function clap(){
  try {
    const A = new (window.AudioContext || window.webkitAudioContext)(); A.resume();
    const n = A.sampleRate * .12;
    for (let i = 0; i < 10; i++) {
      const b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
      for (let j = 0; j < n; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / n, 3);
      const s = A.createBufferSource(); s.buffer = b;
      const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 1500;
      const g = A.createGain(); g.gain.value = .7;
      s.connect(f); f.connect(g); g.connect(A.destination);
      s.start(A.currentTime + i * .13 + Math.random() * .05);
    }
  } catch (e) {}
}

// Level poora: taaliyan, Next, phir "Level N" page, Play dabane par game shuru
function win(){
  clap();
  if (level >= 1000) { ov('All 1000 levels finished', 'Congratulations!', '↺', () => { level = 1; save(); load(); }); return; }
  ov('Level ' + level + ' complete', 'Well played.', '▶', () => {
    level++; save(); load();
    ov('Level ' + level, 'Tap Play to start.', 'Play', () => {});
  });
}
function lose(){ ov('Out of drops', 'Try this level again.', '↻', load); }

function load(){
  snakes = gen(level); st = mkStyle(level); lives = 3; hintId = -1;
  document.body.style.background = `hsl(${st.hue},45%,94%)`;
  document.body.style.color = `hsl(${st.hue},55%,30%)`;
  $('lv').textContent = 'Level ' + level;
  drops(); layout();
}

function rest(){
  clearTimeout(restTimer);
  restTimer = setTimeout(() => ov('Time to rest', 'You played for 30 minutes. Rest and sleep well.', 'OK', rest), 30 * 60 * 1000);
}

window.addEventListener('resize', () => { if (!$('game').hidden) layout(); });

setTimeout(() => {
  $('cover').hidden = true; $('game').hidden = false;
  load(); rest(); requestAnimationFrame(frame);
}, 2200);
