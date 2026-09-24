'use strict';
// ===== 캐릭터 / 전투 / 몬스터 =====
let C = null;   // 저장되는 캐릭터 데이터
let S = null;   // 계산된 능력치
let P = null;   // 플레이어 개체(런타임)
let enemies = [], shots = [], eshots = [], pickups = [], parts = [], texts = [], minions = [], fx = [];
let camX = 0, shake = 0, banner = null, bossRef = null;
const input = { left: false, right: false, jump: false, attack: false, s1: false, s2: false };
const pressed = {};

function newCharacter(cls) {
  const b = CLASSES[cls].base;
  C = {
    v: 1, cls, level: 1, exp: 0, statPts: 0, skillPts: 0,
    stats: { ...b },
    skills: { [CLASSES[cls].skills[0]]: 1, [CLASSES[cls].skills[1]]: 0 },
    gold: 60, hpPot: 3, mpPot: 2,
    equip: { weapon: starterWeapon(cls), armor: starterArmor(), helm: null, ring: null, amulet: null },
    inv: [], armorCur: null,
    progress: [0, -1, -1], diff: 0, cleared: [false, false, false],
    checkpoint: null, kills: 0, deaths: 0, playTime: 0,
  };
  ensureCharData(C);
  calcStats();
  C.armorCur = S.armorMax;
  return C;
}

function calcStats() {
  const tot = {};
  for (const k of AFF_ORDER) tot[k] = 0;
  let armorMax = 0;
  for (const s of SLOTS) {
    const it = C.equip[s];
    if (!it) continue;
    if (it.def) armorMax += effDef(it);
    for (const k in it.aff) tot[k] += it.aff[k];
  }
  const st = {
    str: C.stats.str + tot.str + tot.all, dex: C.stats.dex + tot.dex + tot.all,
    vit: C.stats.vit + tot.vit + tot.all, ene: C.stats.ene + tot.ene + tot.all,
  };
  const w = C.equip.weapon;
  S = {
    ...tot, ...st,
    maxHP: Math.round(30 + st.vit * 3 + C.level * 4 + tot.life),
    maxMP: Math.round(10 + st.ene * 2 + C.level * 1.5 + tot.mana),
    armorMax: armorMax + tot.armor,
    dr: Math.min(60, tot.dr),
    crit: Math.min(60, st.dex / 5 + tot.crit),
    wtype: w ? w.type : CLASSES[C.cls].weapon,
    wmin: w ? effMin(w) : 1, wmax: w ? effMax(w) : 2,
    mregen: 1 + st.ene * 0.035,
  };
  return S;
}

function skillLevel(key) {
  const base = C.skills[key] || 0;
  return base > 0 ? base + S.skill : 0;
}

// 무기 피해 계산
function rollWeaponDamage(mult = 1) {
  const aff = CLASSES[C.cls].affinity.includes(S.wtype) ? 1.2 : 1;
  let d = rand(S.wmin, S.wmax) + S.flat;
  d *= (1 + (S.dmgPct + S.str) / 100) * aff * mult * WEAPON_TYPES[S.wtype].mult;
  if (P && P.buffs.combat > 0) d *= 1.5;
  const crit = Math.random() * 100 < S.crit;
  if (crit) d *= 2;
  return { dmg: Math.max(1, Math.round(d)), crit };
}
function spellPower(base) {
  let d = base * (1 + (S.ene * 0.6 + S.dmgPct * 0.3) / 100);
  if (P && P.buffs.combat > 0) d *= 1.5;
  return Math.round(d);
}

// ===== 스테이지 시작 =====
function startStage(stageIdx) {
  genLevel(stageIdx, C.diff);
  enemies = []; shots = []; eshots = []; pickups = []; parts = []; texts = []; minions = []; fx = [];
  bossRef = null;
  calcStats();
  let sx = 3 * TILE;
  const cp = C.checkpoint;
  if (cp && cp.stage === stageIdx && cp.diff === C.diff && L.cpX > 0) sx = L.cpX;
  const gy = groundBelow(sx + 6, 0);
  P = {
    x: sx, y: gy - 22, w: 12, h: 22, vx: 0, vy: 0, face: 1, onGround: false,
    hp: S.maxHP, mp: S.maxMP, armor: Math.min(S.armorMax, C.armorCur ?? S.armorMax),
    inv: 1.2, hurt: 0, atkCd: 0, skCd: [0, 0], coyote: 0, anim: 0, atkAnim: 0,
    buffs: { shield: 0, exp: 0, combat: 0 }, duck: 0, webbed: 0,
    safeX: sx, safeY: gy - 22, regenAcc: 0, dead: false, cleared: false,
  };
  for (const s of L.spawns) spawnEnemy(s.type, s.x, s.y, { elite: s.elite, dormant: ENEMIES[s.type].rise });
  if (sx !== 3 * TILE) enemies = enemies.filter(e => e.x > sx + 120 || e.x < sx - 200);
  camX = clamp(P.x - VW * 0.4, 0, L.width - VW);
  banner = { t: 3, title: L.name, sub: `${ACTS[L.act].name}  ·  ${DIFFS[C.diff].name}` };
  Audio8.music(L.boss ? ACTS[L.act].music : ACTS[L.act].music);
}

// ===== 몬스터 생성 =====
function spawnEnemy(type, x, y, opts = {}) {
  const d = ENEMIES[type];
  const D = DIFFS[C.diff];
  const ml = L.mlvl + (opts.lvlBonus || 0);
  let hp = d.hp * (1 + 0.32 * (ml - 1)) * D.hp;
  let dmg = d.dmg * (1 + 0.13 * (ml - 1)) * D.dmg;
  let exp = d.exp * ml * 1.5 * D.exp;
  const e = {
    type, def: d, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: -1, onGround: false,
    hp: 0, maxHp: 0, dmg, exp, ml, t: Math.random() * 2, cd: rand(1, 2.5), state: 'idle',
    slow: 0, stun: 0, burn: 0, burnDps: 0, flash: 0, tier: 0, affix: null, eliteName: null,
    dormant: !!opts.dormant, rise: 0, phased: false, spd: d.spd, dodgeCd: 0, homeY: y,
  };
  const roll = Math.random();
  if (!d.boss && (opts.elite || roll < 0.05)) {
    e.tier = 2;
    e.affix = pick(Object.keys(ELITE_AFFIX));
    e.eliteName = `${pick(ELITE_NAMES)} ${pick(ELITE_NOUNS)}`;
    hp *= 3; exp *= 5; dmg *= 1.3;
  } else if (!d.boss && roll < 0.14) {
    e.tier = 1; hp *= 2; exp *= 2.5; dmg *= 1.15;
  }
  if (e.affix === 'fast') e.spd *= 1.6;
  if (e.affix === 'strong') dmg *= 1.5;
  if (e.affix === 'stone') hp *= 1.8;
  if (d.boss) { e.tier = 3; e.state = 'intro'; e.cd = 1.5; }
  e.hp = e.maxHp = Math.round(hp);
  e.dmg = Math.round(dmg); e.exp = Math.round(exp);
  enemies.push(e);
  return e;
}

// ===== 플레이어 업데이트 =====
function updatePlayer(dt) {
  if (P.dead || P.cleared) return;
  const slowF = P.webbed > 0 ? 0.5 : 1;
  const spd = (P.duck > 0 ? 55 : 88) * (1 + S.ms / 100) * slowF;
  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (P.hurt > 0) { P.hurt -= dt; dir = 0; }
  const target = dir * spd;
  if (P.hurt <= 0) {
    if (P.onGround) P.vx = target;
    else P.vx += (target - P.vx) * Math.min(1, dt * 5);
  }
  if (dir) P.face = dir;
  P.coyote = P.onGround ? 0.09 : P.coyote - dt;
  if (pressed.jump && P.coyote > 0 && P.hurt <= 0) {
    P.vy = -335; P.coyote = 0; Audio8.play('jump');
  }
  if (!input.jump && P.vy < -130 && P.hurt <= 0) P.vy = -130;

  P.atkCd -= dt; P.skCd[0] -= dt; P.skCd[1] -= dt;
  if (input.attack && P.atkCd <= 0 && P.duck <= 0) fireWeapon();
  if (pressed.s1) useSkill(0);
  if (pressed.s2) useSkill(1);
  if (pressed.hpPot) drinkPotion('hp');
  if (pressed.mpPot) drinkPotion('mp');

  moveBody(P, dt);
  if (P.x < (L.bossLock ? L.arenaStart * TILE : 0)) { P.x = L.bossLock ? L.arenaStart * TILE : 0; P.vx = 0; }
  if (P.onGround && P.hurt <= 0) {
    const c = Math.floor((P.x + 6) / TILE);
    if (L.ground[c - 1] >= 0 && L.ground[c + 1] >= 0 && L.ground[c] >= 0) { P.safeX = P.x; P.safeY = P.y; }
  }
  // 낙사
  if (P.y > VH + 20) {
    const d = Math.round(S.maxHP * 0.25);
    P.hp -= d;
    addText(P.x, P.safeY - 10, `-${d}`, '#ff5040');
    Audio8.play('hurt');
    if (P.hp <= 0) { playerDie(); return; }
    P.x = P.safeX; P.y = P.safeY - 4; P.vx = P.vy = 0; P.inv = 1.5;
  }

  P.anim += Math.abs(P.vx) * dt * 0.08;
  P.atkAnim -= dt; P.inv -= dt; P.duck -= dt; P.webbed -= dt;
  for (const k in P.buffs) P.buffs[k] -= dt;
  // 재생
  P.regenAcc += dt;
  if (P.regenAcc >= 0.5) {
    P.regenAcc -= 0.5;
    P.hp = Math.min(S.maxHP, P.hp + S.regen * 0.5);
    P.mp = Math.min(S.maxMP, P.mp + S.mregen * 0.5);
  }

  // 줍기
  for (const pk of pickups) {
    if (pk.dead || pk.t < 0.35 || !overlap(P, pk)) continue;
    collectPickup(pk);
  }
  // 오브젝트
  for (const o of L.objs) {
    if (o.used || !overlap(P, o)) continue;
    if (o.kind === 'shrine') activateShrine(o);
    else if (o.kind === 'checkpoint') {
      o.used = true;
      C.checkpoint = { stage: L.stageIdx, diff: C.diff };
      toast('체크포인트 도달 — 사망 시 이곳에서 재시작');
      Audio8.play('shrine');
      burst(o.x + 6, o.y + 4, '#7fd0ff', 16);
    } else if (o.kind === 'portal') { o.used = true; stageClear(); return; }
  }
  // 보스 아레나 진입
  if (L.boss && !L.bossTriggered && P.x > (L.arenaStart + 4) * TILE) triggerBoss();
}

// 적이 바로 앞에 붙어 있으면 던지지 않고 무기로 직접 벤다 (근접 물리 공격)
function meleeBox() { return { x: P.face > 0 ? P.x + P.w - 2 : P.x - 24, y: P.y - 4, w: 26, h: 30 }; }
function tryMelee(wt) {
  const box = meleeBox();
  const targets = enemies.filter(e => !e.dead && !e.dormant && !e.phased && e.rise <= 0 && overlap(box, e));
  if (!targets.length) return false;
  P.atkCd = wt.cd / (1 + S.as / 100);
  P.atkAnim = 0.18;
  const type = S.wtype === 'orb' ? 'phys' : weaponDmgType(C.cls, S.wtype);
  for (const e of targets) {
    const r = rollWeaponDamage(1.25 / WEAPON_TYPES[S.wtype].mult);
    hitEnemy(e, r.dmg, { crit: r.crit, type, knock: 90, leech: true });
  }
  breakObjects(box);
  fx.push({ kind: 'slash', x: P.x + P.w / 2 + P.face * 14, y: P.y + 10, face: P.face, t: 0.15, max: 0.15, col: DMG_TYPES[type].color });
  Audio8.play('smite');
  return true;
}

function fireWeapon() {
  const wt = WEAPON_TYPES[S.wtype];
  if (tryMelee(wt)) return;
  const mine = shots.filter(s => s.kind === 'weapon').length;
  if (mine >= wt.max * (1 + S.multi)) return;
  P.atkCd = wt.cd / (1 + S.as / 100);
  P.atkAnim = 0.15;
  const n = 1 + S.multi;
  for (let i = 0; i < n; i++) {
    const spread = (i - (n - 1) / 2);
    const s = {
      kind: 'weapon', wt: S.wtype,
      x: P.x + (P.face > 0 ? P.w - 2 : -wt.w + 2), y: P.y + 7 + spread * 3,
      w: wt.w, h: wt.h, vx: wt.spd * P.face, vy: wt.vy + spread * 40, grav: wt.grav,
      pierce: wt.pierce + S.pierce, life: 1.6, hit: new Set(), face: P.face, rot: 0,
    };
    shots.push(s);
  }
  Audio8.play('throw');
}

function useSkill(i) {
  const key = CLASSES[C.cls].skills[i];
  const lv = skillLevel(key);
  if (lv <= 0) { toast('스킬 포인트를 투자해야 사용할 수 있습니다'); return; }
  if (P.skCd[i] > 0 || P.duck > 0) return;
  const sk = SKILLS[key];
  const cost = Math.round(sk.mana(lv));
  if (P.mp < cost) { toast('마나가 부족합니다'); return; }
  P.mp -= cost;
  P.skCd[i] = sk.cd;
  P.atkAnim = 0.2;
  const cx = P.x + P.w / 2, cy = P.y + 10;
  switch (key) {
    case 'smite': {
      const box = { x: P.face > 0 ? P.x + P.w : P.x - 34, y: P.y - 6, w: 34, h: 32 };
      for (const e of enemies) if (!e.dead && overlap(box, e)) {
        const r = rollWeaponDamage(1.5 + lv * 0.25);
        hitEnemy(e, r.dmg, { crit: r.crit, stun: 0.6, knock: 160, leech: true, type: 'holy' });
      }
      breakObjects(box);
      fx.push({ kind: 'arc', x: cx + P.face * 18, y: cy, face: P.face, t: 0.18, max: 0.18, col: '#ffe07a' });
      Audio8.play('smite'); shake = 0.15;
      break;
    }
    case 'holyShield': {
      const add = Math.round(S.armorMax * (0.30 + lv * 0.06));
      P.armor = Math.min(S.armorMax, P.armor + add);
      P.buffs.shield = 8; P.shieldDr = 18 + lv * 3;
      addText(P.x, P.y - 8, `갑옷 +${add}`, '#ffe07a');
      burst(cx, cy, '#ffe07a', 20);
      Audio8.play('shrine');
      break;
    }
    case 'frozenOrb':
      shots.push({ kind: 'frozenOrb', x: cx - 5, y: cy - 5, w: 10, h: 10, vx: 130 * P.face, vy: 0, grav: 0, life: 1.1, emit: 0, ang: 0, lv, pierce: 99, hit: new Set() });
      Audio8.play('spell');
      break;
    case 'teleport': {
      const dist = 90 + lv * 8;
      let tx = P.x;
      for (let d = dist; d > 0; d -= 4) {
        const nx = P.x + P.face * d;
        if (nx < 0 || nx > L.width - P.w) continue;
        if (!solidAtPx(nx + 1, P.y + 1) && !solidAtPx(nx + P.w - 1, P.y + 1) && !solidAtPx(nx + 1, P.y + P.h - 1) && !solidAtPx(nx + P.w - 1, P.y + P.h - 1)) { tx = nx; break; }
      }
      if (L.bossLock) tx = Math.max(tx, L.arenaStart * TILE);
      burst(cx, cy, '#b48cff', 14);
      P.x = tx; P.vy = Math.min(P.vy, 0); P.inv = Math.max(P.inv, 0.35);
      burst(P.x + 6, cy, '#b48cff', 14);
      Audio8.play('tele');
      break;
    }
    case 'raiseSkel': {
      const max = Math.min(6, 1 + Math.floor((lv + 1) / 2));
      if (minions.length >= max) minions.shift();
      const hp = 25 + lv * 18 + C.level * 3;
      minions.push({ x: P.x + P.face * 14, y: P.y, w: 12, h: 22, vx: 0, vy: 0, face: P.face, hp, maxHp: hp, atk: 0, rise: 0.5, lv, anim: 0, onGround: false });
      burst(P.x + P.face * 14 + 6, P.y + 20, '#9fe08f', 12);
      Audio8.play('spell');
      break;
    }
    case 'boneSpear':
      shots.push({ kind: 'boneSpear', x: cx, y: cy - 2, w: 18, h: 4, vx: 400 * P.face, vy: 0, grav: 0, life: 1.2, pierce: 999, hit: new Set(), dmg: spellPower(12 + lv * 9), face: P.face });
      Audio8.play('spell');
      break;
  }
}

function drinkPotion(kind) {
  if (kind === 'hp') {
    if (C.hpPot <= 0) { toast('생명력 물약이 없습니다'); return; }
    if (P.hp >= S.maxHP) return;
    C.hpPot--; P.hp = Math.min(S.maxHP, P.hp + S.maxHP * 0.45 + 20);
    burst(P.x + 6, P.y + 10, '#ff5050', 10);
  } else {
    if (C.mpPot <= 0) { toast('마나 물약이 없습니다'); return; }
    if (P.mp >= S.maxMP) return;
    C.mpPot--; P.mp = Math.min(S.maxMP, P.mp + S.maxMP * 0.55 + 15);
    burst(P.x + 6, P.y + 10, '#5080ff', 10);
  }
  Audio8.play('potion');
  updateHudButtons();
}

// ===== 피해 처리 =====
function hitEnemy(e, dmg, o = {}) {
  if (e.dead || e.dormant || e.state === 'intro') return false;
  if (e.phased) return false;
  if (e.type === 'knight' && o.proj && Math.sign(o.proj.vx) === -e.face && Math.random() < 0.4) {
    addText(e.x + e.w / 2, e.y - 4, '막음', '#aaa');
    Audio8.play('hit');
    return true;
  }
  // 상성: 피해 속성 × 몬스터 계열
  const type = o.type || 'phys';
  const fam = ENEMY_FAMILY[e.type];
  const m = matchup(type, fam);
  const d = Math.max(1, Math.round(dmg * m));
  e.hp -= d; e.flash = 0.08;
  const col = o.crit ? '#ffdd55' : (type !== 'phys' ? DMG_TYPES[type].color : o.col || '#fff');
  addText(e.x + e.w / 2, e.y - 4, o.crit ? `${d}!` : `${d}`, col);
  if (m > 1 && (!e.weakShown || e.weakShown < gtime)) { addText(e.x + e.w / 2, e.y - 14, '약점!', '#ffdd55'); e.weakShown = gtime + 0.6; }
  else if (m < 1 && (!e.weakShown || e.weakShown < gtime)) { addText(e.x + e.w / 2, e.y - 14, '저항', '#999'); e.weakShown = gtime + 0.6; }
  if (!o.noElem) {
    if (type === 'cold') e.slow = 1.6;
    if (!o.skipAdd) {
      if (S.cold > 0) { e.slow = 1.6; e.hp -= Math.round(S.cold * matchup('cold', fam)); }
      if (S.fire > 0) { const f = S.fire * matchup('fire', fam); e.hp -= Math.round(f * 0.5); e.burn = 2; e.burnDps = f * 0.5; }
      if (S.light > 0) chainLightning(e, Math.round(S.light * matchup('light', fam)));
    }
  }
  if (o.stun && !e.def.boss) e.stun = o.stun;
  if (o.knock && !e.def.boss) { e.vx = Math.sign(e.x - P.x || 1) * o.knock; if (!e.def.fly) e.vy = -90; }
  if (o.leech) {
    if (S.ls) P.hp = Math.min(S.maxHP, P.hp + d * S.ls / 100);
    if (S.ml) P.mp = Math.min(S.maxMP, P.mp + d * S.ml / 100);
  }
  Audio8.play('hit');
  if (e.hp <= 0) killEnemy(e);
  return true;
}

function chainLightning(src, dmg) {
  let best = null, bd = 100;
  for (const e of enemies) {
    if (e === src || e.dead || e.dormant) continue;
    const d = Math.hypot(e.x - src.x, e.y - src.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) { src.hp -= dmg; return; }
  fx.push({ kind: 'bolt', x1: src.x + src.w / 2, y1: src.y + src.h / 2, x2: best.x + best.w / 2, y2: best.y + best.h / 2, t: 0.12, max: 0.12 });
  best.hp -= dmg; best.flash = 0.08;
  addText(best.x + best.w / 2, best.y - 4, `${dmg}`, '#ffff80');
  if (best.hp <= 0) killEnemy(best);
  Audio8.play('zap');
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  C.kills++;
  const bonus = P.buffs.exp > 0 ? 1.5 : 1;
  gainExp(Math.round(e.exp * bonus));
  burst(e.x + e.w / 2, e.y + e.h / 2, e.def.boss ? '#ff6030' : '#a03030', e.def.boss ? 60 : 14);
  Audio8.play('kill');
  if (e.affix === 'fire') {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      eshots.push({ kind: 'fire', x: e.x + e.w / 2, y: e.y + e.h / 2, w: 6, h: 6, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, dmg: Math.round(e.dmg * 0.6), life: 0.8 });
    }
  }
  dropLoot(e);
  if (e.def.boss) onBossDead(e);
}

function hurtPlayer(dmg, srcX, o = {}) {
  if (P.inv > 0 || P.dead || P.cleared) return;
  let red = S.dr + (P.buffs.shield > 0 ? P.shieldDr : 0);
  let d = Math.max(1, Math.round(dmg * (1 - Math.min(75, red) / 100)));
  if (P.armor > 0) {
    P.armor -= d;
    addText(P.x + 6, P.y - 6, `-${d}`, '#c8c8d8');
    if (P.armor <= 0) {
      const over = -P.armor;
      P.armor = 0;
      armorBreak();
      P.hp -= over;
    }
  } else {
    P.hp -= d;
    addText(P.x + 6, P.y - 6, `-${d}`, '#ff5040');
  }
  if (o.slowWeb) P.webbed = 2.5;
  P.inv = 1.0;
  P.hurt = 0.3;
  P.vx = (P.x + 6 < srcX ? -1 : 1) * 110;
  P.vy = -170;
  shake = 0.15;
  Audio8.play('hurt');
  if (P.hp <= 0) playerDie();
}

function armorBreak() {
  // 마계촌: 갑옷이 부서져 속옷 차림이 된다
  const col = CLASSES[C.cls].colors.armor;
  for (let i = 0; i < 10; i++) parts.push({ x: P.x + 6, y: P.y + 8, vx: rand(-120, 120), vy: rand(-240, -80), t: 1.2, col, sz: 3, grav: 1 });
  banner2('갑옷 파괴!', '#c8c8d8');
  Audio8.play('armor');
}

function gainExp(n) {
  C.exp += n;
  let need = expToNext(C.level);
  while (C.exp >= need && C.level < 99) {
    C.exp -= need;
    C.level++;
    C.statPts += 5; C.skillPts += 1;
    need = expToNext(C.level);
    calcStats();
    P.hp = S.maxHP; P.mp = S.maxMP;
    banner2(`레벨 업! (${C.level})`, '#ffdd55');
    burst(P.x + 6, P.y + 10, '#ffdd55', 30);
    Audio8.play('level');
  }
}

// ===== 전리품 =====
function dropLoot(e) {
  const tier = e.tier;
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  const mf = S.mf;
  const ilvl = e.ml + (tier >= 2 ? 2 : 0);
  const itemChance = [0.07, 0.25, 0.9, 1][tier];
  const n = tier === 3 ? irand(3, 5) : tier === 2 ? irand(1, 2) : 1;
  const boost = [0, 0.25, 0.6, 1.2][tier];
  for (let i = 0; i < n; i++) {
    if (Math.random() < itemChance) {
      const it = genItem(ilvl, { mf, boost, rarity: tier === 3 && i === 0 ? (Math.random() < 0.08 ? 'unique' : Math.random() < 0.45 ? 'rare' : 'magic') : undefined });
      spawnPickup('item', x, y, { item: it });
    }
  }
  if (Math.random() < [0.35, 0.6, 1, 1][tier]) {
    const amt = Math.round(irand(e.ml * 2, e.ml * 6 + 5) * (1 + S.gf / 100) * (tier + 1));
    spawnPickup('gold', x, y, { amount: amt });
  }
  if (Math.random() < 0.06 + tier * 0.1) spawnPickup(Math.random() < 0.65 ? 'hp' : 'mp', x, y);
  if (Math.random() < 0.02 + tier * 0.05) spawnPickup('armor', x, y);
  dropMats(x, y, tier);
}

function spawnPickup(kind, x, y, o = {}) {
  const pk = { kind, x: x - 5, y: y - 5, w: 10, h: 10, vx: rand(-60, 60), vy: rand(-200, -120), t: 0, ...o };
  pickups.push(pk);
  if (kind === 'item') {
    const r = o.item.rarity;
    Audio8.play(r === 'unique' ? 'unique' : r === 'rare' ? 'rare' : 'drop');
  }
}

function collectPickup(pk) {
  switch (pk.kind) {
    case 'gold': C.gold += pk.amount; addText(pk.x, pk.y - 6, `+${pk.amount} 골드`, '#ffd24a'); Audio8.play('gold'); break;
    case 'hp': if (C.hpPot >= 10) return; C.hpPot++; Audio8.play('pickup'); break;
    case 'mp': if (C.mpPot >= 10) return; C.mpPot++; Audio8.play('pickup'); break;
    case 'armor': {
      if (P.armor >= S.armorMax) return;
      P.armor = S.armorMax;
      addText(P.x, P.y - 8, '갑옷 복구!', '#c8c8d8');
      Audio8.play('shrine');
      break;
    }
    case 'mat':
      C.mats[pk.mat] += pk.amount;
      addText(pk.x, pk.y - 6, `${MATS[pk.mat].icon}${MATS[pk.mat].name} +${pk.amount}`, MATS[pk.mat].color);
      Audio8.play('pickup');
      break;
    case 'item':
      if (C.skipNormal && pk.item.rarity === 'normal') return;
      if (C.inv.length >= INV_SIZE) { if (!pk.warned) { toast('인벤토리가 가득 찼습니다'); pk.warned = true; } return; }
      C.inv.push(pk.item);
      toast(`<span class="c-${pk.item.rarity}">${pk.item.name}</span> 획득`);
      Audio8.play('pickup');
      break;
  }
  pk.dead = true;
  updateHudButtons();
}
const INV_SIZE = 24;

// ===== 오브젝트 =====
function breakObjects(box) {
  let broke = false;
  for (const o of L.objs) {
    if (o.used || (o.kind !== 'chest' && o.kind !== 'urn') || !overlap(box, o)) continue;
    o.used = true; broke = true;
    const x = o.x + o.w / 2, y = o.y;
    if (o.kind === 'urn') {
      burst(x, y + 6, '#a07050', 8);
      if (Math.random() < 0.5) spawnPickup('gold', x, y, { amount: irand(L.mlvl, L.mlvl * 4 + 5) });
      else if (Math.random() < 0.5) spawnPickup(Math.random() < 0.6 ? 'hp' : 'mp', x, y);
    } else {
      burst(x, y + 6, '#d0a040', 12);
      if (Math.random() < 0.14) {
        // 마계촌 보물상자의 마법사 — 저주로 오리가 된다!
        fx.push({ kind: 'wizard', x, y: y - 8, t: 1.2, max: 1.2 });
        P.duck = 6;
        banner2('저주! 오리로 변했다!', '#b48cff');
        Audio8.play('curse');
      } else {
        spawnPickup('item', x, y, { item: genItem(L.mlvl + 1, { mf: S.mf, boost: 0.2 }) });
        spawnPickup('gold', x, y, { amount: irand(L.mlvl * 3, L.mlvl * 8 + 10) });
        if (Math.random() < 0.2) spawnPickup('armor', x, y);
        if (Math.random() < 0.5) spawnPickup('mat', x, y, { mat: 'iron', amount: irand(1, 2) });
      }
    }
    Audio8.play('hit');
  }
  return broke;
}

function activateShrine(o) {
  o.used = true;
  const names = { life: '회복의 성소', armor: '강철의 성소', exp: '경험의 성소', combat: '전투의 성소' };
  switch (o.sub) {
    case 'life': P.hp = S.maxHP; P.mp = S.maxMP; break;
    case 'armor': P.armor = S.armorMax; break;
    case 'exp': P.buffs.exp = 45; break;
    case 'combat': P.buffs.combat = 30; break;
  }
  banner2(names[o.sub], '#7fd0ff');
  burst(o.x + 8, o.y + 8, '#7fd0ff', 24);
  Audio8.play('shrine');
}

// ===== 투사체 =====
function updateShots(dt) {
  for (const s of shots) {
    s.life -= dt;
    if (s.grav) s.vy += s.grav * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.rot = (s.rot || 0) + dt * 18;
    if (s.kind === 'weapon' && s.wt === 'orb') {
      // 약한 유도
      let best = null, bd = 140;
      for (const e of enemies) {
        if (e.dead || e.dormant || e.phased) continue;
        const d = Math.hypot(e.x + e.w / 2 - s.x, e.y + e.h / 2 - s.y);
        if (d < bd && Math.sign(e.x - s.x) === Math.sign(s.vx)) { bd = d; best = e; }
      }
      if (best) s.vy += clamp((best.y + best.h / 2 - s.y) * 6, -300, 300) * dt;
    }
    if (s.kind === 'frozenOrb') {
      s.emit -= dt;
      if (s.emit <= 0) {
        s.emit = 0.07; s.ang += 2.4;
        shots.push({ kind: 'shard', x: s.x + 3, y: s.y + 3, w: 4, h: 4, vx: Math.cos(s.ang) * 210, vy: Math.sin(s.ang) * 210, grav: 0, life: 0.45, pierce: 0, hit: new Set(), dmg: spellPower(8 + s.lv * 6) });
      }
      if (s.life <= 0) {
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2;
          shots.push({ kind: 'shard', x: s.x + 3, y: s.y + 3, w: 4, h: 4, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, grav: 0, life: 0.45, pierce: 0, hit: new Set(), dmg: spellPower(8 + s.lv * 6) });
        }
      }
    }
    // 지형 충돌
    if (s.kind !== 'frozenOrb' && s.kind !== 'boneSpear' && solidAtPx(s.x + s.w / 2, s.y + s.h / 2)) {
      if (s.kind === 'weapon' && s.wt === 'torch') {
        fx.push({ kind: 'flame', x: s.x - 8, y: Math.floor((s.y + s.h / 2) / TILE) * TILE - 10, w: 20, h: 10, t: 1.4, max: 1.4, tick: 0 });
        Audio8.play('fire');
      }
      s.life = 0;
      continue;
    }
    if (s.y > VH + 20 || s.x < camX - 60 || s.x > camX + VW + 60) s.life = 0;
    // 적 명중
    const box = s;
    for (const e of enemies) {
      if (s.life <= 0) break;
      if (e.dead || s.hit.has(e) || !overlap(box, e)) continue;
      let dmg, crit = false, cold = false;
      let type = 'phys';
      if (s.kind === 'weapon') { const r = rollWeaponDamage(); dmg = r.dmg; crit = r.crit; type = weaponDmgType(C.cls, s.wt); }
      else { dmg = s.dmg; cold = s.kind === 'shard'; type = cold ? 'cold' : 'magic'; }
      const ok = hitEnemy(e, dmg, { crit, type, leech: s.kind === 'weapon', proj: s, skipAdd: s.kind !== 'weapon', noElem: s.kind !== 'weapon' && !cold });
      if (!ok) continue;
      s.hit.add(e);
      if (s.kind === 'weapon' && s.wt === 'torch') {
        fx.push({ kind: 'flame', x: s.x - 8, y: e.y + e.h - 10, w: 20, h: 10, t: 1.2, max: 1.2, tick: 0 });
      }
      if (s.pierce-- <= 0) s.life = 0;
    }
    if (s.life > 0 && s.kind === 'weapon' && breakObjects(s)) s.life = 0;
  }
  shots = shots.filter(s => s.life > 0);

  // 적 투사체
  for (const s of eshots) {
    s.life -= dt;
    if (s.grav) s.vy += s.grav * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.kind !== 'beam' && s.kind !== 'wave' && solidAtPx(s.x + s.w / 2, s.y + s.h / 2)) { s.life = 0; continue; }
    if (s.kind === 'beam') { if (s.warn > 0) { s.warn -= dt; continue; } }
    if (overlap(s, P)) { hurtPlayer(s.dmg, s.x + s.w / 2, { slowWeb: s.kind === 'web' }); if (s.kind !== 'beam') s.life = 0; }
    for (const m of minions) if (s.life > 0 && s.kind !== 'beam' && overlap(s, m)) { m.hp -= s.dmg; s.life = 0; }
  }
  eshots = eshots.filter(s => s.life > 0 && s.y < VH + 30);

  // 화염 지대, 이펙트
  for (const f of fx) {
    f.t -= dt;
    if (f.kind === 'flame') {
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.3;
        for (const e of enemies) if (!e.dead && overlap(f, e)) hitEnemy(e, Math.max(1, Math.round(rollWeaponDamage(0.35).dmg)), { noElem: true, type: 'fire' });
      }
    }
  }
  fx = fx.filter(f => f.t > 0);
}

// ===== 소환수 (해골) =====
function updateMinions(dt) {
  for (const m of minions) {
    m.anim += dt * 6;
    if (m.rise > 0) { m.rise -= dt; continue; }
    let target = null, bd = 170;
    for (const e of enemies) {
      if (e.dead || e.dormant || e.phased || e.def.fly && e.y < P.y - 60) continue;
      const d = Math.abs(e.x - m.x) + Math.abs(e.y - m.y) * 0.5;
      if (d < bd) { bd = d; target = e; }
    }
    const tx = target ? target.x : P.x - P.face * 20;
    const dx = tx - m.x;
    m.vx = Math.abs(dx) > 8 ? Math.sign(dx) * 70 : 0;
    if (m.vx) m.face = Math.sign(m.vx);
    if (m.hitWall && m.onGround) m.vy = -300;
    moveBody(m, dt);
    if (Math.abs(m.x - P.x) > 260 || m.y > VH) { m.x = P.x; m.y = P.y; m.vy = 0; }
    m.atk -= dt;
    if (target && m.atk <= 0 && overlap({ x: m.x - 6, y: m.y, w: m.w + 12, h: m.h }, target)) {
      m.atk = 0.8;
      hitEnemy(target, Math.round(rollWeaponDamage(0.5).dmg * (1 + m.lv * 0.1)) + m.lv * 2, { noElem: true, type: 'phys', col: '#cfe8c0' });
    }
    for (const e of enemies) {
      if (e.dead || e.dormant || e.phased || !overlap(m, e)) continue;
      m.hp -= e.dmg * dt * 0.8;
    }
  }
  const before = minions.length;
  minions = minions.filter(m => m.hp > 0);
  if (minions.length < before) burst(P.x, P.y, '#ddd', 4);
}

// ===== 적 AI =====
function updateEnemies(dt) {
  const px = P.x + P.w / 2, py = P.y + P.h / 2;
  for (const e of enemies) {
    if (e.dead) continue;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    if (!e.def.boss && (e.x < camX - 140 || e.x > camX + VW + 140)) continue; // 화면 밖: 휴면
    e.t += dt; e.flash -= dt;
    if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnDps * dt; if (e.hp <= 0) { killEnemy(e); continue; } }
    const sf = (e.slow > 0 ? 0.5 : 1); e.slow -= dt;
    if (e.stun > 0) { e.stun -= dt; e.vx *= 0.9; if (!e.def.fly) moveBody(e, dt); continue; }
    const edt = dt * sf;
    const dir = Math.sign(px - ex) || 1;

    if (e.dormant) {
      // 땅속에서 일어나는 좀비
      if (Math.abs(px - ex) < 120) { e.dormant = false; e.rise = 0.8; burst(ex, e.y + e.h, '#5a4030', 8); }
      continue;
    }
    if (e.rise > 0) { e.rise -= dt; continue; }

    switch (e.def.ai) {
      case 'walker':
        e.face = dir;
        e.vx = dir * e.spd * sf;
        moveBody(e, edt);
        if (e.hitWall && e.onGround) e.vy = -240;
        break;
      case 'spider':
        e.face = dir;
        e.vx = dir * e.spd * sf;
        if (e.onGround && Math.abs(px - ex) < 70 && e.cd <= 0) { e.vy = -260; e.cd = 1.5; }
        e.cd -= dt;
        moveBody(e, edt);
        if (e.hitWall && e.onGround) e.vy = -240;
        break;
      case 'knight': {
        e.face = dir;
        const edge = groundBelow(ex + dir * 10, e.y + e.h) === null;
        e.vx = edge ? 0 : dir * e.spd * sf;
        e.cd -= dt;
        if (e.cd <= 0 && Math.abs(px - ex) < 60) { e.cd = 2; e.vx = dir * 200; e.vy = -150; }
        moveBody(e, edt);
        break;
      }
      case 'flyer':
        if (e.state === 'idle') { if (Math.abs(px - ex) < 170) e.state = 'fly'; break; }
        e.face = dir;
        e.vx += (dir * e.spd - e.vx) * Math.min(1, dt * 1.5);
        e.y += (Math.sin(e.t * 4) * 40 + (py - ey) * 0.9) * edt;
        e.x += e.vx * edt;
        break;
      case 'archer':
        e.face = dir;
        e.cd -= edt;
        if (!e.onGround) moveBody(e, edt);
        else moveBody(e, edt);
        if (e.cd <= 0 && Math.abs(px - ex) < 230) {
          e.cd = rand(2, 3);
          eshots.push({ kind: 'arrow', x: ex, y: e.y + 8, w: 10, h: 3, vx: dir * 170, vy: 0, dmg: e.dmg, life: 2.5 });
        }
        break;
      case 'ghost': {
        const cyc = (e.t % 3.2);
        e.phased = cyc > 2.1;
        const a = Math.atan2(py - ey, px - ex);
        e.x += Math.cos(a) * e.spd * edt; e.y += Math.sin(a) * e.spd * edt;
        e.face = dir;
        break;
      }
      case 'plant':
        e.face = dir;
        e.cd -= edt;
        moveBody(e, edt);
        if (e.cd <= 0 && Math.abs(px - ex) < 200) {
          e.cd = rand(1.8, 2.6);
          const dx = px - ex;
          eshots.push({ kind: 'seed', x: ex, y: e.y + 2, w: 6, h: 6, vx: dx * 0.9, vy: -260, grav: 500, dmg: e.dmg, life: 3 });
        }
        break;
      case 'imp':
        e.face = dir;
        e.cd -= edt;
        if (e.onGround) {
          e.vx = 0;
          if (e.t > 1) { e.t = 0; e.vy = -220; e.vx = dir * e.spd; }
        }
        if (e.cd <= 0 && Math.abs(px - ex) < 220) {
          e.cd = rand(2, 3);
          eshots.push({ kind: 'fire', x: ex, y: e.y + 4, w: 7, h: 7, vx: dir * 140, vy: -120, grav: 300, dmg: e.dmg, life: 3 });
        }
        moveBody(e, edt);
        break;
      case 'demon': demonAI(e, edt, px, py, ex, ey, dir); break;
      default: bossAI(e, dt, edt, px, py, ex, ey, dir);
    }
    if (e.y > VH + 40) { e.dead = true; continue; }
    // 접촉 피해
    if (!e.phased && e.rise <= 0 && overlap(e, P)) hurtPlayer(e.dmg, ex);
    // 엘리트 냉기: 접촉 시 둔화
  }
  enemies = enemies.filter(e => !e.dead);

  // 마계촌식 좀비 무한 출현
  if (L.act === 0 || L.act === 1) {
    L.zTimer = (L.zTimer ?? 3) - dt;
    const alive = enemies.filter(e => e.x > camX - 50 && e.x < camX + VW + 50).length;
    if (L.zTimer <= 0 && alive < 8 && !L.bossLock && !P.cleared) {
      L.zTimer = rand(2.5, 5);
      const sx = P.x + rand(-140, 160);
      const c = Math.floor(sx / TILE);
      if (L.ground[c] >= 0 && Math.abs(sx - P.x) > 40 && sx > 60 && sx < L.width - 120) {
        const e = spawnEnemy('zombie', c * TILE + 2, L.ground[c] * TILE - 22, {});
        e.rise = 0.8; burst(c * TILE + 8, L.ground[c] * TILE, '#5a4030', 8);
      }
    }
  }
}

function demonAI(e, dt, px, py, ex, ey, dir) {
  // 붉은 악마: 공중에서 맴돌다 급강하 + 투사체 회피
  e.cd -= dt; e.dodgeCd -= dt;
  if (e.dodgeCd <= 0) {
    for (const s of shots) {
      if (Math.abs(s.y - ey) < 16 && Math.abs(s.x - ex) < 60 && Math.sign(ex - s.x) === Math.sign(s.vx)) {
        if (Math.random() < 0.5) { e.state = 'dodge'; e.vy = -260; e.dodgeCd = 1.2; }
        else e.dodgeCd = 0.4;
        break;
      }
    }
  }
  if (e.state === 'dodge') {
    e.y += e.vy * dt; e.vy += 500 * dt;
    if (e.vy > 0) e.state = 'hover';
    return;
  }
  if (e.state === 'dive') {
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.y > py + 10 || e.cd < -1.2) { e.state = 'rise'; e.cd = 0; }
    return;
  }
  if (e.state === 'rise') {
    e.y -= 110 * dt; e.x += e.vx * 0.3 * dt;
    if (e.y < 70) { e.state = 'hover'; e.cd = rand(1.2, 2.2); }
    return;
  }
  // hover
  e.state = 'hover';
  e.face = dir;
  const tx = px - dir * 70, ty = 70 + Math.sin(e.t * 3) * 14;
  e.x += clamp(tx - ex, -1, 1) * 80 * dt;
  e.y += (ty - ey) * dt * 2;
  if (e.cd <= 0 && Math.abs(px - ex) < 180) {
    const a = Math.atan2(py - ey, px - ex);
    e.vx = Math.cos(a) * e.spd; e.vy = Math.sin(a) * e.spd;
    e.state = 'dive'; e.cd = 0;
  }
}

// ===== 보스 =====
function triggerBoss() {
  L.bossTriggered = true; L.bossLock = true;
  const type = ACTS[L.act].boss;
  const d = ENEMIES[type];
  const ax = (L.cols - 12) * TILE;
  const y = d.fly ? 60 : 13 * TILE - d.h;
  bossRef = spawnEnemy(type, ax, y, {});
  // 입구 봉쇄
  for (let r = 0; r < 13; r++) L.t[r * L.cols + L.arenaStart - 1] = 1;
  banner = { t: 3.5, title: d.name, sub: `${FAMILIES[ENEMY_FAMILY[type]].name} — ${familyWeakText(ENEMY_FAMILY[type])}`, boss: true };
  Audio8.play('boss');
  Audio8.music('boss');
}

function bossAI(e, dt, edt, px, py, ex, ey, dir) {
  if (e.state === 'intro') { e.cd -= dt; if (e.cd <= 0) { e.state = 'walk'; e.cd = 1.5; } if (!e.def.fly) moveBody(e, dt); return; }
  const rage = e.hp < e.maxHp * 0.5;
  const R = rage ? 1.35 : 1;
  e.cd -= dt * R;
  switch (e.def.ai) {
    case 'graveLord':
      if (e.state === 'walk') {
        e.face = dir; e.vx = dir * e.spd * (rage ? 1.4 : 1);
        if (e.cd <= 0) {
          e.state = pick(['slam', 'throw', 'summon', 'slam']);
          e.cd = 0.6; e.vx = 0;
          if (e.state === 'slam') { e.vy = -380; e.vx = dir * 90; }
        }
      } else if (e.state === 'slam') {
        if (e.onGround && e.cd <= 0.3) {
          shake = 0.3; Audio8.play('smite');
          for (const s of [-1, 1]) eshots.push({ kind: 'wave', x: ex, y: e.y + e.h - 12, w: 12, h: 12, vx: s * 170, vy: 0, dmg: e.dmg, life: 1.8 });
          e.state = 'walk'; e.cd = rand(1.4, 2.2);
        }
      } else if (e.state === 'throw') {
        if (e.cd <= 0) {
          for (let i = 0; i < 3; i++) eshots.push({ kind: 'bone', x: ex, y: e.y + 6, w: 8, h: 8, vx: (px - ex) * (0.6 + i * 0.25), vy: -300, grav: 500, dmg: Math.round(e.dmg * 0.8), life: 3 });
          e.state = 'walk'; e.cd = rand(1.5, 2.2);
        }
      } else if (e.state === 'summon') {
        if (e.cd <= 0) {
          for (let i = 0; i < 2 + (rage ? 1 : 0); i++) {
            const c = Math.floor((L.arenaStart + 3 + Math.random() * (L.cols - L.arenaStart - 6)));
            const z = spawnEnemy('zombie', c * TILE, 13 * TILE - 22, {}); z.rise = 0.8; z.exp = Math.round(z.exp * 0.3);
          }
          e.state = 'walk'; e.cd = rand(2, 3);
        }
      }
      moveBody(e, edt);
      break;

    case 'spiderQueen':
      if (e.state === 'walk') {
        e.face = dir; e.vx = dir * e.spd;
        if (e.cd <= 0) { e.state = pick(['leap', 'web', 'brood', 'leap']); e.cd = 0.5; e.vx = 0; }
      } else if (e.state === 'leap') {
        if (e.cd <= 0 && e.onGround && !e.leapt) { e.vy = -360; e.vx = (px - ex) * 1.1; e.leapt = true; }
        if (e.leapt && e.onGround && e.vy >= 0) { e.leapt = false; e.state = 'walk'; e.cd = rand(1, 1.8); shake = 0.2; }
      } else if (e.state === 'web') {
        if (e.cd <= 0) {
          for (let i = -1; i <= 1; i++) eshots.push({ kind: 'web', x: ex, y: e.y + 8, w: 10, h: 10, vx: dir * 150, vy: i * 50, dmg: Math.round(e.dmg * 0.6), life: 2.5 });
          e.state = 'walk'; e.cd = rand(1.4, 2);
        }
      } else if (e.state === 'brood') {
        if (e.cd <= 0) {
          for (let i = 0; i < 3; i++) { const s = spawnEnemy('spiderling', ex + rand(-20, 20), e.y + 10, {}); s.vy = -200; s.exp = Math.round(s.exp * 0.3); }
          e.state = 'walk'; e.cd = rand(2, 3);
        }
      }
      moveBody(e, edt);
      if (e.hitWall && e.onGround) e.vy = -300;
      break;

    case 'flameTyrant': {
      e.face = dir;
      if (e.state === 'walk') {
        const tx = px + Math.sin(e.t * 0.8) * 120, ty = 50 + Math.sin(e.t * 2) * 15;
        e.x += clamp(tx - ex, -1, 1) * e.spd * edt;
        e.y += (ty - ey) * edt * 2;
        if (e.cd <= 0) { e.state = pick(['rain', 'spread', 'dive']); e.cd = 0.5; }
      } else if (e.state === 'rain') {
        if (e.cd <= 0) {
          const x0 = L.arenaStart * TILE, x1 = (L.cols - 1) * TILE;
          for (let i = 0; i < (rage ? 12 : 8); i++) eshots.push({ kind: 'fire', x: rand(x0, x1), y: -10 - i * 25, w: 8, h: 8, vx: 0, vy: 150, dmg: e.dmg, life: 4 });
          e.state = 'walk'; e.cd = rand(2, 2.8);
        }
      } else if (e.state === 'spread') {
        if (e.cd <= 0) {
          const a0 = Math.atan2(py - ey, px - ex);
          const n = rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = a0 + (i - (n - 1) / 2) * 0.22;
            eshots.push({ kind: 'fire', x: ex, y: ey, w: 8, h: 8, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, dmg: e.dmg, life: 3 });
          }
          e.state = 'walk'; e.cd = rand(1.4, 2);
        }
      } else if (e.state === 'dive') {
        if (!e.diving) { const a = Math.atan2(py - ey, px - ex); e.vx = Math.cos(a) * 240; e.vy = Math.sin(a) * 240; e.diving = true; }
        e.x += e.vx * edt; e.y += e.vy * edt;
        if (e.y > 13 * TILE - e.h || e.cd < -1) { e.diving = false; e.state = 'walk'; e.cd = rand(1.5, 2.2); }
      }
      e.x = clamp(e.x, L.arenaStart * TILE, (L.cols - 1) * TILE - e.w);
      e.y = clamp(e.y, 10, 13 * TILE - e.h);
      break;
    }

    case 'terrorLord':
      if (e.state === 'walk') {
        e.face = dir; e.vx = dir * e.spd * (rage ? 1.5 : 1);
        if (e.cd <= 0) { e.state = pick(rage ? ['nova', 'beam', 'summon', 'nova', 'beam'] : ['nova', 'beam', 'summon']); e.cd = 0.7; e.vx = 0; }
      } else if (e.state === 'nova') {
        if (e.cd <= 0) {
          const n = rage ? 16 : 12;
          for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + e.t;
            eshots.push({ kind: 'fire', x: ex, y: ey, w: 8, h: 8, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, dmg: e.dmg, life: 2.5 });
          }
          Audio8.play('fire');
          e.state = 'walk'; e.cd = rand(1.5, 2.2);
        }
      } else if (e.state === 'beam') {
        if (e.cd <= 0) {
          const x0 = L.arenaStart * TILE, x1 = (L.cols - 1) * TILE;
          const ys = rage ? [P.y + 6, P.y - 40] : [P.y + 6];
          for (const y of ys) eshots.push({ kind: 'beam', x: x0, y, w: x1 - x0, h: 8, vx: 0, vy: 0, dmg: Math.round(e.dmg * 1.1), life: 1.2, warn: 0.7 });
          Audio8.play('zap');
          e.state = 'walk'; e.cd = rand(1.8, 2.5);
        }
      } else if (e.state === 'summon') {
        if (e.cd <= 0) {
          const s = spawnEnemy(rage ? 'demon' : 'imp', ex + rand(-40, 40), rage ? 60 : e.y, {});
          s.exp = Math.round(s.exp * 0.3);
          e.state = 'walk'; e.cd = rand(2, 3);
        }
      }
      moveBody(e, edt);
      if (e.hitWall && e.onGround) e.vy = -320;
      break;
  }
}

function onBossDead(e) {
  shake = 0.6;
  L.bossLock = false;
  const last = L.stageIdx === STAGE_COUNT - 1;
  setTimeout(() => { if (P && !P.dead) (last ? finalVictory : stageClear)(); }, 2500);
}

// ===== 파티클 / 텍스트 =====
function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-90, 90), vy: rand(-140, 30), t: rand(0.3, 0.7), col, sz: rand(1, 3), grav: 1 });
}
function addText(x, y, txt, col) { texts.push({ x, y, txt, col, t: 0.9 }); }
function banner2(title, col) { banner = { t: 1.8, title, col, small: true }; }

function updateParticles(dt) {
  for (const p of parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += 400 * dt; }
  parts = parts.filter(p => p.t > 0);
  if (parts.length > 400) parts.splice(0, parts.length - 400);
  for (const t of texts) { t.t -= dt; t.y -= 24 * dt; }
  texts = texts.filter(t => t.t > 0);
  for (const pk of pickups) {
    pk.t += dt;
    if (!pk.grounded) { moveBody(pk, dt); pk.vx *= 0.98; if (pk.onGround) { pk.grounded = true; pk.vx = 0; } }
    if (pk.y > VH + 20) pk.dead = true;
  }
  pickups = pickups.filter(p => !p.dead);
}
