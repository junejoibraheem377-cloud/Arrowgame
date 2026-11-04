const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const D = [[0,-1],[1,0],[0,1],[-1,0]];
const COUNT = 50; // lagbhag 50 arrows har level mein

let level = 1, lives = 3, snakes = [], grid = [], cols, rows, cell, ox, oy, W, H, st;
let hintId = -1, hintT = 0, restTimer, looping = false, AC = null;

try { level = Math.min(1000, Math.max(1, +localStorage.getItem('am_level') || 1)); } catch (e) {}
const save = () => { try { localStorage.setItem('am_level', level); } catch (e) {} };

// ---------- Awaaz ----------
function ac(){
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); return AC; }
  catch (e) { return null; }
}

// Arrow nikalne ki awaaz: "chhis"
function sGo(){
  const A = ac(); if (!A) return;
  const n = A.sampleRate * .3, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = A.createBufferSource(); s.buffer = b;
  const f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(2500, A.currentTime);
  f.frequency.exponentialRampToValueAtTime(7000, A.currentTime + .25);
  const g = A.createGain(); g.gain.value = .6;
  s.connect(f); f.connect(g); g.connect(A.destination); s.start();
}

// Takrane ki awaaz
function sBump(){
  const A = ac(); if (!A) return;
  const o = A.createOscillator(), g = A.createGain(), t = A.currentTime;
  o.type = 'square';
  o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + .22);
  g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
  o.connect(g); g.connect(A.destination); o.start(); o.stop(t + .22);
}

function clap(){
  const A = ac(); if (!A) return;
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
}

// ---------- Level banana ----------
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// Grid kinare se andar ki taraf bharta hai, is liye koi khali jagah nahi bachti
// aur level hamesha hal ho sakta hai.
function build(L){
  const R = rng(L * 7919 + 13);
  cols = Math.min(16, 10 + Math.floor(L / 170)); rows = Math.round(cols * 1.5);
  const g = Array.from({length: rows}, () => Array(cols).fill(-1)), S = [];
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const free = (x, y) => inb(x, y) && g[y][x] < 0;
  const rayFilled = (x, y, dx, dy) => {
    x += dx; y += dy;
    while (inb(x, y)) { if (g[y][x] < 0) return false; x += dx; y += dy; }
    return true;
  };
  const bd = (x, y) => Math.min(x, y, cols - 1 - x, rows - 1 - y);
  let left = cols * rows;

  while (left > 0) {
    let m = 99, c = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (g[y][x] < 0) {
      const d = bd(x, y);
      if (d < m) { m = d; c = [[x, y]]; } else if (d === m) c.push([x, y]);
    }
    const [hx, hy] = c[Math.floor(R() * c.length)];
    const id = S.length;
    const target = Math.max(2, Math.round(left / Math.max(1, COUNT - id) * (.6 + R() * .8)));
    const dirs = [0,1,2,3].filter(d => rayFilled(hx, hy, D[d][0], D[d][1])).sort(() => R() - .5);
    const pick = dirs.find(d => free(hx - D[d][0], hy - D[d][1]));
    g[hy][hx] = id;
    let path = [[hx, hy]], dir = dirs.length ? dirs[0] : 0;
    if (pick !== undefined) {
      dir = pick;
      let cx = hx - D[dir][0], cy = hy - D[dir][1];
      const tail = [[cx, cy]]; g[cy][cx] = id;
      while (tail.length + 1 < target) {
        let moved = false;
        for (const d of [0,1,2,3].sort(() => R() - .5)) {
          const nx = cx + D[d][0], ny = cy + D[d][1];
          if (free(nx, ny)) { tail.push([nx, ny]); g[ny][nx] = id; cx = nx; cy = ny; moved = true; break; }
        }
        if (!moved) break;
      }
      path = [...tail].reverse(); path.push([hx, hy]);
    }
    S.push({id, p: path, dx: D[dir][0], dy: D[dir][1], alive: true, out: 0, bump: 0, gap: 0});
    left -= path.length;
  }
  grid = g;
  return S;
}

// Har level ka apna design. Rang page ke rang jaisa, green nahi
function mkStyle(L){
  const R = rng(L * 31 + 5);
  let hue = (L * 47) % 360;
  if (hue >= 70 && hue <= 170) hue = (hue + 110) % 360;
  return {hue, l: 28 + Math.floor(R() * 10), lw: .1 + R() * .06,
          head: L % 4, join: R() < .5 ? 'round' : 'miter', cap: R() < .5 ? 'round' : 'butt'};
}

// Arrow ke samne kitne cell door rukawat hai (0 matlab raasta khula)
function ray(s){
  const h = s.p[s.p.length - 1];
  let x = h[0] + s.dx, y = h[1] + s.dy, n = 1;
  while (x >= 0 && y >= 0 && x < cols && y < rows) {
    if (grid[y][x] >= 0) return n;
    x += s.dx; y += s.dy; n++;
  }
  return 0;
}

// ---------- Drawing ----------
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
    if (s.out) {                        // raasta khula: arrow bahar nikal jata hai
      const t = (now - s.out) / 380;
      if (t >= 1) continue;
      a = 1 - t; const e = t * t * cell * (cols + rows) * .3;
      tx = s.dx * e; ty = s.dy * e;
    }
    if (s.bump && now - s.bump < 500) { // doosre arrow se takraya: lal ho kar wapis apni jagah
      const t = (now - s.bump) / 500;
      const e = Math.sin(Math.PI * t) * s.gap;
      tx = s.dx * e; ty = s.dy * e; col = '#d64545';
    }
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

// ---------- Tap ----------
function dseg(px, py, ax, ay, bx, by){
  const vx = bx - ax, vy = by - ay, l = vx*vx + vy*vy;
  let t = l ? ((px - ax) * vx + (py - ay) * vy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t*vx), py - (ay + t*vy));
}

cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left - ox, y = e.clientY - r.top - oy;
  let best = null, bd = Math.max(cell * .7, 14);
  for (const s of snakes) {
    if (!s.alive) continue;
    if (s.p.length === 1) {
      const d = Math.hypot(x - (s.p[0][0] + .5) * cell, y - (s.p[0][1] + .5) * cell);
      if (d < bd) { bd = d; best = s; }
      continue;
    }
    for (let i = 1; i < s.p.length; i++) {
      const d = dseg(x, y, (s.p[i-1][0]+.5)*cell, (s.p[i-1][1]+.5)*cell, (s.p[i][0]+.5)*cell, (s.p[i][1]+.5)*cell);
      if (d < bd) { bd = d; best = s; }
    }
  }
  if (best) tap(best);
});

// Raasta khula ho to arrow nikalta hai (chhis awaaz).
// Raasta band ho to arrow jata hai, doosre arrow se takrata hai, lal hota hai,
// wapis apni jagah aata hai aur ek boond kam hoti hai.
function tap(s){
  const now = performance.now();
  if (now - s.bump < 500) return;
  const n = ray(s);
  if (n > 0) {
    s.bump = now; s.gap = Math.max(.15, n - .85) * cell;
    sBump();
    lives--; drops();
    if (lives <= 0) setTimeout(lose, 650);
    return;
  }
  sGo();
  s.alive = false; s.out = now;
  s.p.forEach(([x, y]) => grid[y][x] = -1);
  if (snakes.every(q => !q.alive)) setTimeout(win, 450);
}

$('hint').onclick = () => {
  const s = snakes.find(q => q.alive && ray(q) === 0);
  if (s) { hintId = s.id; hintT = performance.now() + 1600; }
};

// ---------- Screens ----------
function drops(){
  const svg = '<svg class="d%" viewBox="0 0 22 30"><path d="M11 1C11 1 2 13 2 19a9 9 0 0 0 18 0C20 13 11 1 11 1z" fill="#4da6f0"/></svg>';
  $('drops').innerHTML = [0,1,2].map(i => svg.replace('d%', 'd' + (i >= lives ? ' off' : ''))).join('');
}

function ov(title, sub, btn, fn){
  $('ot').textContent = title; $('os').textContent = sub; $('ob').textContent = btn;
  $('ob').onclick = () => { $('ov').hidden = true; fn(); };
  $('ov').hidden = false;
}

function win(){
  clap();
  if (level >= 1000) { ov('All 1000 levels finished', 'Congratulations!', '↺', () => { level = 1; save(); showHome(); }); return; }
  ov('Level ' + level + ' complete', 'Well played.', '▶', () => { level++; save(); showHome(); });
}
function lose(){ ov('Out of drops', 'Try this level again.', '↻', load); }

function theme(){
  st = mkStyle(level);
  document.body.style.background = `hsl(${st.hue},45%,94%)`;
  document.body.style.color = `hsl(${st.hue},55%,30%)`;
  document.body.style.setProperty('--h', st.hue);
}

function load(){
  snakes = build(level); theme(); lives = 3; hintId = -1;
  $('lv').textContent = 'Level ' + level;
  drops(); layout();
}

function rest(){
  clearTimeout(restTimer);
  restTimer = setTimeout(() => ov('Time to rest', 'You played for 30 minutes. Rest and sleep well.', 'OK', rest), 30 * 60 * 1000);
}

function showHome(){
  theme();
  $('game').hidden = true; $('home').hidden = false;
  $('plv').textContent = 'Level ' + level;
  $('strip').innerHTML = [0,1,2,3,4].filter(i => level + i <= 1000)
    .map(i => `<span class="${i ? '' : 'cur'}">${level + i}</span>`).join('');
}

// Level ke gole par ya Play par tap karne se game shuru
function start(){
  ac();
  $('home').hidden = true; $('game').hidden = false;
  load();
  if (!looping) { looping = true; rest(); requestAnimationFrame(frame); }
}
$('play').onclick = start;
$('strip').onclick = e => { if (e.target.classList.contains('cur')) start(); };
$('back').onclick = showHome;

window.addEventListener('resize', () => { if (!$('game').hidden) layout(); });

// Pehle splash (3 second), phir level wala page
setTimeout(() => { $('splash').hidden = true; showHome(); }, 3000);
