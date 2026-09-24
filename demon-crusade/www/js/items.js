'use strict';
// ===== 아이템 시스템 (디아블로식 등급/옵션) =====
const RARITY = {
  normal: { name: '일반', color: '#e8e8e8', mult: 1 },
  magic:  { name: '마법', color: '#7b93ff', mult: 3 },
  rare:   { name: '희귀', color: '#ffdd55', mult: 7 },
  unique: { name: '고유', color: '#c9a567', mult: 16 },
};
const SLOTS = ['weapon', 'helm', 'armor', 'ring', 'amulet'];
const SLOT_NAMES = { weapon: '무기', helm: '투구', armor: '갑옷', ring: '반지', amulet: '목걸이' };
const SLOT_ICONS = { weapon: '⚔', helm: '⛑', armor: '🛡', ring: '💍', amulet: '📿' };

// 기본 아이템 (minL: 최소 아이템 레벨)
const BASES = {
  weapon: [
    { n: '짧은 창', t: 'lance', minL: 1, d: [4, 7] }, { n: '장창', t: 'lance', minL: 8, d: [8, 14] },
    { n: '미늘창', t: 'lance', minL: 16, d: [14, 24] }, { n: '룬 창', t: 'lance', minL: 26, d: [24, 38] },
    { n: '용기병 창', t: 'lance', minL: 36, d: [36, 56] }, { n: '천벌의 창', t: 'lance', minL: 50, d: [54, 82] },

    { n: '단검', t: 'dagger', minL: 1, d: [3, 5] }, { n: '단도', t: 'dagger', minL: 8, d: [6, 10] },
    { n: '크리스', t: 'dagger', minL: 16, d: [10, 17] }, { n: '룬 단검', t: 'dagger', minL: 26, d: [16, 27] },
    { n: '마검', t: 'dagger', minL: 36, d: [25, 40] }, { n: '그림자 송곳', t: 'dagger', minL: 50, d: [38, 58] },

    { n: '손도끼', t: 'axe', minL: 1, d: [5, 9] }, { n: '투척 도끼', t: 'axe', minL: 8, d: [10, 17] },
    { n: '전투 도끼', t: 'axe', minL: 16, d: [17, 29] }, { n: '광전사 도끼', t: 'axe', minL: 26, d: [28, 46] },
    { n: '거인 도끼', t: 'axe', minL: 36, d: [44, 70] }, { n: '처형자의 도끼', t: 'axe', minL: 50, d: [66, 100] },

    { n: '횃불', t: 'torch', minL: 1, d: [4, 7] }, { n: '기름 횃불', t: 'torch', minL: 8, d: [8, 13] },
    { n: '지옥불 횃불', t: 'torch', minL: 16, d: [13, 22] }, { n: '불사조 횃불', t: 'torch', minL: 26, d: [21, 36] },
    { n: '성화', t: 'torch', minL: 36, d: [33, 54] }, { n: '태초의 불꽃', t: 'torch', minL: 50, d: [50, 78] },

    { n: '나무 지팡이', t: 'orb', minL: 1, d: [3, 6] }, { n: '수정 구슬', t: 'orb', minL: 8, d: [7, 12] },
    { n: '룬 구슬', t: 'orb', minL: 16, d: [11, 20] }, { n: '영혼 구슬', t: 'orb', minL: 26, d: [19, 32] },
    { n: '천상의 구슬', t: 'orb', minL: 36, d: [30, 50] }, { n: '공허의 눈', t: 'orb', minL: 50, d: [46, 72] },
  ],
  armor: [
    { n: '가죽 갑옷', minL: 1, a: 20 }, { n: '사슬 갑옷', minL: 8, a: 38 }, { n: '판금 갑옷', minL: 16, a: 60 },
    { n: '고딕 갑옷', minL: 26, a: 90 }, { n: '고대 갑옷', minL: 36, a: 130 }, { n: '성스러운 갑주', minL: 50, a: 185 },
  ],
  helm: [
    { n: '모자', minL: 1, a: 8 }, { n: '투구', minL: 8, a: 16 }, { n: '뿔투구', minL: 16, a: 26 },
    { n: '해골 투구', minL: 26, a: 40 }, { n: '왕관', minL: 36, a: 58 }, { n: '악마 뿔관', minL: 50, a: 82 },
  ],
  ring: [{ n: '반지', minL: 1 }],
  amulet: [{ n: '목걸이', minL: 1 }],
};

// 옵션(Affix). pre=접두어, suf=접미어("~의")
const AFFIXES = {
  dmgPct: { label: v => `피해 +${v}%`, pre: '잔혹한', slots: ['weapon', 'ring', 'amulet', 'helm'], roll: l => irand(10, 20 + l * 2) },
  flat:   { label: v => `피해 +${v}`, pre: '날카로운', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(1, 2 + Math.floor(l / 2)) },
  as:     { label: v => `공격 속도 +${v}%`, suf: '신속의', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(5, 10 + Math.floor(l / 3)) },
  life:   { label: v => `생명력 +${v}`, suf: '곰의', slots: ['armor', 'helm', 'ring', 'amulet'], roll: l => irand(5, 10 + l * 2) },
  mana:   { label: v => `마나 +${v}`, pre: '푸른', slots: ['helm', 'ring', 'amulet', 'weapon'], roll: l => irand(5, 10 + l * 2) },
  str:    { label: v => `힘 +${v}`, suf: '거인의', slots: SLOTS, roll: l => irand(2, 4 + Math.floor(l / 3)) },
  dex:    { label: v => `민첩 +${v}`, suf: '여우의', slots: SLOTS, roll: l => irand(2, 4 + Math.floor(l / 3)) },
  vit:    { label: v => `활력 +${v}`, suf: '황소의', slots: SLOTS, roll: l => irand(2, 4 + Math.floor(l / 3)) },
  ene:    { label: v => `에너지 +${v}`, suf: '현자의', slots: SLOTS, roll: l => irand(2, 4 + Math.floor(l / 3)) },
  armor:  { label: v => `갑옷 내구도 +${v}`, pre: '단단한', slots: ['armor', 'helm'], roll: l => irand(5, 10 + l * 3) },
  dr:     { label: v => `받는 피해 -${v}%`, pre: '수호자의', slots: ['armor', 'helm', 'ring', 'amulet'], roll: l => irand(2, 4 + Math.floor(l / 8)) },
  ls:     { label: v => `생명력 흡수 ${v}%`, suf: '흡혈귀의', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(2, 3 + Math.floor(l / 12)) },
  ml:     { label: v => `마나 흡수 ${v}%`, suf: '정기의', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(2, 3 + Math.floor(l / 12)) },
  fire:   { label: v => `화염 피해 +${v} (화상)`, pre: '불타는', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(2, 3 + l) },
  cold:   { label: v => `냉기 피해 +${v} (둔화)`, pre: '얼어붙은', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(2, 3 + l) },
  light:  { label: v => `번개 피해 +${v} (연쇄)`, pre: '번뜩이는', slots: ['weapon', 'ring', 'amulet'], roll: l => irand(1, 4 + l) },
  mf:     { label: v => `마법 아이템 발견 +${v}%`, suf: '행운의', slots: ['helm', 'ring', 'amulet', 'armor'], roll: l => irand(5, 10 + l) },
  gf:     { label: v => `골드 발견 +${v}%`, suf: '탐욕의', slots: ['helm', 'ring', 'amulet', 'armor'], roll: l => irand(10, 20 + l * 2) },
  skill:  { label: v => `모든 스킬 +${v}`, pre: '마도사의', slots: ['weapon', 'amulet', 'helm'], roll: l => (l >= 12 ? (l >= 40 && Math.random() < 0.3 ? 2 : 1) : 0) },
  pierce: { label: v => `투사체 관통 +${v}`, suf: '꿰뚫음의', slots: ['weapon'], roll: l => (l >= 6 ? 1 : 0) },
  multi:  { label: v => `투사체 +${v}`, pre: '분열하는', slots: ['weapon'], roll: l => (l >= 14 ? 1 : 0) },
  crit:   { label: v => `치명타 확률 +${v}%`, pre: '치명적인', slots: ['weapon', 'ring', 'amulet', 'helm'], roll: l => irand(3, 5 + Math.floor(l / 5)) },
  regen:  { label: v => `생명력 재생 +${v}/초`, suf: '재생의', slots: ['armor', 'helm', 'ring', 'amulet'], roll: l => irand(1, 2 + Math.floor(l / 8)) },
  ms:     { label: v => `이동 속도 +${v}%`, suf: '질풍의', slots: ['armor', 'ring', 'amulet'], roll: l => irand(5, 8 + Math.floor(l / 6)) },
  all:    { label: v => `모든 능력치 +${v}`, suf: '왕의', slots: ['ring', 'amulet'], roll: l => (l >= 10 ? irand(2, 3 + Math.floor(l / 8)) : 0) },
};
const AFF_ORDER = Object.keys(AFFIXES);

// 고유 아이템
const UNIQUES = [
  { n: '태양의 창', slot: 'weapon', base: '장창', minL: 6, aff: { dmgPct: 80, fire: 12, life: 30 } },
  { n: '서리송곳', slot: 'weapon', base: '크리스', minL: 14, aff: { cold: 18, as: 30, dex: 12 } },
  { n: '도살자의 도끼', slot: 'weapon', base: '전투 도끼', minL: 18, aff: { dmgPct: 120, ls: 8, str: 15 } },
  { n: '지옥불꽃', slot: 'weapon', base: '지옥불 횃불', minL: 16, aff: { fire: 30, skill: 1, ene: 15 } },
  { n: '망자의 눈', slot: 'weapon', base: '영혼 구슬', minL: 26, aff: { ml: 8, mana: 60, skill: 2, multi: 1 } },
  { n: '천둥신의 분노', slot: 'weapon', base: '룬 창', minL: 30, aff: { light: 45, pierce: 1, dmgPct: 90, as: 20 } },
  { n: '그림자 춤', slot: 'weapon', base: '마검', minL: 40, aff: { multi: 1, as: 40, crit: 15, dex: 20 } },
  { n: '수호성인의 갑옷', slot: 'armor', base: '판금 갑옷', minL: 16, aff: { armor: 120, dr: 12, vit: 20 } },
  { n: '뼈의 흉갑', slot: 'armor', base: '사슬 갑옷', minL: 8, aff: { armor: 50, life: 60, regen: 3 } },
  { n: '악마가죽 외투', slot: 'armor', base: '고딕 갑옷', minL: 28, aff: { armor: 150, ms: 20, fire: 15, life: 80 } },
  { n: '해골왕관', slot: 'helm', base: '해골 투구', minL: 24, aff: { armor: 50, mf: 50, gf: 80 } },
  { n: '전쟁군주의 투구', slot: 'helm', base: '뿔투구', minL: 14, aff: { armor: 40, dmgPct: 30, str: 15 } },
  { n: '까마귀 서리', slot: 'ring', base: '반지', minL: 12, aff: { dex: 18, cold: 14, mana: 30 } },
  { n: '돌의 반지', slot: 'ring', base: '반지', minL: 8, aff: { dr: 10, life: 40 } },
  { n: '뱀의 눈', slot: 'ring', base: '반지', minL: 20, aff: { ml: 6, ls: 6, ene: 15 } },
  { n: '마라의 부적', slot: 'amulet', base: '목걸이', minL: 30, aff: { skill: 2, all: 6, dr: 8 } },
  { n: '고양이의 눈', slot: 'amulet', base: '목걸이', minL: 12, aff: { as: 20, ms: 20, dex: 25 } },
  { n: '대천사의 목걸이', slot: 'amulet', base: '목걸이', minL: 40, aff: { life: 120, regen: 6, skill: 1, mf: 40 } },
];
const NOSCALE = new Set(['skill', 'pierce', 'multi', 'dr', 'ls', 'ml', 'ms']);

const RARE_WORDS = ['피', '파멸', '죽음', '서리', '폭풍', '악령', '해골', '혼돈', '그림자', '용', '역병', '영혼', '재앙', '황혼', '분노'];
const RARE_TAILS = {
  weapon: ['송곳', '이빨', '칼날', '쐐기', '가시'], armor: ['껍질', '외피', '가죽', '보호막', '갑주'],
  helm: ['왕관', '투구', '머리', '가면'], ring: ['고리', '원', '매듭', '인장'], amulet: ['눈', '목걸이', '부적', '심장'],
};

let _itemId = 1;
function newId() { return Date.now().toString(36) + (_itemId++).toString(36); }

function chooseBase(slot, ilvl) {
  const list = BASES[slot].filter(b => b.minL <= ilvl);
  if (slot === 'weapon') {
    const t = pick(Object.keys(WEAPON_TYPES));
    const ofType = list.filter(b => b.t === t);
    return ofType.length > 1 && Math.random() < 0.5 ? ofType[ofType.length - 2] : ofType[ofType.length - 1];
  }
  return list.length > 1 && Math.random() < 0.4 ? list[list.length - 2] : list[list.length - 1];
}
function findBase(slot, name) { return BASES[slot].find(b => b.n === name) || BASES[slot][0]; }

function applyBase(item, base, ilvl) {
  item.base = base.n;
  if (item.slot === 'weapon') {
    item.type = base.t;
    const s = 1 + Math.max(0, ilvl - base.minL) * 0.015;
    item.min = Math.round(base.d[0] * s);
    item.max = Math.round(base.d[1] * s);
  } else if (base.a) {
    item.def = Math.round(base.a * (1 + Math.max(0, ilvl - base.minL) * 0.015));
  }
}

function rollAffixes(item, count, ilvl) {
  const pool = AFF_ORDER.filter(k => AFFIXES[k].slots.includes(item.slot));
  let tries = 0;
  while (Object.keys(item.aff).length < count && tries++ < 40) {
    const k = pick(pool);
    if (item.aff[k]) continue;
    const v = AFFIXES[k].roll(ilvl);
    if (v > 0) item.aff[k] = v;
  }
}

function makeName(item) {
  if (item.rarity === 'normal') return item.base;
  if (item.rarity === 'magic') {
    let pre = '', suf = '';
    for (const k in item.aff) {
      if (!pre && AFFIXES[k].pre) pre = AFFIXES[k].pre;
      else if (!suf && AFFIXES[k].suf) suf = AFFIXES[k].suf;
    }
    return [suf, pre, item.base].filter(Boolean).join(' ');
  }
  return `${pick(RARE_WORDS)}의 ${pick(RARE_TAILS[item.slot])}`;
}

// 아이템 생성. opts: slot, mf(마법 아이템 발견 %), rarity(강제), boost(등급 가중치 보너스)
function genItem(ilvl, opts = {}) {
  ilvl = Math.max(1, Math.round(ilvl));
  const slot = opts.slot || wpick({ weapon: 30, armor: 22, helm: 20, ring: 14, amulet: 10 });
  let rarity = opts.rarity;
  if (!rarity) {
    // 디아블로2식 마법 아이템 발견 체감: 희귀·고유 등급일수록 효과가 줄어든다
    const mf = opts.mf || 0, b = opts.boost || 0;
    const fM = 1 + mf / 100 + b;
    const fR = 1 + (mf * 600 / (mf + 600)) / 100 + b;
    const fU = 1 + (mf * 250 / (mf + 250)) / 100 + b;
    rarity = wpick({ normal: 72, magic: 23 * fM, rare: 4 * fR, unique: 0.5 * fU });
  }
  if ((slot === 'ring' || slot === 'amulet') && rarity === 'normal') rarity = 'magic';

  const item = { id: newId(), slot, rarity, ilvl, aff: {} };
  if (rarity === 'unique') {
    const cands = UNIQUES.filter(u => u.slot === slot && u.minL <= ilvl + 4);
    if (cands.length) {
      const u = pick(cands);
      applyBase(item, findBase(slot, u.base), Math.max(ilvl, u.minL));
      const sc = 1 + Math.max(0, ilvl - u.minL) / 45;
      for (const k in u.aff) item.aff[k] = NOSCALE.has(k) ? u.aff[k] : Math.round(u.aff[k] * sc);
      item.name = u.n;
      item.req = Math.max(u.minL, Math.floor(ilvl * 0.7));
      return finishItem(item);
    }
    item.rarity = rarity = 'rare';
  }
  applyBase(item, chooseBase(slot, ilvl), ilvl);
  if (rarity === 'magic') rollAffixes(item, Math.random() < 0.5 ? 1 : 2, ilvl);
  if (rarity === 'rare') rollAffixes(item, irand(3, ilvl > 30 ? 6 : 5), ilvl);
  item.name = makeName(item);
  const bl = findBase(slot, item.base).minL;
  item.req = rarity === 'normal' ? bl : Math.max(bl, Math.floor(ilvl * 0.7));
  return finishItem(item);
}

function finishItem(item) {
  item.req = Math.max(1, item.req || 1);
  item.value = Math.floor((6 + item.ilvl * 3) * RARITY[item.rarity].mult);
  return item;
}

function starterWeapon(cls) {
  const t = CLASSES[cls].weapon;
  const base = BASES.weapon.find(b => b.t === t && b.minL === 1);
  const item = { id: newId(), slot: 'weapon', rarity: 'normal', ilvl: 1, aff: {} };
  applyBase(item, base, 1);
  item.name = base.n; item.req = 1;
  return finishItem(item);
}
function starterArmor() {
  const item = { id: newId(), slot: 'armor', rarity: 'normal', ilvl: 1, aff: {} };
  applyBase(item, BASES.armor[0], 1);
  item.name = item.base; item.req = 1;
  return finishItem(item);
}

function itemIcon(item) {
  if (item.slot === 'weapon') return WEAPON_TYPES[item.type].icon;
  return SLOT_ICONS[item.slot];
}

// ===== 강화(+N) =====
const ENH_MAX = 9;
const ENH_RATE = [100, 90, 80, 70, 60, 50, 40, 30, 20];
const effMin = it => Math.round(it.min * (1 + (it.plus || 0) * 0.08));
const effMax = it => Math.round(it.max * (1 + (it.plus || 0) * 0.08));
const effDef = it => Math.round((it.def || 0) * (1 + (it.plus || 0) * 0.1));
const displayName = it => (it.plus ? `+${it.plus} ` : '') + it.name;

// ===== 제작 재료 =====
const MATS = {
  iron:    { name: '철 조각',    icon: '⛓', color: '#b8b8c8' },
  dust:    { name: '마력 가루',  icon: '✨', color: '#7b93ff' },
  essence: { name: '희귀 정수',  icon: '💠', color: '#ffdd55' },
  soul:    { name: '고유 영혼석', icon: '🔮', color: '#c9a567' },
};
function salvageYield(it) {
  const y = { iron: 0, dust: 0, essence: 0, soul: 0 };
  const big = it.ilvl >= 30 ? 1 : 0;
  switch (it.rarity) {
    case 'normal': y.iron = 1 + big + (Math.random() < 0.5 ? 1 : 0); break;
    case 'magic': y.dust = 1 + big; y.iron = 1; break;
    case 'rare': y.essence = 1; y.dust = 2 + big; break;
    case 'unique': y.soul = 1; y.essence = 1; break;
  }
  y.iron += Math.floor((it.plus || 0) / 2);
  return y;
}
function matsText(m) {
  return Object.keys(MATS).filter(k => m[k]).map(k => `${MATS[k].icon}${MATS[k].name} ${m[k]}`).join(' · ');
}

function itemLines(item) {
  const lines = [];
  lines.push(`<div class="iname c-${item.rarity}">${displayName(item)}</div>`);
  if (item.rarity !== 'normal') lines.push(`<div class="c-${item.rarity}" style="font-size:12px">${item.base} · ${RARITY[item.rarity].name}</div>`);
  if (item.slot === 'weapon') {
    const t = weaponDmgType(C ? C.cls : 'paladin', item.type);
    lines.push(`<div>${WEAPON_TYPES[item.type].name} · 피해 ${effMin(item)}-${effMax(item)} <span style="color:${DMG_TYPES[t].color};font-size:12px">[${DMG_TYPES[t].name}]</span></div>`);
  }
  if (item.def) lines.push(`<div>갑옷 내구도 ${effDef(item)}</div>`);
  if (item.plus) lines.push(`<div class="c-green" style="font-size:12px">강화 +${item.plus} (${item.slot === 'weapon' ? '피해 +' + item.plus * 8 : '내구도 +' + item.plus * 10}%)</div>`);
  lines.push(`<div class="dim">요구 레벨 ${item.req} · 아이템 레벨 ${item.ilvl}</div>`);
  for (const k of AFF_ORDER) if (item.aff[k]) lines.push(`<div class="aff">${AFFIXES[k].label(item.aff[k])}</div>`);
  return lines.join('');
}

// 장착 중인 아이템과 비교 (▲ 좋아짐 / ▼ 나빠짐)
function compareLines(it, cur) {
  const out = [];
  const fmt = (label, d, unit = '') => out.push(`<div style="color:${d > 0 ? '#7f7' : '#f77'}">${d > 0 ? '▲' : '▼'} ${label} ${d > 0 ? '+' : ''}${Math.round(d)}${unit}</div>`);
  if (it.slot === 'weapon') {
    const a = (effMin(it) + effMax(it)) / 2, b = cur ? (effMin(cur) + effMax(cur)) / 2 : 0;
    if (a !== b) fmt('평균 무기 피해', a - b);
  }
  if (it.def || (cur && cur.def)) { const d = effDef(it) - (cur ? effDef(cur) : 0); if (d) fmt('갑옷 내구도', d); }
  for (const k of AFF_ORDER) {
    const d = (it.aff[k] || 0) - ((cur && cur.aff[k]) || 0);
    if (d) out.push(`<div style="color:${d > 0 ? '#7f7' : '#f77'}">${d > 0 ? '▲' : '▼'} ${AFFIXES[k].label(Math.abs(d))}${d > 0 ? '' : ' 손실'}</div>`);
  }
  return out.length ? out.join('') : '<div class="dim">차이 없음</div>';
}
