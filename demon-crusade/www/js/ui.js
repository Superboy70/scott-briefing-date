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
    return d;
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
  </div>`);
}

function goClassSelect() {
  G.state = 'class';
  const cards = Object.entries(CLASSES).map(([k, c]) => `
    <div class="class-card">
      <h3>${c.name} <span class="dim">${c.eng}</span></h3>
      <p style="font-size:13px">${c.desc}</p>
      <p class="dim">힘 ${c.base.str} · 민첩 ${c.base.dex} · 활력 ${c.base.vit} · 에너지 ${c.base.ene}</p>
      <p class="dim">무기: ${WEAPON_TYPES[c.weapon].name} · 스킬: ${c.skills.map(s => SKILLS[s].name).join(', ')}</p>
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
    const it = genItem(C.level + DIFFS[C.diff].lvl * 0.5, { rarity: Math.random() < 0.25 ? 'rare' : 'magic' });
    G.shopStock.push(it);
  }
}

const potionPrice = () => 20 + C.level * 3;
const repairCost = () => Math.ceil((S.armorMax - (C.armorCur ?? 0)) * 0.5 * (1 + C.diff));
const gamblePrice = () => (120 + C.level * 30) * (1 + C.diff);

function townHeader() {
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px">
    <h2 style="margin:0">로그 야영지</h2>
    <div class="dim">${CLASSES[C.cls].name} Lv${C.level} · <span style="color:#ffd24a">${C.gold} G</span> · 난이도 <span style="color:${DIFFS[C.diff].color}">${DIFFS[C.diff].name}</span></div>
  </div>`;
}

function renderTown() {
  if (G.view !== 'main') return renderSub();
  const alert = (C.statPts || C.skillPts) ? ` <span class="c-rare">●</span>` : '';
  show(`<div class="panel wide">${townHeader()}
    <div class="row">
      <div class="menu-list grow">
        <button class="primary" data-act="view" data-arg="wp">⛩ 웨이포인트 (출발)</button>
        <button data-act="view" data-arg="shop">⚗ 상인 엘라 — 물약 · 판매 · 구매</button>
        <button data-act="view" data-arg="smith">⚒ 대장장이 — 갑옷 수리 (${repairCost()} G)</button>
        <button data-act="view" data-arg="gamble">🎲 도박꾼 기드 — 미확인 아이템</button>
      </div>
      <div class="menu-list grow">
        <button data-act="view" data-arg="inv">🎒 인벤토리 · 장비</button>
        <button data-act="view" data-arg="char">📜 캐릭터 능력치${C.statPts ? alert : ''}</button>
        <button data-act="view" data-arg="skill">✦ 스킬${C.skillPts ? alert : ''}</button>
        <button data-act="saveQuit">💾 저장 후 타이틀로</button>
      </div>
    </div>
    <p class="dim">갑옷 ${Math.ceil(C.armorCur ?? 0)}/${S.armorMax} · 생명력 물약 ${C.hpPot} · 마나 물약 ${C.mpPot} · 처치 ${C.kills}</p>
  </div>`);
}

function backBtn() { return `<button data-act="back">← 뒤로</button>`; }

function renderSub() {
  switch (G.view) {
    case 'wp': return renderWaypoint();
    case 'shop': return renderShop();
    case 'smith': return renderSmith();
    case 'gamble': return renderGamble();
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
      html += open
        ? `<button data-act="go" data-arg="${idx}">${s === 2 ? '☠ ' : ''}${ACTS[a].stages[s]}${cp}<br><span class="dim">몬스터 Lv ${ml}</span></button>`
        : `<button disabled>🔒 ???</button>`;
    }
  }
  show(`<div class="panel wide">${townHeader()}<h3>웨이포인트</h3>
    <div class="tabs">${tabs}</div>
    <div class="wp">${html}</div>
    <div style="margin-top:8px">${backBtn()}</div></div>`);
}

function renderShop() {
  const pp = potionPrice();
  const stock = G.shopStock.map((it, i) => `
    <div class="skill"><div class="row" style="align-items:center">
      <div class="grow">${itemLines(it)}</div>
      <button data-act="buyItem" data-arg="${i}" ${C.gold < it.value * 4 ? 'disabled' : ''}>${it.value * 4} G</button>
    </div></div>`).join('') || '<p class="dim">오늘은 물건이 다 팔렸습니다.</p>';
  show(`<div class="panel wide">${townHeader()}<h3>상인 엘라</h3>
    <div class="row">
      <button data-act="buyPot" data-arg="hp" ${C.gold < pp || C.hpPot >= 10 ? 'disabled' : ''}>♥ 생명력 물약 ${pp} G (${C.hpPot}/10)</button>
      <button data-act="buyPot" data-arg="mp" ${C.gold < pp || C.mpPot >= 10 ? 'disabled' : ''}>✦ 마나 물약 ${pp} G (${C.mpPot}/10)</button>
      <button data-act="view" data-arg="inv">아이템 판매 (인벤토리)</button>
    </div>
    <h3 style="margin-top:8px">진열 상품</h3>${stock}
    ${backBtn()}</div>`);
}

function renderSmith() {
  const cost = repairCost();
  const need = (C.armorCur ?? 0) < S.armorMax;
  show(`<div class="panel center">${townHeader()}<h3>대장장이 찰스</h3>
    <p>"갑옷이 박살 났구먼. 속옷 차림으로 마계를 다닐 셈인가?"</p>
    <p>갑옷 내구도: <b>${Math.ceil(C.armorCur ?? 0)} / ${S.armorMax}</b></p>
    <button class="primary" data-act="repair" ${!need || C.gold < cost ? 'disabled' : ''}>수리하기 (${cost} G)</button>
    ${backBtn()}</div>`);
}

function renderGamble() {
  const price = gamblePrice();
  const btns = SLOTS.map(s => `<button data-act="gamble" data-arg="${s}" ${C.gold < price ? 'disabled' : ''}>${SLOT_ICONS[s]} ${SLOT_NAMES[s]}</button>`).join('');
  show(`<div class="panel center">${townHeader()}<h3>도박꾼 기드</h3>
    <p>"뭐가 나올지는 나도 몰라. 운을 시험해 보겠나?" — 한 번에 <b style="color:#ffd24a">${price} G</b></p>
    <div class="row" style="justify-content:center">${btns}</div>
    <div class="detail" style="margin-top:8px;text-align:left">${G.gambleMsg || '<span class="dim">결과가 여기에 표시됩니다.</span>'}</div>
    ${backBtn()}</div>`);
}

function slotCell(slot) {
  const it = C.equip[slot];
  const sel = G.sel && G.sel.src === 'eq' && G.sel.slot === slot ? ' sel' : '';
  return `<div class="cell ${it ? 'r-' + it.rarity : ''}${sel}" data-act="selEq" data-arg="${slot}">${it ? itemIcon(it) : '<span class="dim">' + SLOT_ICONS[slot] + '</span>'}<span class="slotname">${SLOT_NAMES[slot]}</span></div>`;
}

function renderInventory() {
  const cells = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const it = C.inv[i];
    const sel = G.sel && G.sel.src === 'inv' && G.sel.idx === i ? ' sel' : '';
    const cant = it && it.req > C.level ? ' cant' : '';
    cells.push(it
      ? `<div class="cell r-${it.rarity}${sel}${cant}" data-act="selInv" data-arg="${i}">${itemIcon(it)}</div>`
      : `<div class="cell"></div>`);
  }
  let detail = '<span class="dim">아이템을 눌러 정보를 확인하세요.</span>';
  const inTown = G.state === 'town';
  if (G.sel) {
    const it = G.sel.src === 'inv' ? C.inv[G.sel.idx] : C.equip[G.sel.slot];
    if (it) {
      detail = itemLines(it);
      if (G.sel.src === 'inv') {
        const cur = C.equip[it.slot];
        if (cur) detail += `<div class="cmp">현재 장착: <span class="c-${cur.rarity}">${cur.name}</span>${cur.min ? ` (피해 ${cur.min}-${cur.max})` : cur.def ? ` (갑옷 ${cur.def})` : ''}</div>`;
        detail += `<div style="margin-top:6px">
          <button class="primary mini" data-act="equip" ${it.req > C.level ? 'disabled' : ''}>장착</button>
          ${inTown ? `<button class="mini" data-act="sell">판매 ${it.value} G</button>` : ''}
          <button class="danger mini" data-act="drop">버리기</button></div>`;
        if (it.req > C.level) detail += `<div class="c-red" style="font-size:12px">레벨이 부족합니다</div>`;
      } else {
        detail += `<div style="margin-top:6px"><button class="mini" data-act="unequip" ${it.slot === 'weapon' ? 'disabled' : ''}>해제</button></div>`;
      }
    }
  }
  show(`<div class="panel wide">
    <div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">장비 · 인벤토리 (${C.inv.length}/${INV_SIZE})</h3>
    <span class="dim"><span style="color:#ffd24a">${C.gold} G</span></span></div>
    <div class="row" style="margin-top:6px">
      <div class="grow" style="min-width:260px">
        <div class="slots">${SLOTS.map(slotCell).join('')}</div>
        <div class="grid">${cells.join('')}</div>
      </div>
      <div class="detail grow" style="min-width:220px">${detail}</div>
    </div>
    <div style="margin-top:6px">${backBtn()}${inTown ? '<button class="mini" data-act="sellAllNormal">일반 등급 모두 판매</button>' : ''}</div></div>`);
}

function renderChar() {
  calcStats();
  const row = (k, name, eff) => `<tr><td>${name}</td><td><b>${S[k]}</b> <span class="dim">(${C.stats[k]})</span> ${C.statPts ? `<button class="mini" data-act="stat" data-arg="${k}">+</button>` : ''}<div class="dim" style="font-size:11px">${eff}</div></td></tr>`;
  const wt = WEAPON_TYPES[S.wtype];
  show(`<div class="panel wide"><div class="row">
    <div class="grow" style="min-width:250px">
      <h3>${CLASSES[C.cls].name} · 레벨 ${C.level}</h3>
      <p class="dim">경험치 ${C.exp} / ${expToNext(C.level)}</p>
      <p>남은 능력치 포인트: <b class="c-rare">${C.statPts}</b></p>
      <table class="stats">
        ${row('str', '힘', '물리 피해 +1%/점')}
        ${row('dex', '민첩', '치명타 확률 +0.2%/점')}
        ${row('vit', '활력', '생명력 +3/점')}
        ${row('ene', '에너지', '마나 +2/점, 주문 피해 증가')}
      </table>
    </div>
    <div class="grow" style="min-width:230px">
      <table class="stats">
        <tr><td>무기</td><td>${wt.name} ${S.wmin}-${S.wmax}</td></tr>
        <tr><td>생명력</td><td>${S.maxHP}</td></tr>
        <tr><td>마나</td><td>${S.maxMP}</td></tr>
        <tr><td>갑옷 내구도</td><td>${S.armorMax}</td></tr>
        <tr><td>받는 피해 감소</td><td>${S.dr}%</td></tr>
        <tr><td>치명타</td><td>${S.crit.toFixed(1)}%</td></tr>
        <tr><td>공격 속도</td><td>+${S.as}%</td></tr>
        <tr><td>이동 속도</td><td>+${S.ms}%</td></tr>
        <tr><td>생명력/마나 흡수</td><td>${S.ls}% / ${S.ml}%</td></tr>
        <tr><td>원소 피해</td><td><span class="c-red">${S.fire}</span> / <span class="c-blue">${S.cold}</span> / <span class="c-rare">${S.light}</span></td></tr>
        <tr><td>마법 아이템 / 골드 발견</td><td>${S.mf}% / ${S.gf}%</td></tr>
      </table>
    </div></div>
    ${backBtn()}</div>`);
}

function renderSkills() {
  calcStats();
  const list = CLASSES[C.cls].skills.map((k, i) => {
    const base = C.skills[k] || 0;
    const lv = skillLevel(k);
    const sk = SKILLS[k];
    return `<div class="skill"><div class="row" style="align-items:center">
      <div class="grow"><h3 style="margin:0">${sk.icon} ${sk.name} <span class="dim">[스킬${i + 1}] Lv ${base}${S.skill && base ? ` (+${S.skill})` : ''}</span></h3>
      <p style="font-size:13px">${sk.desc(Math.max(1, lv))}</p>
      <p class="dim">마나 ${Math.round(sk.mana(Math.max(1, lv)))} · 재사용 ${sk.cd}초</p></div>
      <button class="primary" data-act="skillUp" data-arg="${k}" ${C.skillPts && base < 20 ? '' : 'disabled'}>+</button>
    </div></div>`;
  }).join('');
  show(`<div class="panel wide"><h3>스킬 — 남은 포인트 <span class="c-rare">${C.skillPts}</span></h3>${list}${backBtn()}</div>`);
}

function renderSettings() {
  show(`<div class="panel center"><h3>설정</h3>
    <div class="menu-list" style="max-width:300px;margin:0 auto">
      <button data-act="toggleMusic">배경음: ${Audio8.musicOn ? '켜짐' : '꺼짐'}</button>
      <button data-act="toggleSfx">효과음: ${Audio8.sfxOn ? '켜짐' : '꺼짐'}</button>
      <button data-act="fullscreen">전체 화면</button>
      ${G.state === 'title' && hasSave() ? '<button class="danger" data-act="wipe">저장 데이터 삭제</button>' : ''}
    </div>${backBtn()}</div>`);
}

function renderHelp() {
  show(`<div class="panel wide"><h3>조작법</h3>
    <p>◀ ▶ 이동 · <b>점프</b> (길게 누르면 높이) · <b>공격</b> (누르고 있으면 연사) · <b>스킬1/2</b> · ♥/✦ 물약 · ☰ 메뉴</p>
    <p class="dim">키보드: ←→/AD 이동, Space/W 점프, J/Z 공격, K/X 스킬1, L/C 스킬2, Q/E 물약, Esc 메뉴</p>
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
  show(`<div class="panel center"><h2>일시 정지</h2>
    <p class="dim">${L.name} · ${DIFFS[C.diff].name}</p>
    <div class="menu-list" style="max-width:320px;margin:0 auto">
      <button class="primary" data-act="resume">계속하기</button>
      <button data-act="view" data-arg="inv">🎒 인벤토리 · 장비</button>
      <button data-act="view" data-arg="char">📜 캐릭터${C.statPts ? ' <span class="c-rare">●</span>' : ''}</button>
      <button data-act="view" data-arg="skill">✦ 스킬${C.skillPts ? ' <span class="c-rare">●</span>' : ''}</button>
      <button data-act="view" data-arg="settings">설정</button>
      <button class="danger" data-act="portal">🌀 마을 귀환 (지역 진행 초기화)</button>
    </div></div>`);
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
  view: v => { G.view = v; G.sel = null; renderSub(); },
  back: () => {
    const wasInvFromShop = G.view === 'inv' && G.prevView === 'shop';
    G.sel = null;
    G.view = wasInvFromShop ? 'shop' : 'main';
    G.prevView = null;
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
    Audio8.play('gold'); saveGame(); renderShop();
  },
  buyItem: i => {
    const it = G.shopStock[+i];
    if (!it || C.gold < it.value * 4) return;
    if (C.inv.length >= INV_SIZE) { toast('인벤토리가 가득 찼습니다'); return; }
    C.gold -= it.value * 4; C.inv.push(it); G.shopStock.splice(+i, 1);
    Audio8.play('gold'); saveGame(); renderShop();
  },
  repair: () => {
    const cost = repairCost();
    if (C.gold < cost) return;
    C.gold -= cost; C.armorCur = S.armorMax;
    Audio8.play('armor'); saveGame(); renderSmith();
  },
  gamble: slot => {
    const price = gamblePrice();
    if (C.gold < price) return;
    if (C.inv.length >= INV_SIZE) { toast('인벤토리가 가득 찼습니다'); return; }
    C.gold -= price;
    const it = genItem(C.level + irand(0, 4) + DIFFS[C.diff].lvl * 0.3, { slot, boost: 0.7 });
    C.inv.push(it);
    G.gambleMsg = itemLines(it);
    Audio8.play(it.rarity === 'unique' ? 'unique' : it.rarity === 'rare' ? 'rare' : 'pickup');
    saveGame(); renderGamble();
  },
  selInv: i => { G.sel = { src: 'inv', idx: +i }; renderInventory(); },
  selEq: s => { G.sel = C.equip[s] ? { src: 'eq', slot: s } : null; renderInventory(); },
  equip: () => {
    const it = C.inv[G.sel.idx];
    if (!it || it.req > C.level) return;
    const oldMax = S.armorMax;
    const prev = C.equip[it.slot];
    C.equip[it.slot] = it;
    C.inv.splice(G.sel.idx, 1);
    if (prev) C.inv.push(prev);
    afterEquipChange(oldMax);
    G.sel = { src: 'eq', slot: it.slot };
    Audio8.play('pickup');
    renderInventory();
  },
  unequip: () => {
    const s = G.sel.slot;
    if (s === 'weapon') return;
    if (C.inv.length >= INV_SIZE) { toast('인벤토리가 가득 찼습니다'); return; }
    const oldMax = S.armorMax;
    C.inv.push(C.equip[s]); C.equip[s] = null;
    afterEquipChange(oldMax);
    G.sel = null; renderInventory();
  },
  sell: () => {
    const it = C.inv[G.sel.idx];
    if (!it) return;
    C.gold += it.value; C.inv.splice(G.sel.idx, 1); G.sel = null;
    Audio8.play('gold'); saveGame(); renderInventory();
  },
  sellAllNormal: () => {
    let g = 0;
    C.inv = C.inv.filter(it => { if (it.rarity === 'normal') { g += it.value; return false; } return true; });
    C.gold += g; G.sel = null;
    if (g) Audio8.play('gold');
    toast(`${g} G 획득`); saveGame(); renderInventory();
  },
  drop: () => {
    const it = C.inv[G.sel.idx];
    if (!it) return;
    if (it.rarity !== 'normal' && !confirm(`${it.name}을(를) 버릴까요?`)) return;
    C.inv.splice(G.sel.idx, 1); G.sel = null; renderInventory();
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
