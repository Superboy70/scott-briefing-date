'use strict';
// ===== 공통 상수 / 유틸 =====
const APP_VERSION = '1.2.0';
const TILE = 16, VH = 270, ROWS = 17, GRAV = 900;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function wpick(obj) {
  let tot = 0;
  for (const k in obj) tot += obj[k];
  let r = Math.random() * tot;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ===== 직업 =====
const CLASSES = {
  paladin: {
    name: '성기사', eng: 'PALADIN',
    desc: '두꺼운 판금 갑옷의 성전사. 창과 도끼에 능하며 신성한 힘으로 갑옷을 복구한다.',
    base: { str: 25, dex: 20, vit: 25, ene: 15 },
    weapon: 'lance', affinity: ['lance', 'axe'],
    skills: ['smite', 'holyShield'],
    matchup: '창·도끼 공격과 심판의 일격이 신성 피해 → 언데드·악마·영체에 강함',
    colors: { armor: '#c3cbd9', trim: '#d9a93e', cape: '#8a1e1e' },
  },
  sorc: {
    name: '소서리스', eng: 'SORCERESS',
    desc: '원소 마법의 대가. 몸은 약하지만 서리 구체와 순간이동으로 전장을 지배한다.',
    base: { str: 10, dex: 25, vit: 15, ene: 35 },
    weapon: 'orb', affinity: ['orb', 'torch'],
    skills: ['frozenOrb', 'teleport'],
    matchup: '마법구=마법(영체에 강함), 횃불=화염(야수에 강함), 서리 구체=냉기(악마에 강함)',
    colors: { armor: '#6b43a8', trim: '#e0c060', cape: '#2e2266' },
  },
  necro: {
    name: '네크로맨서', eng: 'NECROMANCER',
    desc: '죽음을 다루는 강령술사. 해골 병사를 일으키고 뼈 창으로 적을 꿰뚫는다.',
    base: { str: 15, dex: 25, vit: 20, ene: 25 },
    weapon: 'dagger', affinity: ['dagger', 'orb'],
    skills: ['raiseSkel', 'boneSpear'],
    matchup: '단검=독(야수에 강함, 언데드엔 다소 약함), 뼈 창=마법(영체에 강함), 해골=물리',
    colors: { armor: '#4d5059', trim: '#9fe08f', cape: '#1c2a1c' },
  },
};

// ===== 무기 타입 (마계촌식 투척 무기) =====
const WEAPON_TYPES = {
  lance:  { name: '창',    spd: 330, vy: 0,    grav: 0,   cd: 0.30, max: 3, pierce: 0, mult: 1.0, w: 14, h: 3, icon: '🗡️' },
  dagger: { name: '단검',  spd: 420, vy: 0,    grav: 0,   cd: 0.17, max: 4, pierce: 0, mult: 0.65, w: 8, h: 3, icon: '🔪' },
  axe:    { name: '도끼',  spd: 190, vy: -230, grav: 700, cd: 0.45, max: 2, pierce: 2, mult: 1.35, w: 10, h: 10, icon: '🪓' },
  torch:  { name: '횃불',  spd: 170, vy: -140, grav: 700, cd: 0.42, max: 2, pierce: 0, mult: 1.0, w: 8, h: 8, icon: '🔥' },
  orb:    { name: '마법구', spd: 210, vy: 0,    grav: 0,   cd: 0.38, max: 3, pierce: 0, mult: 1.1, w: 8, h: 8, icon: '🔮' },
};

// ===== 스킬 =====
const SKILLS = {
  smite: {
    name: '심판의 일격', icon: '✝', cd: 0.55,
    mana: lv => 4 + lv,
    desc: lv => `전방을 신성한 힘으로 강타. 무기 피해 ${150 + lv * 25}%, 기절 0.6초.`,
  },
  holyShield: {
    name: '신성 방패', icon: '🛡', cd: 10,
    mana: lv => 14 + lv * 2,
    desc: lv => `갑옷 내구도를 ${30 + lv * 6}% 복구하고 8초간 받는 피해 -${18 + lv * 3}%.`,
  },
  frozenOrb: {
    name: '서리 구체', icon: '❄', cd: 0.9,
    mana: lv => 9 + lv * 1.5,
    desc: lv => `얼음 파편을 흩뿌리는 구체. 파편당 ${8 + lv * 6} 냉기 피해, 둔화.`,
  },
  teleport: {
    name: '순간이동', icon: '✧', cd: 0.7,
    mana: lv => Math.max(4, 10 - lv),
    desc: lv => `바라보는 방향으로 ${90 + lv * 8}px 순간이동. 잠시 무적.`,
  },
  raiseSkel: {
    name: '해골 소환', icon: '☠', cd: 0.9,
    mana: lv => 10 + lv,
    desc: lv => `해골 전사 소환 (최대 ${Math.min(6, 1 + Math.floor((lv + 1) / 2))}). 생명력 ${25 + lv * 18}.`,
  },
  boneSpear: {
    name: '뼈 창', icon: '➶', cd: 0.33,
    mana: lv => 5 + lv,
    desc: lv => `모든 적을 관통하는 뼈 창. ${12 + lv * 9} 마법 피해.`,
  },
};

// ===== 막(Act)과 지역 =====
const ACTS = [
  {
    name: '제1막 · 저주받은 묘지', music: 'act0',
    stages: ['버려진 묘역', '까마귀 언덕', '무덤군주의 납골당'],
    boss: 'graveLord',
    sky: ['#1a1030', '#3a2440'], moon: '#e8e0c0', far: '#221830', mid: '#2e2034',
    groundTop: '#4a5a2a', ground: '#3a2c20', groundDark: '#241a12', deco: 'grave', pit: 'void',
    enemies: { zombie: 6, crow: 3, archer: 2, skeleton: 2 },
  },
  {
    name: '제2막 · 망자의 숲', music: 'act1',
    stages: ['안개 늪', '썩은 나무숲', '거미 여왕의 둥지'],
    boss: 'spiderQueen',
    sky: ['#0c1a1a', '#1f3a30'], moon: '#bfe0c8', far: '#10241c', mid: '#183024',
    groundTop: '#2f4a2a', ground: '#2a2418', groundDark: '#18140c', deco: 'tree', pit: 'swamp',
    enemies: { ghost: 3, plant: 3, spider: 3, zombie: 2, bat: 2 },
  },
  {
    name: '제3막 · 화염 성채', music: 'act2',
    stages: ['용암 다리', '불타는 성벽', '화염마왕의 옥좌'],
    boss: 'flameTyrant',
    sky: ['#2a0808', '#6a1a08'], moon: '#ffb060', far: '#3a0e08', mid: '#4a1408',
    groundTop: '#6a5048', ground: '#3a2a26', groundDark: '#221614', deco: 'castle', pit: 'lava',
    enemies: { imp: 4, demon: 1, archer: 2, knight: 2, skeleton: 2 },
  },
  {
    name: '제4막 · 혼돈의 성역', music: 'act3',
    stages: ['지옥의 문', '저주받은 회랑', '공포의 군주'],
    boss: 'terrorLord',
    sky: ['#12020a', '#3a0620'], moon: '#ff4060', far: '#200414', mid: '#2e0a1a',
    groundTop: '#5a2030', ground: '#2e1418', groundDark: '#1a0a0c', deco: 'spike', pit: 'lava',
    enemies: { knight: 3, demon: 2, ghost: 2, imp: 2, skeleton: 2 },
  },
];
const STAGE_COUNT = ACTS.length * 3;
const stageInfo = i => ({ act: Math.floor(i / 3), st: i % 3, name: ACTS[Math.floor(i / 3)].stages[i % 3] });

// ===== 난이도 (마계촌처럼 2회차가 진짜) =====
const DIFFS = [
  { name: '노말', hp: 1.0, dmg: 1.0, exp: 1.0, lvl: 0, color: '#e6dcc8' },
  { name: '나이트메어', hp: 1.6, dmg: 1.35, exp: 1.6, lvl: 22, color: '#ffae40' },
  { name: '헬', hp: 2.4, dmg: 1.8, exp: 2.4, lvl: 45, color: '#ff4a3a' },
];

// ===== 몬스터 =====
const ENEMIES = {
  zombie:   { name: '좀비',      w: 12, h: 22, hp: 18, dmg: 6,  spd: 26, exp: 6,  ai: 'walker', rise: true },
  skeleton: { name: '해골 전사', w: 12, h: 22, hp: 22, dmg: 8,  spd: 44, exp: 8,  ai: 'walker' },
  crow:     { name: '까마귀',    w: 12, h: 8,  hp: 8,  dmg: 5,  spd: 90, exp: 5,  ai: 'flyer', fly: true },
  bat:      { name: '흡혈 박쥐', w: 12, h: 8,  hp: 10, dmg: 6,  spd: 100, exp: 6, ai: 'flyer', fly: true },
  archer:   { name: '해골 궁수', w: 12, h: 22, hp: 16, dmg: 7,  spd: 0,  exp: 9,  ai: 'archer' },
  ghost:    { name: '망령',      w: 14, h: 18, hp: 20, dmg: 9,  spd: 30, exp: 10, ai: 'ghost', fly: true },
  plant:    { name: '식인 식물', w: 14, h: 20, hp: 26, dmg: 8,  spd: 0,  exp: 10, ai: 'plant' },
  spider:   { name: '독거미',    w: 14, h: 10, hp: 14, dmg: 7,  spd: 80, exp: 7,  ai: 'spider' },
  imp:      { name: '화염 임프', w: 12, h: 16, hp: 20, dmg: 9,  spd: 60, exp: 11, ai: 'imp' },
  demon:    { name: '붉은 악마', w: 18, h: 20, hp: 60, dmg: 13, spd: 150, exp: 40, ai: 'demon', fly: true },
  knight:   { name: '악마 기사', w: 16, h: 26, hp: 70, dmg: 14, spd: 30, exp: 25, ai: 'knight' },
  spiderling: { name: '새끼 거미', w: 10, h: 8, hp: 8, dmg: 5, spd: 95, exp: 3, ai: 'spider' },
  // 보스
  graveLord:   { name: '무덤군주 바르곤',   w: 40, h: 54, hp: 520,  dmg: 16, spd: 34, exp: 600,  ai: 'graveLord', boss: true },
  spiderQueen: { name: '거미 여왕 아라크네', w: 54, h: 30, hp: 820,  dmg: 18, spd: 70, exp: 1100, ai: 'spiderQueen', boss: true },
  flameTyrant: { name: '화염마왕 이그니스', w: 44, h: 44, hp: 1150, dmg: 22, spd: 70, exp: 1800, ai: 'flameTyrant', boss: true, fly: true },
  terrorLord:  { name: '공포의 군주 모르가스', w: 50, h: 64, hp: 1800, dmg: 28, spd: 40, exp: 3200, ai: 'terrorLord', boss: true },
};

const ELITE_AFFIX = {
  fast:   { name: '빠름' },
  strong: { name: '극도로 강함' },
  stone:  { name: '돌 피부' },
  fire:   { name: '화염 강화' },
  cold:   { name: '냉기 강화' },
};
const ELITE_NAMES = ['피투성이', '썩은', '저주받은', '굶주린', '뒤틀린', '검은', '비명의', '광란의', '고대의', '재앙의'];
const ELITE_NOUNS = ['송곳니', '해골', '그림자', '살점', '뼈', '어금니', '눈알', '발톱'];

function monsterLevel(stageIdx, diff) {
  return Math.round(1 + stageIdx * 2.2 + DIFFS[diff].lvl);
}
function expToNext(lvl) { return Math.floor(50 * Math.pow(lvl, 1.8)); }

// ===== 상성 (피해 속성 × 몬스터 계열) =====
const DMG_TYPES = {
  phys:   { name: '물리', color: '#e8e8e8' },
  holy:   { name: '신성', color: '#ffe07a' },
  fire:   { name: '화염', color: '#ff8040' },
  cold:   { name: '냉기', color: '#9fd8ff' },
  light:  { name: '번개', color: '#ffff80' },
  magic:  { name: '마법', color: '#c8a0ff' },
  poison: { name: '독',   color: '#8fe070' },
};
const FAMILIES = {
  undead: { name: '언데드', mult: { holy: 1.5, fire: 1.25, cold: 0.75, poison: 0.75 } },
  beast:  { name: '야수',   mult: { fire: 1.5, cold: 1.25, poison: 1.5 } },
  spirit: { name: '영체',   mult: { phys: 0.5, holy: 1.5, light: 1.25, magic: 1.5, poison: 0.5 } },
  demon:  { name: '악마',   mult: { holy: 1.5, fire: 0.5, cold: 1.5 } },
};
const ENEMY_FAMILY = {
  zombie: 'undead', skeleton: 'undead', archer: 'undead', graveLord: 'undead',
  crow: 'beast', bat: 'beast', spider: 'beast', spiderling: 'beast', plant: 'beast', spiderQueen: 'beast',
  ghost: 'spirit',
  imp: 'demon', demon: 'demon', knight: 'demon', flameTyrant: 'demon', terrorLord: 'demon',
};
function matchup(type, family) { return (FAMILIES[family] && FAMILIES[family].mult[type]) || 1; }
function familyWeakText(family) {
  const m = FAMILIES[family].mult;
  const weak = Object.keys(m).filter(k => m[k] > 1).map(k => DMG_TYPES[k].name);
  const res = Object.keys(m).filter(k => m[k] < 1).map(k => DMG_TYPES[k].name);
  return `약점: ${weak.join('·') || '없음'} / 저항: ${res.join('·') || '없음'}`;
}
// 직업별 기본 공격 속성: 주력 무기(affinity)를 들면 직업 고유 속성으로 바뀐다
const CLASS_ELEMENT = { paladin: 'holy', sorc: 'magic', necro: 'poison' };
function weaponDmgType(cls, wtype) {
  if (wtype === 'torch') return 'fire';
  if (wtype === 'orb') return 'magic';
  if (CLASSES[cls].affinity.includes(wtype)) return CLASS_ELEMENT[cls];
  return 'phys';
}
