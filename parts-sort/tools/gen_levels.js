// 레벨 생성: 레벨마다 후보 여러 개를 만들고 → 해결기로 풀리는지 확인 → 재미 지표가 목표 구간에 가장 가까운 것을 고른다.
// 실행: node tools/gen_levels.js [--cands 16]  → src/levels.json
const fs = require('fs');
const path = require('path');
const Core = require('../src/core.js');
const { LEVELS, specOf } = require('./curve.js');

const arg = (name, def) => { const k = process.argv.indexOf(name); return k > 0 ? process.argv[k + 1] : def; };
const CANDS = Number(arg('--cands', 16));

function score(m, band, kind) {
  const [lo, hi] = band;
  if (kind === 'hard') return m.novice;                  // 고비는 낮을수록 좋음
  if (m.novice >= lo && m.novice <= hi) return Math.abs(m.novice - (lo + hi) / 2) * 0.1;
  return m.novice < lo ? lo - m.novice : m.novice - hi;
}

const levels = [];
for (let n = 1; n <= LEVELS; n++) {
  const sp = specOf(n);
  let best = null;
  for (let k = 0; k < CANDS; k++) {
    const seed = n * 1000 + k;
    const start = Core.generate(sp.colors, seed, sp.empties);
    if (!start) continue;
    const m = Core.measure(start, 200, seed);
    if (m.opt == null) continue; // 풀 수 없는 배치는 버림
    const sc = score(m, sp.band, sp.kind);
    if (!best || sc < best.sc) best = { sc, seed, start, m };
  }
  if (!best) throw new Error(`레벨 ${n}: 풀리는 후보가 없음 (색 ${sp.colors}, 빈 칸 ${sp.empties})`);
  const r = best.m;
  levels.push({ n, kind: sp.kind, colors: sp.colors, empties: sp.empties, seed: best.seed, start: best.start,
    opt: r.opt, novice: +r.novice.toFixed(3), noviceMedian: r.noviceMedian, deadEnd: +r.deadEnd.toFixed(3) });
  console.log(`${String(n).padStart(2)} ${sp.kind.padEnd(6)} 색${sp.colors} 빈${sp.empties}  최소 ${String(r.opt).padStart(2)}수  초보 ${(r.novice * 100).toFixed(0).padStart(3)}%`);
}

const out = path.join(__dirname, '..', 'src', 'levels.json');
fs.writeFileSync(out, '[\n' + levels.map((l) => JSON.stringify(l)).join(',\n') + '\n]\n');
console.log(`→ ${path.relative(process.cwd(), out)} (${levels.length}레벨)`);
