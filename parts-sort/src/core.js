// 부품함 정리 — 규칙·해결기·생성기·초보 봇. 게임(브라우저)과 도구(node)가 같은 파일을 쓴다.
// 상태 = 부품함 문자열 배열. 문자 하나 = 부품 하나(저항 색띠 숫자 '0'~'9'), 왼쪽이 바닥.
(function (root) {
  'use strict';
  const CAP = 4;

  const last = (t) => t[t.length - 1];

  function topRun(t) {
    if (!t) return 0;
    const c = last(t);
    let n = 0;
    for (let k = t.length - 1; k >= 0 && t[k] === c; k--) n++;
    return n;
  }

  const uniform = (t) => t.length > 0 && topRun(t) === t.length;
  const done = (t) => t.length === 0 || (t.length === CAP && uniform(t));
  const isSolved = (s) => s.every(done);

  function canMove(s, i, j) {
    if (i === j) return false;
    const a = s[i], b = s[j];
    if (!a || b.length >= CAP) return false;
    if (b.length && last(b) !== last(a)) return false;
    if (done(a)) return false;                 // 이미 다 찬 칸은 건드리지 않는다
    if (!b.length && uniform(a)) return false; // 한 색뿐인 칸을 빈 칸으로 옮기는 건 의미 없음
    return true;
  }

  function legalMoves(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) for (let j = 0; j < s.length; j++) if (canMove(s, i, j)) out.push([i, j]);
    // 빈 칸이 여러 개면 첫 빈 칸으로 가는 수만 남긴다(같은 결과)
    const firstEmpty = s.findIndex((t) => !t.length);
    return out.filter(([, j]) => s[j].length || j === firstEmpty);
  }

  // 옮겨지는 개수 = 맨 위 같은 색 묶음 중 들어갈 만큼
  function moveCount(s, i, j) {
    return Math.min(topRun(s[i]), CAP - s[j].length);
  }

  function apply(s, i, j) {
    const n = moveCount(s, i, j);
    const r = s.slice();
    r[j] = s[j] + s[i].slice(s[i].length - n);
    r[i] = s[i].slice(0, s[i].length - n);
    return r;
  }

  const key = (s) => s.slice().sort().join('|');

  function colorCount(s) {
    return new Set(s.join('')).size;
  }

  // 남은 최소 수의 하한: 한 수로 줄일 수 있는 색 묶음은 최대 1개
  function h(s, colors) {
    let runs = 0;
    for (const t of s) {
      if (!t.length) continue;
      runs++;
      for (let k = 1; k < t.length; k++) if (t[k] !== t[k - 1]) runs++;
    }
    return runs - colors;
  }

  // 최소 힙
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(x) {
      const a = this.a; a.push(x);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a, top = a[0], x = a.pop();
      if (a.length) {
        a[0] = x; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
        }
      }
      return top;
    }
  }

  // A*. w=1이면 최소 수, w>1이면 빠르지만 최소가 아닐 수 있음.
  // 결과 { path: [[i,j],...] | null, nodes, exhausted }
  function solve(start, opt) {
    const o = Object.assign({ w: 1, maxNodes: 300000 }, opt);
    const colors = colorCount(start);
    if (isSolved(start)) return { path: [], nodes: 0, exhausted: false };
    const seen = new Map([[key(start), 0]]);
    const heap = new Heap();
    heap.push({ s: start, g: 0, f: o.w * h(start, colors), prev: null, mv: null });
    let nodes = 0;
    while (heap.size) {
      const n = heap.pop();
      if (++nodes > o.maxNodes) return { path: null, nodes, exhausted: true };
      for (const [i, j] of legalMoves(n.s)) {
        const s2 = apply(n.s, i, j), g = n.g + 1, k = key(s2);
        if (seen.has(k) && seen.get(k) <= g) continue;
        seen.set(k, g);
        const node = { s: s2, g, f: g + o.w * h(s2, colors), prev: n, mv: [i, j] };
        if (isSolved(s2)) {
          const path = [];
          for (let p = node; p.mv; p = p.prev) path.push(p.mv);
          return { path: path.reverse(), nodes, exhausted: false };
        }
        heap.push(node);
      }
    }
    return { path: null, nodes, exhausted: false }; // 풀 수 없음
  }

  // 힌트: 최소 해를 먼저 시도하고, 오래 걸리면 빠른 해
  function hint(s) {
    let r = solve(s, { maxNodes: 40000 });
    if (!r.path && r.exhausted) r = solve(s, { w: 3, maxNodes: 120000 });
    return r.path && r.path.length ? r.path[0] : null;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 색 colors개, 빈 칸 empties개. 시작부터 다 찬 칸이 있으면 다시 섞는다.
  function generate(colors, seed, empties) {
    const r = rng(seed);
    const palette = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let k = palette.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [palette[k], palette[m]] = [palette[m], palette[k]]; }
    const use = palette.slice(0, colors);
    for (let tries = 0; tries < 100; tries++) {
      const balls = [];
      for (const c of use) for (let k = 0; k < CAP; k++) balls.push(c);
      for (let k = balls.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [balls[k], balls[m]] = [balls[m], balls[k]]; }
      const s = [];
      for (let t = 0; t < colors; t++) s.push(balls.slice(t * CAP, t * CAP + CAP).join(''));
      for (let e = 0; e < (empties == null ? 2 : empties); e++) s.push('');
      if (s.some((t) => /(.)\1\1/.test(t))) continue; // 같은 색 3개가 붙은 칸(거의 정리된 칸)은 피함
      return s;
    }
    return null;
  }

  // 초보 봇: 앞을 안 보고 둔다. 같은 색 위로 놓는 수를 3배 선호, 방금 수를 바로 되돌리지 않음, 되돌리기 없음.
  function novice(start, rand, maxMoves) {
    let s = start, prev = null, moves = 0;
    const visits = new Map();
    while (moves < (maxMoves || 120)) {
      if (isSolved(s)) return { solved: true, moves, end: 'solved' };
      let ms = legalMoves(s).filter(([i, j]) => !(prev && i === prev[1] && j === prev[0]));
      if (!ms.length) return { solved: false, moves, end: 'stuck' };
      const w = ms.map(([, j]) => (s[j].length ? 3 : 1));
      let x = rand() * w.reduce((a, b) => a + b, 0), pick = ms[0];
      for (let k = 0; k < ms.length; k++) { x -= w[k]; if (x <= 0) { pick = ms[k]; break; } }
      s = apply(s, pick[0], pick[1]); prev = pick; moves++;
      const k = key(s), v = (visits.get(k) || 0) + 1;
      visits.set(k, v);
      if (v > 3) return { solved: false, moves, end: 'loop' };
    }
    return { solved: false, moves, end: 'long' };
  }

  // 레벨 하나의 재미 지표
  function measure(start, trials, seed) {
    const best = solve(start);
    const rand = rng(seed || 1);
    let solved = 0, stuck = 0;
    const lens = [];
    for (let k = 0; k < (trials || 200); k++) {
      const r = novice(start, rand);
      if (r.solved) { solved++; lens.push(r.moves); } else if (r.end === 'stuck') stuck++;
    }
    lens.sort((a, b) => a - b);
    const fails = (trials || 200) - solved;
    return {
      opt: best.path ? best.path.length : null,
      nodes: best.nodes,
      novice: solved / (trials || 200),
      noviceMedian: lens.length ? lens[lens.length >> 1] : null,
      deadEnd: fails ? stuck / fails : 0,
    };
  }

  const Core = { CAP, topRun, uniform, done, isSolved, canMove, legalMoves, moveCount, apply, key, solve, hint, rng, generate, novice, measure };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
