'use strict';
// ===== 창고 / 제작 / 강화 =====
const STASH_SIZE = 48;

function ensureCharData(c) {
  c.stash = c.stash || [];
  c.mats = Object.assign({ iron: 0, dust: 0, essence: 0, soul: 0 }, c.mats || {});
  c.stats = c.stats || {};
  return c;
}

function hasMats(cost) { return Object.keys(cost).every(k => (C.mats[k] || 0) >= cost[k]); }
function payMats(cost) { for (const k in cost) C.mats[k] -= cost[k]; }
function costText(cost, gold) {
  const parts = Object.keys(cost).map(k => {
    const ok = (C.mats[k] || 0) >= cost[k];
    return `<span style="color:${ok ? MATS[k].color : '#f77'}">${MATS[k].icon}${cost[k]}</span>`;
  });
  if (gold) parts.push(`<span style="color:${C.gold >= gold ? '#ffd24a' : '#f77'}">${gold}G</span>`);
  return parts.join(' ');
}

// 제작 레시피 (선택한 가방 아이템 대상)
const RECIPES = [
  {
    id: 'reroll', name: '마법 재조정', icon: '🎲',
    desc: '마법 아이템의 옵션을 새로 굴립니다.',
    can: it => it && it.rarity === 'magic',
    cost: () => ({ dust: 3 }), gold: it => 30 + it.ilvl * 5,
    run: it => { it.aff = {}; rollAffixes(it, Math.random() < 0.5 ? 1 : 2, it.ilvl); it.name = makeName(it); },
  },
  {
    id: 'upgrade', name: '희귀 승급', icon: '⬆',
    desc: '마법 아이템을 희귀 등급으로 올립니다 (옵션 3~5개).',
    can: it => it && it.rarity === 'magic',
    cost: () => ({ dust: 5, essence: 1 }), gold: it => 80 + it.ilvl * 10,
    run: it => { it.rarity = 'rare'; it.aff = {}; rollAffixes(it, irand(3, 5), it.ilvl); it.name = makeName(it); finishItem(it); },
  },
  {
    id: 'addAffix', name: '옵션 추가', icon: '➕',
    desc: '희귀 아이템에 옵션 1개를 추가합니다 (최대 6개).',
    can: it => it && it.rarity === 'rare' && Object.keys(it.aff).length < 6,
    cost: () => ({ essence: 2 }), gold: it => 150 + it.ilvl * 12,
    run: it => { rollAffixes(it, Object.keys(it.aff).length + 1, it.ilvl); finishItem(it); },
  },
];

// 부위 선택형: 고유 아이템 제작
function uniqueCraftCost() { return { soul: 1, essence: 3 }; }
function uniqueCraftGold() { return 500 + C.level * 40; }

function craftSalvage(it) {
  const y = salvageYield(it);
  for (const k in y) C.mats[k] += y[k];
  return y;
}

function enhanceCost(it) {
  const p = it.plus || 0;
  return { cost: { iron: 2 + p * 2, ...(p >= 5 ? { dust: p - 3 } : {}) }, gold: (p + 1) * 40 * (1 + C.diff), rate: ENH_RATE[p] };
}
function canEnhance(it) { return it && (it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'helm') && (it.plus || 0) < ENH_MAX; }

// 몬스터가 재료를 떨어뜨리는 경우
function dropMats(x, y, tier) {
  const r = Math.random();
  if (tier === 3) { spawnPickup('mat', x, y, { mat: 'essence', amount: irand(1, 2) }); if (Math.random() < 0.15) spawnPickup('mat', x, y, { mat: 'soul', amount: 1 }); }
  else if (tier === 2 && r < 0.4) spawnPickup('mat', x, y, { mat: Math.random() < 0.2 ? 'essence' : 'dust', amount: 1 });
  else if (r < 0.04) spawnPickup('mat', x, y, { mat: 'iron', amount: 1 });
}

// 정렬: 부위 → 등급 → 강화 → 아이템 레벨
const RARITY_RANK = { unique: 0, rare: 1, magic: 2, normal: 3 };
function itemSort(a, b) {
  return SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)
    || RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]
    || (b.plus || 0) - (a.plus || 0)
    || b.ilvl - a.ilvl;
}
