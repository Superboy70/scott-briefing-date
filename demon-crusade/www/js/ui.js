'use strict';
// ===== 메뉴 / 마을 / 저장 =====
const SAVE_KEY = 'demonCrusade.save.v1';
const SETTINGS_KEY = 'demonCrusade.settings.v1';
const uiEl = document.getElementById('ui');
const controlsEl = document.getElementById('controls');
const G = { state: 'title', view: 'main', sel: null, shopStock: [], gambleMsg: '', invTab: 'inv', from: 'town' };

// ---------- 저장 ----------
function saveGame() {
  if (!C) return;
  if (P && G.state === 'play' && !P.dead) C.armorCur = P.armor;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(C)); } catch (e) { /* 저장소 사용 불가 */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !d.cls || !CLASSES[d.cls]) return null;
    return ensureCharData(d);
  } catch (e) { return null; }
}
function hasSave() { return !!loadGame(); }
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: Audio8.musicOn, sfx: Audio8.sfxOn })); } catch (e) { /* 무시 */ }
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (s.music === false) Audio8.setMusic(false);
    if (s.sfx === false) Audio8.setSfx(false);
  } catch (e) { /* 무시 */ }
}

// ---------- 토스트 ----------
let toastTimer = null;
function toast(html) {
  const t = document.getElementById('toast');
  t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}

function setControls(on) { controlsEl.classList.toggle('hidden', !on); }
function updateHudButtons() {
  if (!C) return;
  document.getElementById('hp-cnt').textContent = C.hpPot;
  document.getElementById('mp-cnt').textContent = C.mpPot;
  const sk = CLASSES[C.cls].skills;
  for (let i = 0; i < 2; i++) {
    document.getElementById(`s${i + 1}-name`).textContent = SKILLS[sk[i]].name;
    document.getElementById(`btn-s${i + 1}`).classList.toggle('locked', !(C.skills[sk[i]] > 0));
  }
}

// ---------- 화면 전환 ----------
function show(html) { uiEl.innerHTML = html; uiEl.scrollTop = 0; }

function goTitle() {
  G.state = 'title'; setControls(false);
  Audio8.music('act0');
  const save = loadGame();
  show(`<div class="panel center">
    <h1>마계 성전</h1>
    <div class="sub-title">DEMON CRUSADE</div>
    <div class="menu-list" style="max-width:320px;margin:0 auto">
      ${save ? `<button class="primary" data-act="continue">이어하기 <span class="dim">(${CLASSES[save.cls].name} Lv${save.level})</span></button>` : ''}
      <button ${save ? '' : 'class="primary"'} data-act="newGame">새 게임</button>
      <button data-act="help">조작법 · 게임 방법</button>
      <button data-act="settings">설정</button>
    </div>
    <p class="dim" style="margin-top:10px">갑옷이 부서지면 속옷 차림… 두 번 깨야 진짜 엔딩.</p>
    <p class="dim" style="font-size:11px">v${APP_VERSION}</p>
  </div>`);
}

function goClassSelect() {
  G.state = 'class';
  const cards = Object.entries(CLASSES).map(([k, c]) => `
    <div class="class-card">
      <div class="portraits"><img src="${heroPortrait(k)}" alt=""><img class="bare" src="${heroPortrait(k, true)}" alt=""></div>
      <h3>${c.name} <span class="dim">${c.eng}</span></h3>
      <p style="font-size:13px">${c.desc}</p>
      <p class="dim">힘 ${c.base.str} · 민첩 ${c.base.dex} · 활력 ${c.base.vit} · 에너지 ${c.base.ene}</p>
      <p class="dim">무기: ${WEAPON_TYPES[c.weapon].name} · 스킬: ${c.skills.map(s => SKILLS[s].name).join(', ')}</p>
      <p style="font-size:12px;color:#ffe07a">상성: ${c.matchup}</p>
      <button class="primary" data-act="pickClass" data-arg="${k}">선택</button>
    </div>`).join('');
  show(`<div class="panel wide"><h2>직업 선택</h2><div class="row">${cards}</div>
    <button data-act="title">뒤로</button></div>`);
}

function enterTown() {
  G.state = 'town'; G.view = 'main'; G.sel = null; G.from = 'town';
  setControls(false);
  calcStats();
  if (P) C.armorCur = Math.min(S.armorMax, C.armorCur ?? S.armorMax);
  P = null;
  refreshShop();
  Audio8.music('town');
  saveGame();
  renderTown();
}

function refreshShop() {
  G.shopStock = [];
  for (let i = 0; i < 4; i++) {
    const it = genItem(C.level + DIFFS[C.diff].lvl * 0.5, { rarity: Math.random() < 0.1 ? 'rare' : 'magic' });
    G.shopStock.push(it);
  }
}

const potionPrice = () => 20 + C.level * 3;
const repairCost = () => Math.ceil((S.armorMax - (C.armorCur ?? 0)) * 0.5 * (1 + C.diff));
const gamblePrice = () => (120 + C.level * 30) * (1 + C.diff);

// ---------- 마을 공통 프레임 ----------
const TOWN_TABS = [
  ['main', '🏕', '야영지'], ['wp', '⛩', '출발'], ['shop', '🧪', '상점'], ['smith', '⚒', '대장간'],
  ['craft', '⚗', '제작'], ['gamble', '🎲', '도박'], ['stash', '📦', '창고'], ['inv', '🎒', '가방'],
  ['char', '📜', '능력치'], ['skill', '✦', '스킬'], ['settings', '⚙', '설정'],
];
const PAUSE_TABS = [['main', '⏸', '메뉴'], ['inv', '🎒', '가방'], ['char', '📜', '능력치'], ['skill', '✦', '스킬'], ['settings', '⚙', '설정']];

function matsBar() {
  return Object.keys(MATS).map(k => `<span title="${MATS[k].name}" style="color:${MATS[k].color}">${MATS[k].icon}${C.mats[k]}</span>`).join(' ');
}
function townHeader() {
  return `<div class="topbar">
    <b>${CLASSES[C.cls].name} Lv${C.level}</b>
    <span style="color:#ffd24a">${C.gold} G</span>
    <span class="mats">${matsBar()}</span>
    <span style="color:${DIFFS[C.diff].color}">${DIFFS[C.diff].name}</span>
  </div>`;
}
function navBar() {
  const tabs = G.state === 'pause' ? PAUSE_TABS : TOWN_TABS;
  const dot = k => (k === 'char' && C.statPts) || (k === 'skill' && C.skillPts) ? '<i class="dot"></i>' : '';
  return `<div class="navbar">${tabs.map(([k, ic, name]) =>
    `<button class="${G.view === k ? 'on' : ''}" data-act="view" data-arg="${k}"><span class="ic">${ic}</span><span>${name}</span>${dot(k)}</button>`).join('')}
    ${G.state === 'pause' ? '<button class="primary" data-act="resume"><span class="ic">▶</span><span>계속</span></button>' : ''}</div>`;
}
function uiFrame(title, body, extraCls = '') {
  const inGame = G.state === 'town' || G.state === 'pause';
  if (!inGame) return show(`<div class="panel wide ${extraCls}"><h3>${title}</h3>${body}${backBtn()}</div>`);
  show(`<div class="panel wide frame ${extraCls}">${townHeader()}${navBar()}
    <div class="content">${title ? `<h3>${title}</h3>` : ''}${body}</div></div>`);
}
function backBtn() { return `<button data-act="back">← 뒤로</button>`; }

function renderTown() {
  if (G.view !== 'main') return renderSub();
  const npc = (v, ic, name, role, info, cls = '') => `<div class="npc ${cls}" data-act="view" data-arg="${v}">
    <div class="ic">${ic}</div><div><b>${name}</b><div class="dim">${role}</div>${info ? `<div class="info">${info}</div>` : ''}</div></div>`;
  const need = (C.armorCur ?? 0) < S.armorMax;
  uiFrame('', `<div class="npcs">
    ${npc('wp', '⛩', '웨이포인트', '지역 선택 · 출발', `진행: ${stageInfo(Math.max(0, C.progress[C.diff])).name}`, 'hot')}
    ${npc('shop', '🧪', '상인 엘라', '물약 · 장비 구매/판매', `물약 ♥${C.hpPot} ✦${C.mpPot}`)}
    ${npc('smith', '⚒', '대장장이 찰스', '갑옷 수리 · 장비 강화', need ? `<span class="c-red">수리 필요 ${repairCost()}G</span>` : '갑옷 상태 양호')}
    ${npc('craft', '⚗', '호라드릭 제단', '분해 · 재조정 · 승급 · 고유 제작', matsBar())}
    ${npc('gamble', '🎲', '도박꾼 기드', '미확인 아이템 도박', `${gamblePrice()}G / 회`)}
    ${npc('stash', '📦', '개인 창고', '아이템 보관', `${C.stash.length}/${STASH_SIZE}`)}
  </div>
  <div class="row" style="margin-top:8px;justify-content:space-between;align-items:center">
    <span class="dim">갑옷 ${Math.ceil(C.armorCur ?? 0)}/${S.armorMax} · 처치 ${C.kills} · 사망 ${C.deaths}</span>
    <button class="mini" data-act="saveQuit">💾 저장 후 타이틀로</button>
  </div>`);
}

function renderSub() {
  switch (G.view) {
    case 'main': return G.state === 'pause' ? renderPause() : G.state === 'town' ? renderTown() : goTitle();
    case 'wp': return renderWaypoint();
    case 'shop': return renderShop();
    case 'smith': return renderSmith();
    case 'craft': return renderCraft();
    case 'gamble': return renderGamble();
    case 'stash': return renderStash();
    case 'inv': return renderInventory();
    case 'char': return renderChar();
    case 'skill': return renderSkills();
    case 'settings': return renderSettings();
    case 'help': return renderHelp();
  }
}

function renderWaypoint() {
  const tabs = DIFFS.map((d, i) => C.progress[i] >= 0
    ? `<button class="${C.diff === i ? 'on' : ''}" data-act="diff" data-arg="${i}" style="color:${d.color}">${d.name}${C.cleared[i] ? ' ✓' : ''}</button>`
    : `<button disabled>${d.name} 🔒</button>`).join('');
  let html = '';
  for (let a = 0; a < ACTS.length; a++) {
    html += `<div class="act">${ACTS[a].name}</div>`;
    for (let s = 0; s < 3; s++) {
      const idx = a * 3 + s;
      const open = idx <= C.progress[C.diff];
      const ml = monsterLevel(idx, C.diff);
      const cp = C.checkpoint && C.checkpoint.stage === idx && C.checkpoint.diff === C.diff ? ' ⚑' : '';
      const fam = s === 2 ? FAMILIES[ENEMY_FAMILY[ACTS[a].boss]].name : '';
      html += open
        ? `<button data-act="go" data-arg="${idx}">${s === 2 ? '☠ ' : ''}${ACTS[a].stages[s]}${cp}<br><span class="dim">몬스터 Lv ${ml}${fam ? ' · 보스 ' + fam : ''}</span></button>`
        : `<button disabled>🔒 ???</button>`;
    }
  }
  uiFrame('웨이포인트', `<div class="tabs">${tabs}</div><div class="wp">${html}</div>`);
}

function renderShop() {
  const pp = potionPrice();
  const stock = G.shopStock.map((it, i) => `
    <div class="card"><div class="row" style="align-items:flex-start">
      <div class="grow">${itemLines(it)}</div>
      <div class="grow cmpbox"><div class="dim">착용 장비 대비</div>${compareLines(it, C.equip[it.slot])}</div>
      <button data-act="buyItem" data-arg="${i}" ${C.gold < it.value * 4 ? 'disabled' : ''}>${it.value * 4} G</button>
    </div></div>`).join('') || '<p class="dim">오늘은 물건이 다 팔렸습니다.</p>';
  uiFrame('상인 엘라', `
    <div class="row">
      <button data-act="buyPot" data-arg="hp" ${C.gold < pp || C.hpPot >= 10 ? 'disabled' : ''}>♥ 생명력 물약 ${pp} G (${C.hpPot}/10)</button>
      <button data-act="buyPot" data-arg="mp" ${C.gold < pp || C.mpPot >= 10 ? 'disabled' : ''}>✦ 마나 물약 ${pp} G (${C.mpPot}/10)</button>
      <button data-act="view" data-arg="inv">아이템 판매 → 가방</button>
    </div>
    <h3 style="margin-top:8px">진열 상품</h3>${stock}`);
}

// ---------- 아이템 셀 / 선택 ----------
function cellHtml(it, src, key) {
  if (!it) return `<div class="cell empty"></div>`;
  const sel = G.sel && G.sel.src === src && String(G.sel.key) === String(key) ? ' sel' : '';
  const cant = it.req > C.level ? ' cant' : '';
  return `<div class="cell r-${it.rarity}${sel}${cant}" data-act="sel" data-arg="${src}:${key}">${itemIcon(it)}${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}</div>`;
}
function gridHtml(list, size, src, filter) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const it = list[i];
    cells.push(it && filter && !filter(it) ? `<div class="cell off">${itemIcon(it)}</div>` : cellHtml(it, src, i));
  }
  return `<div class="grid">${cells.join('')}</div>`;
}
function slotCell(slot) {
  const it = C.equip[slot];
  if (!it) return `<div class="cell empty"><span class="dim">${SLOT_ICONS[slot]}</span><span class="slotname">${SLOT_NAMES[slot]}</span></div>`;
  return cellHtml(it, 'eq', slot).replace('</div>', `<span class="slotname">${SLOT_NAMES[slot]}</span></div>`);
}
function selItem() {
  if (!G.sel) return null;
  if (G.sel.src === 'inv') return C.inv[G.sel.key] || null;
  if (G.sel.src === 'stash') return C.stash[G.sel.key] || null;
  if (G.sel.src === 'eq') return C.equip[G.sel.key] || null;
  return null;
}
function cmpBlock(it) {
  if (G.sel && G.sel.src === 'eq') return '';
  const cur = C.equip[it.slot];
  return `<div class="cmp"><div class="dim">착용 중: ${cur ? `<span class="c-${cur.rarity}">${displayName(cur)}</span>` : '없음'}</div>${compareLines(it, cur)}</div>`;
}

function renderInventory() {
  const inTown = G.state === 'town';
  const it = selItem();
  let detail = '<span class="dim">아이템을 누르면 정보와 착용 장비 대비 변화가 표시됩니다.</span>';
  if (it) {
    detail = itemLines(it) + cmpBlock(it);
    if (G.sel.src === 'inv') {
      detail += `<div class="acts">
        <button class="primary mini" data-act="equip" ${it.req > C.level ? 'disabled' : ''}>장착</button>
        ${inTown ? `<button class="mini" data-act="sell">판매 ${it.value} G</button>` : ''}
        <button class="danger mini" data-act="drop">버리기</button></div>`;
      if (it.req > C.level) detail += `<div class="c-red" style="font-size:12px">레벨이 부족합니다</div>`;
    } else if (G.sel.src === 'eq') {
      detail += `<div class="acts"><button class="mini" data-act="unequip" ${it.slot === 'weapon' ? 'disabled' : ''}>해제</button></div>`;
    }
  }
  uiFrame(`가방 (${C.inv.length}/${INV_SIZE})`, `
    <div class="row">
      <div class="grow" style="min-width:260px">
        <div class="slots">${SLOTS.map(slotCell).join('')}</div>
        ${gridHtml(C.inv, INV_SIZE, 'inv')}
        <div class="acts"><button class="mini" data-act="sortInv">정렬</button>
        ${inTown ? '<button class="mini" data-act="sellAllNormal">일반 등급 모두 판매</button>' : ''}</div>
      </div>
      <div class="detail grow" style="min-width:220px">${detail}</div>
    </div>`);
}

function renderStash() {
  const it = selItem();
  let detail = '<span class="dim">가방 또는 창고의 아이템을 눌러 옮기세요. 창고는 모든 캐릭터 진행 중 유지됩니다.</span>';
  if (it) {
    detail = itemLines(it) + cmpBlock(it);
    if (G.sel.src === 'inv') detail += `<div class="acts"><button class="primary mini" data-act="toStash" ${C.stash.length >= STASH_SIZE ? 'disabled' : ''}>창고에 넣기 ⬇</button></div>`;
    if (G.sel.src === 'stash') detail += `<div class="acts"><button class="primary mini" data-act="toInv" ${C.inv.length >= INV_SIZE ? 'disabled' : ''}>가방으로 ⬆</button></div>`;
  }
  uiFrame('개인 창고', `
    <div class="row">
      <div class="grow" style="min-width:260px">
        <div class="dim">가방 ${C.inv.length}/${INV_SIZE}</div>${gridHtml(C.inv, INV_SIZE, 'inv')}
        <div class="dim" style="margin-top:6px">창고 ${C.stash.length}/${STASH_SIZE}</div>${gridHtml(C.stash, STASH_SIZE, 'stash')}
        <div class="acts"><button class="mini" data-act="stashAll">가방 전부 보관 (장착 제외)</button><button class="mini" data-act="sortStash">창고 정렬</button></div>
      </div>
      <div class="detail grow" style="min-width:220px">${detail}</div>
    </div>`);
}

function renderSmith() {
  const cost = repairCost();
  const need = (C.armorCur ?? 0) < S.armorMax;
  const it = selItem();
  let detail = '<span class="dim">강화할 무기·갑옷·투구를 고르세요. 강화 1단계마다 무기 피해 +8%, 방어구 내구도 +10%. 실패해도 아이템은 부서지지 않습니다(재료만 소모).</span>';
  if (it) {
    detail = itemLines(it);
    if (canEnhance(it)) {
      const e = enhanceCost(it);
      detail += `<div class="card" style="margin-top:6px">+${it.plus || 0} → <b class="c-green">+${(it.plus || 0) + 1}</b> · 성공률 <b>${e.rate}%</b><br>비용: ${costText(e.cost, e.gold)}
        <div class="acts"><button class="primary" data-act="enhance" ${hasMats(e.cost) && C.gold >= e.gold ? '' : 'disabled'}>강화하기</button></div></div>`;
    } else detail += `<div class="dim" style="margin-top:6px">${(it.plus || 0) >= ENH_MAX ? '최대 강화 단계입니다.' : '반지·목걸이는 강화할 수 없습니다.'}</div>`;
    if (G.smithMsg) detail += `<div style="margin-top:6px">${G.smithMsg}</div>`;
  }
  const enh = x => x.slot === 'weapon' || x.slot === 'armor' || x.slot === 'helm';
  uiFrame('대장장이 찰스', `
    <div class="card"><div class="row" style="align-items:center;justify-content:space-between">
      <span>"갑옷이 박살 났구먼. 속옷 차림으로 마계를 다닐 셈인가?" — 갑옷 <b>${Math.ceil(C.armorCur ?? 0)} / ${S.armorMax}</b></span>
      <button class="primary" data-act="repair" ${!need || C.gold < cost ? 'disabled' : ''}>수리 (${cost} G)</button>
    </div></div>
    <div class="row" style="margin-top:6px">
      <div class="grow" style="min-width:260px">
        <div class="dim">착용 장비</div><div class="slots">${SLOTS.map(slotCell).join('')}</div>
        <div class="dim">가방</div>${gridHtml(C.inv, INV_SIZE, 'inv', enh)}
      </div>
      <div class="detail grow" style="min-width:220px">${detail}</div>
    </div>`);
}

function renderCraft() {
  const it = G.sel && G.sel.src === 'inv' ? selItem() : null;
  let detail = '<span class="dim">가방에서 아이템을 고르면 가능한 제작법이 표시됩니다. 쓰지 않는 아이템은 분해해서 재료로 만드세요.</span>';
  if (it) {
    const y = salvageYield(it);
    detail = itemLines(it) + `<div class="recipes">
      <div class="recipe"><div><b>♻ 분해</b><div class="dim">아이템을 재료로 바꿉니다 (예상: ${matsText(y) || '없음'})</div></div>
        <button class="danger mini" data-act="salvage">분해</button></div>
      ${RECIPES.map(r => {
        const ok = r.can(it);
        const cost = r.cost(it), gold = r.gold(it);
        return `<div class="recipe ${ok ? '' : 'na'}"><div><b>${r.icon} ${r.name}</b><div class="dim">${r.desc}</div><div>${ok ? costText(cost, gold) : '<span class="dim">대상 아님</span>'}</div></div>
          <button class="primary mini" data-act="recipe" data-arg="${r.id}" ${ok && hasMats(cost) && C.gold >= gold ? '' : 'disabled'}>제작</button></div>`;
      }).join('')}</div>`;
  }
  if (G.craftMsg) detail += `<div class="card" style="margin-top:6px">${G.craftMsg}</div>`;
  const uc = uniqueCraftCost(), ug = uniqueCraftGold();
  const canU = hasMats(uc) && C.gold >= ug && C.inv.length < INV_SIZE;
  uiFrame('호라드릭 제단', `
    <div class="card">재료: ${matsBar()} <span class="dim">· 분해·보스·정예 몬스터·보물상자에서 획득</span></div>
    <div class="row" style="margin-top:6px">
      <div class="grow" style="min-width:260px">
        <div class="dim">가방</div>${gridHtml(C.inv, INV_SIZE, 'inv')}
        <div class="card" style="margin-top:6px"><b>🔮 고유 아이템 제작</b> <span class="dim">부위를 고르면 고유 아이템을 만듭니다 (레벨에 맞는 고유가 없으면 희귀).</span><br>
          비용: ${costText(uc, ug)}
          <div class="acts">${SLOTS.map(s => `<button class="mini" data-act="craftUnique" data-arg="${s}" ${canU ? '' : 'disabled'}>${SLOT_ICONS[s]} ${SLOT_NAMES[s]}</button>`).join('')}</div></div>
      </div>
      <div class="detail grow" style="min-width:220px">${detail}</div>
    </div>`);
}

function renderGamble() {
  const price = gamblePrice();
  const btns = SLOTS.map(s => `<button data-act="gamble" data-arg="${s}" ${C.gold < price ? 'disabled' : ''}>${SLOT_ICONS[s]} ${SLOT_NAMES[s]}</button>`).join('');
  uiFrame('도박꾼 기드', `
    <p>"뭐가 나올지는 나도 몰라. 운을 시험해 보겠나?" — 한 번에 <b style="color:#ffd24a">${price} G</b></p>
    <div class="row">${btns}</div>
    <div class="detail" style="margin-top:8px">${G.gambleMsg || '<span class="dim">결과가 여기에 표시됩니다.</span>'}</div>`);
}

function renderChar() {
  calcStats();
  const row = (k, name, eff) => `<tr><td>${name}<div class="dim" style="font-size:11px">${eff}</div></td><td><b>${S[k]}</b> <span class="dim">(${C.stats[k]})</span> ${C.statPts ? `<button class="mini" data-act="stat" data-arg="${k}">+</button>` : ''}</td></tr>`;
  const wt = WEAPON_TYPES[S.wtype];
  const wtype = weaponDmgType(C.cls, S.wtype);
  uiFrame(`${CLASSES[C.cls].name} · 레벨 ${C.level}`, `<div class="row">
    <div class="grow" style="min-width:250px">
      <div class="xpbar"><i style="width:${Math.min(100, C.exp / expToNext(C.level) * 100)}%"></i><span>경험치 ${C.exp} / ${expToNext(C.level)}</span></div>
      <p>남은 능력치 포인트: <b class="c-rare">${C.statPts}</b></p>
      <table class="stats">
        ${row('str', '힘', '물리 피해 +1%/점')}
        ${row('dex', '민첩', '치명타 확률 +0.2%/점')}
        ${row('vit', '활력', '생명력 +3/점')}
        ${row('ene', '에너지', '마나 +2/점, 주문 피해 증가')}
      </table>
      <p style="font-size:12px;color:#ffe07a">상성: ${CLASSES[C.cls].matchup}</p>
    </div>
    <div class="grow" style="min-width:230px">
      <table class="stats">
        <tr><td>무기</td><td>${wt.name} ${S.wmin}-${S.wmax} <span style="color:${DMG_TYPES[wtype].color}">[${DMG_TYPES[wtype].name}]</span></td></tr>
        <tr><td>생명력 / 마나</td><td>${S.maxHP} / ${S.maxMP}</td></tr>
        <tr><td>갑옷 내구도</td><td>${S.armorMax}</td></tr>
        <tr><td>받는 피해 감소</td><td>${S.dr}%</td></tr>
        <tr><td>치명타</td><td>${S.crit.toFixed(1)}%</td></tr>
        <tr><td>공격 / 이동 속도</td><td>+${S.as}% / +${S.ms}%</td></tr>
        <tr><td>생명력/마나 흡수</td><td>${S.ls}% / ${S.ml}%</td></tr>
        <tr><td>원소 피해</td><td><span class="c-red">${S.fire}</span> / <span class="c-blue">${S.cold}</span> / <span class="c-rare">${S.light}</span></td></tr>
        <tr><td>마법 아이템 / 골드 발견</td><td>${S.mf}% / ${S.gf}%</td></tr>
      </table>
    </div></div>`);
}

function renderSkills() {
  calcStats();
  const list = CLASSES[C.cls].skills.map((k, i) => {
    const base = C.skills[k] || 0;
    const lv = skillLevel(k);
    const sk = SKILLS[k];
    return `<div class="card"><div class="row" style="align-items:center">
      <div class="skicon">${sk.icon}</div>
      <div class="grow"><b>${sk.name}</b> <span class="dim">[스킬${i + 1}] Lv ${base}${S.skill && base ? ` (+${S.skill})` : ''}</span>
      <div style="font-size:13px">${sk.desc(Math.max(1, lv))}</div>
      <div class="dim">마나 ${Math.round(sk.mana(Math.max(1, lv)))} · 재사용 ${sk.cd}초</div></div>
      <button class="primary" data-act="skillUp" data-arg="${k}" ${C.skillPts && base < 20 ? '' : 'disabled'}>+</button>
    </div></div>`;
  }).join('');
  uiFrame(`스킬 — 남은 포인트 <span class="c-rare">${C.skillPts}</span>`, list);
}

function renderSettings() {
  const body = `<div class="menu-list" style="max-width:340px">
      <button data-act="toggleMusic">배경음: ${Audio8.musicOn ? '켜짐' : '꺼짐'}</button>
      <button data-act="toggleSfx">효과음: ${Audio8.sfxOn ? '켜짐' : '꺼짐'}</button>
      ${C && G.state !== 'title' ? `<button data-act="toggleSkipNormal">일반 등급 아이템 줍기: ${C.skipNormal ? '안 함' : '함'}</button>` : ''}
      <button data-act="fullscreen">전체 화면</button>
      ${hasSave() ? '<button data-act="exportSave">세이브 백업 코드 복사</button>' : ''}
      ${G.state === 'title' ? '<button data-act="importSave">세이브 코드로 복원</button>' : ''}
      ${G.state === 'title' && hasSave() ? '<button class="danger" data-act="wipe">저장 데이터 삭제</button>' : ''}
      ${G.state === 'pause' ? '<button data-act="view" data-arg="help">조작법 · 상성표</button>' : ''}
    </div>
    <p class="dim" style="font-size:12px">버전 ${APP_VERSION} · 앱을 삭제하면 저장 데이터도 지워집니다. 재설치 전에 백업 코드를 복사해 두세요.</p>`;
  uiFrame('설정', body);
}

function matchupTable() {
  const types = Object.keys(DMG_TYPES);
  const head = types.map(t => `<td style="color:${DMG_TYPES[t].color}">${DMG_TYPES[t].name}</td>`).join('');
  const rows = Object.entries(FAMILIES).map(([k, f]) => {
    const monsters = Object.keys(ENEMY_FAMILY).filter(m => ENEMY_FAMILY[m] === k && !ENEMIES[m].boss && m !== 'spiderling').map(m => ENEMIES[m].name).join(', ');
    return `<tr><td><b>${f.name}</b><div class="dim" style="font-size:10px">${monsters}</div></td>${types.map(t => {
      const m = matchup(t, k);
      return `<td style="color:${m > 1 ? '#7f7' : m < 1 ? '#f77' : '#888'}">${m === 1 ? '—' : '×' + m}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<table class="stats" style="font-size:12px;text-align:center"><tr><td></td>${head}</tr>${rows}</table>`;
}

function renderHelp() {
  show(`<div class="panel wide"><h3>조작법</h3>
    <p>◀ ▶ 이동 · <b>점프</b> (길게 누르면 높이) · <b>공격</b> (누르고 있으면 연사) · <b>스킬1/2</b> · ♥/✦ 물약 · ☰ 메뉴</p>
    <p class="dim">키보드: ←→/AD 이동, Space/W 점프, J/Z 공격, K/X 스킬1, L/C 스킬2, Q/E 물약, Esc 메뉴</p>
    <h3 style="margin-top:8px">공격 방식</h3>
    <p>• <b>공격 버튼</b>: 적이 멀리 있으면 무기를 <b>던지고</b>, 바로 앞(한 칸 이내)에 붙어 있으면 무기로 <b>직접 벱니다</b>(근접 125% 피해, 투척 개수 제한 없음).</p>
    <p>• 성기사: 공격 버튼 = 창 투척/베기(신성), 스킬1 심판의 일격 = 강력한 근접 강타(신성·기절)</p>
    <p>• 소서리스: 마법구 투척(마법, 약한 유도) · 서리 구체(냉기) · 순간이동</p>
    <p>• 네크로맨서: 단검 투척/베기(독) · 해골 소환(해골이 근접 물리 공격) · 뼈 창(마법, 전부 관통)</p>
    <h3 style="margin-top:8px">상성표 (피해 배율)</h3>
    <p class="dim" style="font-size:12px">직업의 주력 무기를 들면 공격 속성이 바뀝니다. 성기사 창·도끼 → 신성, 네크로맨서 단검 → 독, 횃불 → 화염, 마법구 → 마법, 나머지는 물리. 반지·목걸이의 화염/냉기/번개 추가 피해도 상성을 따릅니다.</p>
    ${matchupTable()}
    <h3 style="margin-top:8px">게임 방법</h3>
    <p>• 무기를 던져 싸우는 횡스크롤 액션. 무기 종류(창·단검·도끼·횃불·마법구)마다 궤적이 다릅니다.</p>
    <p>• <b>갑옷 내구도</b>가 먼저 피해를 받고, 다 떨어지면 갑옷이 부서져 속옷 차림이 됩니다. 마을 대장장이에게 수리하세요.</p>
    <p>• 몬스터는 <span class="c-magic">마법</span> · <span class="c-rare">희귀</span> · <span class="c-unique">고유</span> 아이템을 떨어뜨립니다. 금빛 이름의 정예 몬스터를 노리세요.</p>
    <p>• 구덩이에 빠지면 생명력 25% 손실. 보물상자엔 가끔 저주의 마법사가…</p>
    <p>• 레벨업마다 능력치 5점, 스킬 1점. 성소를 만지면 축복을 받습니다.</p>
    <p>• 노말을 깨면 나이트메어, 그다음 헬이 열립니다. 진짜 엔딩은 그 너머에.</p>
    ${backBtn()}</div>`);
}

function renderPause() {
  G.state = 'pause';
  if (G.view !== 'main') return renderSub();
  uiFrame('일시 정지', `<p class="dim">${L.name} · ${DIFFS[C.diff].name} · 몬스터 Lv ${L.mlvl}</p>
    <div class="menu-list" style="max-width:340px">
      <button class="primary" data-act="resume">▶ 계속하기</button>
      <button data-act="view" data-arg="help">조작법 · 상성표</button>
      <button class="danger" data-act="portal">🌀 마을 귀환 (지역 진행 초기화)</button>
    </div>`);
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.view = 'main'; G.sel = null; G.from = 'pause';
  setControls(false);
  for (const k in input) input[k] = false;
  renderPause();
}
function resumeGame() {
  G.state = 'play'; G.view = 'main';
  show('');
  setControls(true);
  updateHudButtons();
}

// ---------- 게임 흐름 ----------
function beginStage(idx) {
  G.state = 'play'; G.view = 'main';
  show('');
  setControls(true);
  startStage(idx);
  updateHudButtons();
}

function stageClear() {
  if (!P || P.cleared || P.dead) return;
  P.cleared = true;
  C.armorCur = P.armor;
  const idx = L.stageIdx;
  if (C.checkpoint && C.checkpoint.stage === idx) C.checkpoint = null;
  if (idx + 1 < STAGE_COUNT) C.progress[C.diff] = Math.max(C.progress[C.diff], idx + 1);
  saveGame();
  G.state = 'clear';
  setControls(false);
  const next = idx + 1 < STAGE_COUNT ? idx + 1 : -1;
  show(`<div class="panel center"><h2>지역 정복!</h2>
    <p>${L.name}</p>
    <p class="dim">다음 지역: ${next >= 0 ? stageInfo(next).name : '—'}</p>
    <div class="menu-list" style="max-width:300px;margin:0 auto">
      ${next >= 0 ? `<button class="primary" data-act="go" data-arg="${next}">계속 진격</button>` : ''}
      <button data-act="town">마을로</button>
    </div></div>`);
}

function playerDie() {
  if (P.dead) return;
  P.dead = true;
  C.deaths++;
  const lost = Math.floor(C.gold * 0.1);
  C.gold -= lost;
  C.armorCur = 0;
  burst(P.x + 6, P.y + 10, '#c00', 40);
  Audio8.play('die');
  saveGame();
  setTimeout(() => {
    G.state = 'dead';
    setControls(false);
    show(`<div class="panel center">
      <div class="died">당신은 사망했습니다</div>
      <p class="dim">골드 ${lost} G를 잃었습니다. 갑옷이 모두 부서졌습니다.</p>
      <button class="primary" data-act="town">마을에서 부활</button>
    </div>`);
  }, 1300);
}

function finalVictory() {
  if (!P || P.cleared) return;
  P.cleared = true;
  C.armorCur = P.armor;
  const d = C.diff;
  const first = !C.cleared[d];
  C.cleared[d] = true;
  if (d + 1 < DIFFS.length) C.progress[d + 1] = Math.max(C.progress[d + 1], 0);
  C.checkpoint = null;
  saveGame();
  G.state = 'victory';
  setControls(false);
  let msg;
  if (d === 0) msg = `<p>공포의 군주가 쓰러졌다… 그러나 그것은 마왕이 꾸민 <b class="c-red">함정</b>이었다!</p>
    <p>진정한 결말을 보려면 <b style="color:${DIFFS[1].color}">나이트메어</b> 난이도에서 다시 싸워라.</p>`;
  else if (d === 1) msg = `<p>마계의 문이 흔들린다. 그러나 어둠의 근원은 아직 살아 있다.</p>
    <p><b style="color:${DIFFS[2].color}">헬</b> 난이도가 열렸다.</p>`;
  else msg = `<p>마침내 혼돈의 성역이 무너지고, 세상에 새벽이 찾아왔다.</p><p class="c-unique">— 진 엔딩 — 축하합니다, 성전의 영웅이여!</p>`;
  show(`<div class="panel center"><h1 style="font-size:32px">${first ? '승리!' : '재정복!'}</h1>${msg}
    <p class="dim">레벨 ${C.level} · 처치 ${C.kills} · 사망 ${C.deaths}</p>
    <button class="primary" data-act="town">마을로</button></div>`);
}

// ---------- 액션 ----------
const ACTIONS = {
  title: goTitle,
  continue: () => { C = loadGame(); calcStats(); updateHudButtons(); enterTown(); },
  newGame: () => {
    if (hasSave() && !confirm('기존 저장 데이터를 덮어씁니다. 계속할까요?')) return;
    goClassSelect();
  },
  pickClass: cls => { newCharacter(cls); updateHudButtons(); saveGame(); beginStage(0); },
  help: () => { G.view = 'help'; renderSub(); },
  settings: () => { G.view = 'settings'; renderSub(); },
  view: v => { G.view = v; G.sel = null; G.smithMsg = ''; G.craftMsg = ''; renderSub(); },
  back: () => {
    G.sel = null;
    G.view = 'main';
    if (G.state === 'title') return goTitle();
    if (G.state === 'pause') return renderPause();
    renderTown();
  },
  diff: d => { C.diff = +d; renderWaypoint(); },
  go: idx => { Audio8.play('click'); beginStage(+idx); },
  town: () => enterTown(),
  saveQuit: () => { saveGame(); goTitle(); },
  buyPot: kind => {
    const pp = potionPrice();
    if (C.gold < pp) return;
    if (kind === 'hp' && C.hpPot < 10) { C.hpPot++; C.gold -= pp; }
    if (kind === 'mp' && C.mpPot < 10) { C.mpPot++; C.gold -= pp; }
    Audio8.play('gold'); saveGame(); renderSub();
  },
  buyItem: i => {
    const it = G.shopStock[+i];
    if (!it || C.gold < it.value * 4) return;
    if (C.inv.length >= INV_SIZE) { toast('인벤토리가 가득 찼습니다'); return; }
    C.gold -= it.value * 4; C.inv.push(it); G.shopStock.splice(+i, 1);
    Audio8.play('gold'); saveGame(); renderSub();
  },
  repair: () => {
    const cost = repairCost();
    if (C.gold < cost) return;
    C.gold -= cost; C.armorCur = S.armorMax;
    Audio8.play('armor'); saveGame(); renderSub();
  },
  gamble: slot => {
    const price = gamblePrice();
    if (C.gold < price) return;
    if (C.inv.length >= INV_SIZE) { toast('인벤토리가 가득 찼습니다'); return; }
    C.gold -= price;
    const it = genItem(C.level + irand(0, 4) + DIFFS[C.diff].lvl * 0.3, { slot, boost: 0.3 });
    C.inv.push(it);
    G.gambleMsg = itemLines(it);
    Audio8.play(it.rarity === 'unique' ? 'unique' : it.rarity === 'rare' ? 'rare' : 'pickup');
    saveGame(); renderGamble();
  },
  sel: arg => {
    const i = arg.indexOf(':');
    const src = arg.slice(0, i), key = arg.slice(i + 1);
    G.sel = { src, key: src === 'eq' ? key : +key };
    G.smithMsg = ''; G.craftMsg = '';
    renderSub();
  },
  equip: () => {
    const it = selItem();
    if (!it || G.sel.src !== 'inv' || it.req > C.level) return;
    const oldMax = S.armorMax;
    const prev = C.equip[it.slot];
    C.equip[it.slot] = it;
    C.inv.splice(G.sel.key, 1);
    if (prev) C.inv.push(prev);
    afterEquipChange(oldMax);
    G.sel = { src: 'eq', key: it.slot };
    Audio8.play('pickup');
    renderSub();
  },
  unequip: () => {
    const s = G.sel && G.sel.key;
    if (!s || s === 'weapon') return;
    if (C.inv.length >= INV_SIZE) { toast('가방이 가득 찼습니다'); return; }
    const oldMax = S.armorMax;
    C.inv.push(C.equip[s]); C.equip[s] = null;
    afterEquipChange(oldMax);
    G.sel = null; renderSub();
  },
  sell: () => {
    const it = selItem();
    if (!it || G.sel.src !== 'inv') return;
    C.gold += it.value; C.inv.splice(G.sel.key, 1); G.sel = null;
    Audio8.play('gold'); saveGame(); renderSub();
  },
  sellAllNormal: () => {
    let g = 0;
    C.inv = C.inv.filter(it => { if (it.rarity === 'normal' && !it.plus) { g += it.value; return false; } return true; });
    C.gold += g; G.sel = null;
    if (g) Audio8.play('gold');
    toast(`${g} G 획득`); saveGame(); renderSub();
  },
  drop: () => {
    const it = selItem();
    if (!it || G.sel.src !== 'inv') return;
    if (it.rarity !== 'normal' && !confirm(`${it.name}을(를) 버릴까요?`)) return;
    C.inv.splice(G.sel.key, 1); G.sel = null; renderSub();
  },
  sortInv: () => { C.inv.sort(itemSort); G.sel = null; renderSub(); },
  sortStash: () => { C.stash.sort(itemSort); G.sel = null; saveGame(); renderSub(); },
  toStash: () => {
    if (!G.sel || G.sel.src !== 'inv' || C.stash.length >= STASH_SIZE) return;
    C.stash.push(C.inv.splice(G.sel.key, 1)[0]); G.sel = null;
    Audio8.play('drop'); saveGame(); renderSub();
  },
  toInv: () => {
    if (!G.sel || G.sel.src !== 'stash' || C.inv.length >= INV_SIZE) return;
    C.inv.push(C.stash.splice(G.sel.key, 1)[0]); G.sel = null;
    Audio8.play('pickup'); saveGame(); renderSub();
  },
  stashAll: () => {
    while (C.inv.length && C.stash.length < STASH_SIZE) C.stash.push(C.inv.shift());
    G.sel = null; Audio8.play('drop'); saveGame(); renderSub();
  },
  enhance: () => {
    const it = selItem();
    if (!canEnhance(it)) return;
    const e = enhanceCost(it);
    if (!hasMats(e.cost) || C.gold < e.gold) return;
    payMats(e.cost); C.gold -= e.gold;
    const oldMax = S.armorMax;
    if (Math.random() * 100 < e.rate) {
      it.plus = (it.plus || 0) + 1;
      it.value = Math.floor(it.value * 1.15);
      G.smithMsg = `<b class="c-green">강화 성공! +${it.plus}</b>`;
      Audio8.play('level');
    } else {
      G.smithMsg = `<b class="c-red">강화 실패…</b> <span class="dim">재료와 골드만 소모되었습니다.</span>`;
      Audio8.play('armor');
    }
    if (G.sel.src === 'eq') afterEquipChange(oldMax); else saveGame();
    renderSub();
  },
  salvage: () => {
    const it = selItem();
    if (!it || G.sel.src !== 'inv') return;
    if ((it.rarity === 'unique' || it.plus >= 5) && !confirm(`${displayName(it)}을(를) 분해할까요?`)) return;
    const y = craftSalvage(it);
    C.inv.splice(G.sel.key, 1); G.sel = null;
    G.craftMsg = `♻ 분해 완료: ${matsText(y) || '재료 없음'}`;
    Audio8.play('hit'); saveGame(); renderSub();
  },
  recipe: id => {
    const it = selItem();
    const r = RECIPES.find(x => x.id === id);
    if (!it || !r || !r.can(it)) return;
    const cost = r.cost(it), gold = r.gold(it);
    if (!hasMats(cost) || C.gold < gold) return;
    payMats(cost); C.gold -= gold;
    r.run(it);
    G.craftMsg = `${r.icon} ${r.name} 완료 → <span class="c-${it.rarity}">${displayName(it)}</span>`;
    Audio8.play(it.rarity === 'rare' ? 'rare' : 'pickup');
    saveGame(); renderSub();
  },
  craftUnique: slot => {
    const cost = uniqueCraftCost(), gold = uniqueCraftGold();
    if (!hasMats(cost) || C.gold < gold || C.inv.length >= INV_SIZE) return;
    payMats(cost); C.gold -= gold;
    const it = genItem(C.level + DIFFS[C.diff].lvl * 0.3, { slot, rarity: 'unique' });
    C.inv.push(it);
    G.sel = { src: 'inv', key: C.inv.length - 1 };
    G.craftMsg = `🔮 제작 완료 → <span class="c-${it.rarity}">${it.name}</span>`;
    Audio8.play(it.rarity === 'unique' ? 'unique' : 'rare');
    saveGame(); renderSub();
  },
  stat: k => {
    if (C.statPts <= 0) return;
    C.stats[k]++; C.statPts--;
    const oldHP = S.maxHP, oldMP = S.maxMP;
    calcStats();
    if (P) { P.hp += S.maxHP - oldHP; P.mp += S.maxMP - oldMP; }
    renderChar();
  },
  skillUp: k => {
    if (C.skillPts <= 0) return;
    C.skills[k] = (C.skills[k] || 0) + 1; C.skillPts--;
    Audio8.play('click'); updateHudButtons(); renderSkills();
  },
  toggleMusic: () => { Audio8.setMusic(!Audio8.musicOn); saveSettings(); renderSettings(); },
  toggleSkipNormal: () => { C.skipNormal = !C.skipNormal; saveGame(); renderSettings(); },
  exportSave: () => {
    saveGame();
    let code = '';
    try { code = btoa(unescape(encodeURIComponent(localStorage.getItem(SAVE_KEY) || ''))); } catch (e) { /* 무시 */ }
    if (!code) return;
    const done = () => toast('백업 코드를 복사했습니다. 메모장 등에 붙여넣어 보관하세요.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => prompt('아래 코드를 길게 눌러 복사하세요', code));
    else prompt('아래 코드를 길게 눌러 복사하세요', code);
  },
  importSave: () => {
    const code = prompt('세이브 백업 코드를 붙여넣으세요');
    if (!code) return;
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const d = JSON.parse(json);
      if (!d || !d.cls || !CLASSES[d.cls]) throw new Error('bad');
      localStorage.setItem(SAVE_KEY, json);
      toast('복원했습니다');
      goTitle();
    } catch (e) { toast('올바른 백업 코드가 아닙니다'); }
  },
  toggleSfx: () => { Audio8.setSfx(!Audio8.sfxOn); saveSettings(); renderSettings(); },
  fullscreen: () => requestFullscreen(),
  wipe: () => { if (confirm('저장 데이터를 삭제할까요? 되돌릴 수 없습니다.')) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } goTitle(); } },
  resume: resumeGame,
  portal: () => { if (confirm('마을로 귀환할까요? 이 지역은 처음부터(체크포인트) 다시 진행합니다.')) { C.armorCur = P.armor; enterTown(); } },
};

function afterEquipChange(oldMax) {
  const ratio = oldMax ? (P ? P.armor : C.armorCur ?? 0) / oldMax : 1;
  calcStats();
  const cur = Math.round(S.armorMax * clamp(ratio, 0, 1));
  if (P) { P.armor = cur; P.hp = Math.min(P.hp, S.maxHP); P.mp = Math.min(P.mp, S.maxMP); }
  C.armorCur = cur;
  saveGame();
}

uiEl.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'view' && b.dataset.arg === 'inv' && G.view === 'shop') G.prevView = 'shop';
  Audio8.init();
  const fn = ACTIONS[act];
  if (fn) fn(b.dataset.arg);
});
