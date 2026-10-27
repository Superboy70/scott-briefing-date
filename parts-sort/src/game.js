// 부품함 정리 — 화면·입력·저장. 규칙은 core.js(Core), 레벨은 빌드 때 넣는 LEVELS, 버전은 APP_VERSION.
(function () {
  'use strict';
  const CAP = Core.CAP;
  const COLORS = [ // 저항 색띠 코드 0~9: [이름, 색, 글자색]
    ['검정', '#17191a', '#e8e8e8'], ['갈색', '#8a4b24', '#f6e7da'], ['빨강', '#d93a2f', '#fff1ee'],
    ['주황', '#ef7d1a', '#2a1605'], ['노랑', '#f3d02b', '#2b2405'], ['초록', '#3ea052', '#effaf1'],
    ['파랑', '#2f6fd6', '#eef3ff'], ['보라', '#8b4bc9', '#f6eeff'], ['회색', '#9aa1a6', '#1d2124'],
    ['흰색', '#f2f2ec', '#25282a'],
  ];
  const SAVE_KEY = 'partsSort.save.v1';
  const q = new URLSearchParams(location.search);
  const MUTE = q.get('mute') === '1';
  const $ = (id) => document.getElementById(id);

  // ---- 저장 (없거나 막혀도 게임은 돈다) ----
  function load() {
    const d = { v: 1, unlocked: 1, best: {}, sound: true };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { return d; }
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 저장 불가 환경 */ } }
  const data = load();

  // ---- 소리 (첫 터치 뒤 코드로 합성) ----
  let ac = null;
  function tone(f, t0, dur, type, vol) {
    if (MUTE || !data.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (t0 || 0);
      o.type = type || 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 소리 없는 환경 */ }
  }
  const sfx = {
    pick: () => tone(660, 0, 0.05),
    drop: () => tone(440, 0, 0.07),
    full: () => { tone(880, 0, 0.12, 'sine'); tone(1320, 0.07, 0.16, 'sine', 0.08); },
    win: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.09, 0.22, 'sine', 0.1)),
    no: () => tone(150, 0, 0.08, 'square', 0.05),
  };
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 진동 없음 */ } };

  // ---- 상태 ----
  let lv = null;          // 지금 레벨 정보
  let s = [];             // 부품함 문자열 배열(core 형식)
  let ids = [];           // 같은 모양의 부품 id 배열(움직임 연출용)
  let hist = [];          // 되돌리기용 [s, ids]
  let sel = -1, moves = 0, hints = 0, busy = false;
  const els = {};         // id → 부품 요소
  let geo = null;         // 칸 위치·크기

  const board = $('board');

  function startLevel(n, keep) {
    lv = LEVELS[Math.max(1, Math.min(LEVELS.length, n)) - 1];
    s = keep ? keep.s : lv.start.slice();
    let uid = 0;
    ids = s.map((t) => Array.from(t, () => uid++));
    hist = []; sel = -1; moves = keep ? keep.moves : 0; hints = 0; busy = false;
    board.innerHTML = '';
    for (const k in els) delete els[k];
    s.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bin'; b.dataset.i = i; b.dataset.label = String.fromCharCode(65 + i);
      b.setAttribute('aria-label', `${b.dataset.label} 칸`);
      board.appendChild(b);
    });
    s.forEach((t, i) => Array.from(t).forEach((c, k) => {
      const p = document.createElement('div');
      const col = COLORS[+c];
      p.className = 'piece';
      p.style.setProperty('--c', col[1]); p.style.setProperty('--t', col[2]);
      p.innerHTML = `<i>${c}</i>`;
      board.appendChild(p);
      els[ids[i][k]] = p;
    }));
    $('o-win').hidden = true;
    $('tag').hidden = lv.kind !== 'hard';
    $('tag').textContent = lv.empties === 1 ? '고비 레벨 · 빈 칸이 하나뿐' : '고비 레벨 · 색이 많음';
    const used = new Set(lv.start.join(''));
    document.querySelectorAll('#code div').forEach((d, k) => d.classList.toggle('on', used.has(String(k))));
    layout(true);
    render();
  }

  // 칸 배치: 6칸 이하는 한 줄, 넘으면 두 줄
  function layout(instant) {
    const W = board.clientWidth, H = board.clientHeight, n = s.length;
    const rows = n > 6 ? 2 : 1, per = Math.ceil(n / rows);
    const gap = Math.max(8, Math.min(16, W * 0.03));
    // 칸 높이 = 부품 4개 + 들어 올릴 자리, 줄 사이 28px(라벨 포함)
    const dims = (w) => { const pH = w * 0.42, bh = pH * CAP + 8, lift = pH * 1.15; return { pH, bh, lift, total: rows * (bh + lift) + (rows - 1) * 28 + 18 }; };
    let bw = Math.min(78, (W - gap * (per - 1)) / per);
    while (dims(bw).total > H && bw > 34) bw -= 2; // 화면 높이에 맞춰 줄임
    const { pH, bh, lift, total } = dims(bw);
    const y0 = Math.max(0, (H - total) / 2);
    geo = { bw, bh, pH, lift, pos: [] };
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / per), inRow = r === rows - 1 ? n - per * (rows - 1) : per, c = i - r * per;
      const rowW = inRow * bw + (inRow - 1) * gap;
      const x = (W - rowW) / 2 + c * (bw + gap);
      const y = y0 + r * (bh + lift + 28) + lift;
      geo.pos.push([x, y]);
      const b = board.children[i];
      b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.width = bw + 'px'; b.style.height = bh + 'px';
    }
    for (const k in els) { els[k].style.width = bw + 'px'; els[k].style.height = pH + 'px'; els[k].querySelector('i').style.fontSize = Math.max(10, pH * 0.5) + 'px'; }
    if (instant) for (const k in els) els[k].style.transition = 'none';
    placeAll();
    if (instant) requestAnimationFrame(() => { for (const k in els) els[k].style.transition = ''; });
  }

  const slotY = (i, k) => geo.pos[i][1] + geo.bh - 4 - (k + 1) * geo.pH;
  function put(id, x, y) { els[id].style.transform = `translate(${x}px, ${y}px)`; }

  function placeAll() {
    const run = sel >= 0 ? Core.topRun(s[sel]) : 0;
    ids.forEach((col, i) => col.forEach((id, k) => {
      const up = i === sel && k >= col.length - run ? geo.lift : 0;
      put(id, geo.pos[i][0], slotY(i, k) - up);
    }));
  }

  function render() {
    $('s-lvl').textContent = lv.n;
    $('s-moves').textContent = moves;
    $('s-opt').textContent = lv.opt;
    $('b-undo').disabled = !hist.length || busy;
    [...board.querySelectorAll('.bin')].forEach((b, i) => {
      b.classList.toggle('sel', i === sel);
      b.classList.toggle('full', s[i].length === CAP && Core.uniform(s[i]));
    });
  }

  // 게임에서 허용하는 수(해결기보다 느슨함: 한 색 칸을 빈 칸으로 옮기는 것도 허용)
  function allowed(i, j) {
    const a = s[i], b = s[j];
    return i !== j && a.length > 0 && b.length < CAP && (!b.length || b[b.length - 1] === a[a.length - 1]);
  }

  function doMove(i, j) {
    const n = Core.moveCount(s, i, j);
    hist.push([s.slice(), ids.map((c) => c.slice())]);
    const moving = ids[i].splice(ids[i].length - n, n);
    ids[j].push(...moving);
    s = Core.apply(s, i, j);
    moves++; sel = -1; busy = true;
    // 연출: 들어 올림 → 대상 칸 위로 → 내려놓음
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const topY = Math.min(geo.pos[i][1], geo.pos[j][1]) - geo.lift;
    moving.forEach((id, k) => put(id, geo.pos[i][0], topY - k * geo.pH));
    const finish = () => {
      placeAll(); busy = false; sfx.drop(); buzz(8);
      if (s[j].length === CAP && Core.uniform(s[j])) { sfx.full(); buzz(20); }
      render();
      if (Core.isSolved(s)) setTimeout(win, 260);
    };
    if (reduce) { finish(); return; }
    setTimeout(() => {
      moving.forEach((id, k) => put(id, geo.pos[j][0], topY - k * geo.pH));
      setTimeout(finish, 140);
    }, 140);
    render();
  }

  function tap(i) {
    if (busy || !$('o-win').hidden) return;
    if (sel < 0) {
      if (!s[i].length) return;
      sel = i; sfx.pick();
    } else if (sel === i) {
      sel = -1;
    } else if (allowed(sel, i)) {
      doMove(sel, i); return;
    } else {
      sfx.no();
      sel = s[i].length ? i : -1;
    }
    placeAll(); render();
  }

  function undo() {
    if (busy || !hist.length) return;
    [s, ids] = hist.pop();
    moves++; // 되돌리기도 한 수로 센다(최소 수 비교를 정직하게)
    sel = -1; placeAll(); render();
  }

  function hint() {
    if (busy) return;
    const mv = Core.hint(s);
    if (!mv) return;
    hints++;
    const bins = board.querySelectorAll('.bin');
    bins.forEach((b) => b.classList.remove('hint'));
    sel = mv[0]; placeAll(); render();
    bins[mv[1]].classList.add('hint');
    setTimeout(() => bins[mv[1]] && bins[mv[1]].classList.remove('hint'), 1900);
  }

  function starsOf(m, opt) { return m <= opt ? 3 : m <= opt + Math.ceil(opt * 0.25) ? 2 : 1; }

  function win() {
    sfx.win(); buzz([20, 40, 20]);
    const st = starsOf(moves, lv.opt);
    const prev = data.best[lv.n];
    if (!prev || moves < prev) data.best[lv.n] = moves;
    data.unlocked = Math.max(data.unlocked, Math.min(LEVELS.length, lv.n + 1));
    save();
    $('w-stars').innerHTML = '★'.repeat(st) + '<s>' + '★'.repeat(3 - st) + '</s>';
    $('w-text').textContent = `${moves}수로 정리했습니다. 최소 ${lv.opt}수` +
      (hints ? ` · 힌트 ${hints}번` : '') + (st < 3 ? `. 별 3개는 ${lv.opt}수 이내.` : '.');
    $('w-next').hidden = lv.n >= LEVELS.length;
    $('o-win').hidden = false;
    $('w-next').focus();
  }

  function openLevels() {
    const g = $('l-grid'); g.innerHTML = '';
    LEVELS.forEach((l) => {
      const b = document.createElement('button');
      const best = data.best[l.n], st = best ? starsOf(best, l.opt) : 0;
      b.type = 'button'; b.className = 'btn' + (l.kind === 'hard' ? ' hard' : '') + (l.n === lv.n ? ' cur' : '');
      b.disabled = l.n > data.unlocked && !q.has('level');
      b.innerHTML = `${l.n}<small>${'★'.repeat(st)}</small>`;
      b.onclick = () => { $('o-levels').hidden = true; startLevel(l.n); };
      g.appendChild(b);
    });
    $('l-sound').textContent = data.sound ? '소리 켬' : '소리 끔';
    $('o-levels').hidden = false;
  }

  // ---- 연결 ----
  $('code').innerHTML = COLORS.map((c, k) => `<div><b style="--c:${c[1]}"></b>${k} ${c[0]}</div>`).join('');
  board.addEventListener('click', (e) => { const b = e.target.closest('.bin'); if (b) tap(+b.dataset.i); });
  $('b-undo').onclick = undo;
  $('b-reset').onclick = () => { if (!busy) startLevel(lv.n); };
  $('b-hint').onclick = hint;
  $('b-levels').onclick = openLevels;
  $('l-close').onclick = () => { $('o-levels').hidden = true; };
  $('l-sound').onclick = () => { data.sound = !data.sound; save(); $('l-sound').textContent = data.sound ? '소리 켬' : '소리 끔'; };
  $('w-retry').onclick = () => startLevel(lv.n);
  $('w-next').onclick = () => startLevel(lv.n + 1);
  addEventListener('resize', () => lv && layout(true));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('o-levels').hidden = true; sel = -1; placeAll(); render(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
  });

  // 텔레그램 미니앱 안이면 전체 높이로(스크립트는 텔레그램이 넣어 줄 때만 존재)
  try { const tg = window.Telegram && Telegram.WebApp; if (tg) { tg.ready(); tg.expand(); } } catch (e) { /* 텔레그램 밖 */ }

  // 시험용: ?level=N 으로 바로 시작, 스모크·봇은 window.__game 사용
  window.__game = {
    version: APP_VERSION,
    get level() { return lv.n; }, get state() { return s.slice(); }, get moves() { return moves; },
    tap, solution: () => (Core.solve(s).path || []), won: () => !$('o-win').hidden,
  };

  // 아티팩트 재게시 때 지금 판을 이어서
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ n: lv && lv.n, s, moves }));
  function boot(prev) {
    const n = +q.get('level') || (prev && prev.n) || Math.min(data.unlocked, LEVELS.length);
    startLevel(n, prev && prev.n === n && prev.s ? { s: prev.s, moves: prev.moves || 0 } : null);
  }
  if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data);
})();
