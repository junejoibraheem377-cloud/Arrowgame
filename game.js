const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const D = [[0,-1],[1,0],[0,1],[-1,0]];
const ARROW = '#6b4a2e'; // screenshot jaisa gehra bhoora

let level = 1, best = 1, lives = 3, snakes = [], grid = [], cols, rows, cell, ox, oy, W, H, st;
let hintId = -1, hintT = 0, restTimer, looping = false, AC = null;

// best = sab se aage ka khula hua level. Purane levels dobara khelne se ye nahi ghatta
try {
  best = Math.min(1000, Math.max(1, +localStorage.getItem('am_best') || +localStorage.getItem('am_level') || 1));
  level = best;
} catch (e) {}
const save = () => { try { localStorage.setItem('am_best', best); } catch (e) {} };

// ---------- Awaaz ----------
function ac(){
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); return AC; }
  catch (e) { return null; }
}
function sGo(){ // arrow nikalne ki awaaz: chhis
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
function sBump(){ // takrane ki awaaz
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

// Mushkil har level ke saath barhti hai:
//  - grid bara hota hai (Level 1 par 15 columns, Level 16 tak 28 columns)
//  - arrows lambay hote jate hain
//  - arrows ki directions zyada uljhi hoti hain (shuru mein kinare se, phir kahin se bhi shuru)
// Level hamesha hal ho sakta hai: har arrow ke samne ka raasta sirf purane arrows se bhara hota hai.
function build(L){
  const R = rng(L * 7919 + 13);
  cols = Math.min(28, 14 + Math.floor(L * 0.9)); rows = Math.round(cols * 1.43);
  const avg = Math.min(26, 6 + L / 25);
  const pr = Math.min(.9, .35 + L / 80);            // kitni baar arrow kisi bhi jagah se shuru ho
  const g = Array.from({length: rows}, () => Array(cols).fill(-1)), S = [];
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const free = (x, y) => inb(x, y) && g[y][x] < 0;
  const rayFilled = (x, y, dx, dy) => {
    x += dx; y += dy;
    while (inb(x, y)) { if (g[y][x] < 0) return false; x += dx; y += dy; }
    return true;
  };
  const bd = (x, y) => Math.min(x, y, cols - 1 - x, rows - 1 - y);
  const walls = (x, y) => { let n = 0; for (const [dx, dy] of D) { const a = x + dx, b = y + dy; if (!inb(a, b) || g[b][a] >= 0) n++; } return n; };
  let left = cols * rows;

  while (left > 0) {
    // wo cells jin ke kisi taraf ka poora raasta pehle se bhara ho (ya bahar ho)
    const cand = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (g[y][x] < 0) {
      const ds = [];
      for (let d = 0; d < 4; d++) if (rayFilled(x, y, D[d][0], D[d][1])) ds.push(d);
      if (ds.length) cand.push([x, y, ds]);
    }
    if (!cand.length) break;
    let pc;
    if (R() < pr) pc = cand[Math.floor(R() * cand.length)];
    else {
      let m = 99, pool = [];
      for (const q of cand) { const d = bd(q[0], q[1]); if (d < m) { m = d; pool = [q]; } else if (d === m) pool.push(q); }
      pc = pool[Math.floor(R() * pool.length)];
    }
    const [hx, hy] = pc, ds = [...pc[2]].sort(() => R() - .5);
    const id = S.length;
    const target = Math.max(2, Math.round(avg * (.3 + R() * 1.7)));
    const pick = ds.find(d => free(hx - D[d][0], hy - D[d][1]));
    g[hy][hx] = id;
    let path = [[hx, hy]], dir = ds[0];
    if (pick !== undefined) {
      dir = pick;
      let cx = hx - D[dir][0], cy = hy - D[dir][1], last = [-D[dir][0], -D[dir][1]];
      const tail = [[cx, cy]]; g[cy][cx] = id;
      while (tail.length + 1 < target) {
        let bn = null, bs = -1;
        for (const d of D) {
          const nx = cx + d[0], ny = cy + d[1];
          if (!free(nx, ny)) continue;
          const sc = walls(nx, ny) * 2 + (d[0] === last[0] && d[1] === last[1] ? .6 : 0) + R() * 2;
          if (sc > bs) { bs = sc; bn = [nx, ny, d]; }
        }
        if (!bn) break;
        tail.push([bn[0], bn[1]]); g[bn[1]][bn[0]] = id;
        cx = bn[0]; cy = bn[1]; last = bn[2];
      }
      path = [...tail].reverse(); path.push([hx, hy]);
    }
    const dx = D[dir][0], dy = D[dir][1];
    const P = path.map(([x, y]) => [x + .5, y + .5]);   // lakeer jis par arrow sarakta hai
    const hd = P[P.length - 1];
    P.push([hd[0] + dx * (cols + rows + 60), hd[1] + dy * (cols + rows + 60)]);
    S.push({id, p: path, P, Lb: Math.max(path.length - 1, .01), dx, dy, alive: true, out: 0, bump: 0, gap: 0, uEnd: 0, dur: 0});
    left -= path.length;
  }
  grid = g;
  return S;
}

// Bohat patli lakeer
function mkStyle(L){
  const R = rng(L * 31 + 5);
  return {lw: .13 + R() * .03, join: R() < .5 ? 'round' : 'miter'};
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

function slice(P, a, b){ // lakeer ka wo hissa jo a se b ki lambai ke beech ho
  const out = []; let d = 0;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i-1], [x1, y1] = P[i], l = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    const s = d, e = d + l;
    if (l > 0 && e > a && s < b) {
      const t0 = Math.max(a, s) - s, t1 = Math.min(b, e) - s, ux = (x1 - x0) / l, uy = (y1 - y0) / l;
      if (!out.length) out.push([x0 + ux * t0, y0 + uy * t0]);
      out.push([x0 + ux * t1, y0 + uy * t1]);
    }
    d = e;
  }
  return out;
}

// Mukammal arrow ka sira: chhota bhara hua tikon jo lakeer se jura hai
function drawHead(x, y, dx, dy, hw){
  const px = -dy, py = dx;
  ctx.beginPath();
  ctx.moveTo(x + dx*hw*1.5, y + dy*hw*1.5);
  ctx.lineTo(x - dx*hw*.1 + px*hw, y - dy*hw*.1 + py*hw);
  ctx.lineTo(x - dx*hw*.1 - px*hw, y - dy*hw*.1 - py*hw);
  ctx.closePath(); ctx.fill();
}

function frame(now){
  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);

  // nikal chuke arrows ki jagah chhote dots (screenshot jaisa)
  const dz = Math.max(1.2, cell * .09);
  ctx.fillStyle = 'rgba(107,74,46,.28)';
  for (const s of snakes) {
    if (!s.alive && now - s.out >= s.dur) for (const [x, y] of s.p) ctx.fillRect((x + .5) * cell - dz / 2, (y + .5) * cell - dz / 2, dz, dz);
  }

  for (const s of snakes) {
    let u = 0, lw = Math.max(1.4, cell * st.lw), col = ARROW;
    if (s.out) {                                   // raasta khula: lakeer par sarak kar nikalta hai
      const t = (now - s.out) / s.dur;
      if (t >= 1) continue;
      u = s.uEnd * t * t;
    } else if (s.bump && now - s.bump < 500) {     // takraya: lal ho kar wapis apni jagah
      u = Math.sin(Math.PI * (now - s.bump) / 500) * s.gap; col = '#d64545';
    }
    if (s.id === hintId && now < hintT) { col = '#5fa700'; lw *= 1.5; }
    const pts = slice(s.P, u, u + s.Lb);
    if (pts.length < 2) continue;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = lw; ctx.lineJoin = st.join; ctx.lineCap = 'butt'; ctx.miterLimit = 4;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0] * cell, p[1] * cell) : ctx.moveTo(p[0] * cell, p[1] * cell));
    ctx.stroke();
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    let dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    if (!dx && !dy) { dx = s.dx; dy = s.dy; }
    drawHead(b[0] * cell, b[1] * cell, dx, dy, Math.max(lw * 1.9, cell * .2));
  }
  ctx.restore();
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
  let bestS = null, bd = Math.max(cell * .6, 9);
  for (const s of snakes) {
    if (!s.alive) continue;
    if (s.p.length === 1) {
      const d = Math.hypot(x - (s.p[0][0] + .5) * cell, y - (s.p[0][1] + .5) * cell);
      if (d < bd) { bd = d; bestS = s; }
      continue;
    }
    for (let i = 1; i < s.p.length; i++) {
      const d = dseg(x, y, (s.p[i-1][0]+.5)*cell, (s.p[i-1][1]+.5)*cell, (s.p[i][0]+.5)*cell, (s.p[i][1]+.5)*cell);
      if (d < bd) { bd = d; bestS = s; }
    }
  }
  if (bestS) tap(bestS);
});

// Raasta khula ho to arrow nikalta hai (chhis awaaz).
// Raasta band ho to arrow aage jata hai, takrata hai, lal hota hai, wapis aata hai, ek boond kam.
function tap(s){
  const now = performance.now();
  if (s.out || now - s.bump < 500) return;
  const n = ray(s);
  if (n > 0) {
    s.bump = now; s.gap = Math.max(.3, n - .4);
    sBump();
    lives--; drops();
    if (lives <= 0) setTimeout(lose, 650);
    return;
  }
  sGo();
  s.alive = false; s.out = now;
  const h = s.p[s.p.length - 1];
  let k = 0, x = h[0] + s.dx, y = h[1] + s.dy;
  while (x >= 0 && y >= 0 && x < cols && y < rows) { k++; x += s.dx; y += s.dy; }
  s.uEnd = s.Lb + k + 1.5; s.dur = Math.min(900, 250 + s.uEnd * 18);
  s.p.forEach(([a, b]) => grid[b][a] = -1);
  if (snakes.every(q => !q.alive)) setTimeout(win, s.dur + 150);
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

// Naya level sirf tab khulta hai jab sab se aage wala level jeeto. Purana level jeetne se record nahi ghatta
function win(){
  clap();
  if (level >= 1000) { ov('All 1000 levels finished', 'Congratulations!', '↺', () => { level = 1; showHome(); }); return; }
  ov('Level ' + level + ' complete', 'Well played.', '▶', () => {
    if (level === best) { best++; save(); }
    level++; showHome();
  });
}
function lose(){ ov('Out of drops', 'Try this level again.', '↻', load); }

function load(){
  snakes = build(level); st = mkStyle(level); lives = 3; hintId = -1;
  $('lv').textContent = 'Level ' + level;
  drops(); layout();
}

function rest(){
  clearTimeout(restTimer);
  restTimer = setTimeout(() => ov('Time to rest', 'You played for 30 minutes. Rest and sleep well.', 'OK', rest), 30 * 60 * 1000);
}

// Home: 1 se le kar sab se aage wale khule level tak ki patti (scroll hoti hai)
function showHome(){
  $('game').hidden = true; $('home').hidden = false;
  $('plv').textContent = 'Level ' + level;
  const last = Math.min(1000, best + 4);
  let h = '';
  for (let n = 1; n <= last; n++) {
    const c = n === level ? 'cur' : n < best ? 'done' : '';
    h += `<span data-n="${n}" class="${c} ${n > best ? 'lk' : ''}">${n}</span>`;
  }
  $('strip').innerHTML = h;
  const cur = $('strip').querySelector('.cur');
  if (cur) cur.scrollIntoView({inline: 'center', block: 'nearest'});
}

function start(){
  ac();
  $('home').hidden = true; $('game').hidden = false;
  load();
  if (!looping) { looping = true; rest(); requestAnimationFrame(frame); }
}
$('play').onclick = start;
$('strip').onclick = e => {
  const n = +e.target.dataset.n;
  if (!n || n > best) return;               // jo level abhi khula nahi, wo band hai
  if (n === level) start(); else { level = n; showHome(); }
};
$('back').onclick = showHome;

window.addEventListener('resize', () => { if (!$('game').hidden) layout(); });

setTimeout(() => { $('splash').hidden = true; showHome(); }, 3000);
