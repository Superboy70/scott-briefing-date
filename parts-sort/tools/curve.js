// 레벨 곡선과 재미 지표 목표 구간 — docs/PLAN.md "목표 숫자"와 같게 유지한다.
// novice = 초보 봇(앞을 안 보고 두는 봇) 200판 해결률. 낮을수록 "생각해야 풀리는" 레벨.
const BANDS = {
  intro: [0.8, 1.0],  // 도입: 아무렇게나 둬도 대부분 풀림 → 규칙만 익힘
  normal: [0.3, 0.8], // 일반: 절반쯤은 생각해야 풀림
  late: [0.1, 0.4],   // 후반 일반
  hard: [0, 0.15],    // 고비(5의 배수, 10부터): 수를 읽어야만 풀림
};

// [레벨 번호부터, 색 수, 빈 칸 수, 종류]
const PLAN = [
  [1, 3, 2, 'intro'], [4, 4, 2, 'intro'], [6, 5, 2, 'normal'],
  [10, 5, 1, 'hard'], [11, 6, 2, 'normal'], [15, 6, 1, 'hard'],
  [16, 7, 2, 'normal'], [20, 8, 2, 'hard'], [21, 8, 2, 'late'],
  [25, 7, 1, 'hard'], [26, 9, 2, 'late'], [30, 6, 1, 'hard'],
];
const LEVELS = 30;

function specOf(n) {
  let row = PLAN[0];
  for (const r of PLAN) if (r[0] <= n) row = r;
  return { n, colors: row[1], empties: row[2], kind: row[3], band: BANDS[row[3]] };
}

module.exports = { BANDS, PLAN, LEVELS, specOf };
