// 재미 지표 보고: src/levels.json을 목표 구간(tools/curve.js)에 비춰 판정한다.
// 실행: node tools/fun_report.js [--save]  → --save면 tools/results.csv에 한 줄 추가
const fs = require('fs');
const path = require('path');
const { specOf } = require('./curve.js');

const root = path.join(__dirname, '..');
const levels = JSON.parse(fs.readFileSync(path.join(root, 'src', 'levels.json'), 'utf8'));
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();

const out = [];
let inBand = 0, saw = 0, sawTotal = 0;
for (const l of levels) {
  const [lo, hi] = specOf(l.n).band;
  const ok = l.novice >= lo && l.novice <= hi;
  if (ok) inBand++;
  let note = ok ? '' : `구간 밖(${lo}~${hi})`;
  if (l.kind === 'hard' && levels[l.n]) { // 톱니: 고비 다음 레벨은 고비보다 쉬워야 함
    sawTotal++;
    if (levels[l.n].novice > l.novice) saw++; else note += ' 톱니 깨짐';
  }
  out.push(`${String(l.n).padStart(2)} ${l.kind.padEnd(6)} 최소 ${String(l.opt).padStart(2)}수  초보 ${(l.novice * 100).toFixed(0).padStart(3)}%  막힘 ${(l.deadEnd * 100).toFixed(0).padStart(3)}%  ${ok ? '○' : '✕'} ${note}`);
}
const first = levels[0].opt;
console.log(out.join('\n'));
console.log(`\n목표 구간 안: ${inBand}/${levels.length} · 톱니 유지: ${saw}/${sawTotal} · 1레벨 최소 수: ${first}(목표 ≤10)`);

if (process.argv.includes('--save')) {
  const csv = path.join(__dirname, 'results.csv');
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'date,version,levels,in_band,sawtooth_ok,sawtooth_total,level1_opt,hard_novice_avg\n');
  const hard = levels.filter((l) => l.kind === 'hard');
  const hardAvg = hard.reduce((a, l) => a + l.novice, 0) / (hard.length || 1);
  const date = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
  fs.appendFileSync(csv, [date, version, levels.length, inBand, saw, sawTotal, first, hardAvg.toFixed(3)].join(',') + '\n');
  console.log(`→ tools/results.csv에 한 줄 추가`);
}
