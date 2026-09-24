'use strict';
// ===== 픽셀아트 스프라이트 (문자열 도트 → 오프스크린 캔버스 캐시) =====
// 각 문자 = 1픽셀, '.' = 투명. 모두 오른쪽을 바라보는 방향으로 그린다.
const SPRITES = {
  // 성기사: 붉은 깃털 투구, 십자 문양 판금, 붉은 망토
  paladin: {
    pal: { k: '#15151c', s: '#c3cbd9', S: '#8a93a6', w: '#f4f6ff', v: '#101018', g: '#d9a93e', r: '#c02a2a', R: '#7a1a1e', b: '#6a4424' },
    rows: [
      '......rrr.......',
      '.....rrrr.......',
      '...kkkkkkkkk....',
      '...kswsssssk....',
      '...kssssssSk....',
      '...ksssvvvvk....',
      '...kssssssSk....',
      '....kSSSSSk.....',
      '.RRkgssssssgk...',
      '.RRkswsgsssk....',
      '.RRksgggggsk....',
      '.RRksssgsssk....',
      '.RRksssgssSk....',
      '.RRkbbbgbbbk....',
      '..RkSsssssSk....',
      '..RkSsssssSk....',
    ],
  },
  paladin_bare: {
    pal: { k: '#15151c', h: '#5a3a1a', f: '#f0c090', F: '#d8a070', e: '#000', w: '#ffffff', x: '#e33333' },
    rows: [
      '................',
      '................',
      '....kkkkkkk.....',
      '...khhhhhhhk....',
      '...khhfffffk....',
      '...khffffefk....',
      '...kfffffffk....',
      '....kffFffk.....',
      '...kfffffffk....',
      '...kfFfffFfk....',
      '...kfffffffk....',
      '...kffFfFffk....',
      '...kfffffffk....',
      '...kwwwwwwwk....',
      '...kwxwwwxwk....',
      '...kwwwxwwwk....',
    ],
  },
  // 소서리스: 긴 흑발, 금 서클릿, 보라색 로브
  sorc: {
    pal: { k: '#15101c', h: '#2a1420', g: '#e0c060', f: '#f0c090', F: '#d8a070', e: '#224', p: '#6b43a8', P: '#4a2a7a', l: '#9a74d8' },
    rows: [
      '................',
      '....kkkkkkk.....',
      '...khhhhhhhk....',
      '...kgggggggk....',
      '..khhffffffk....',
      '..khhfffefk.....',
      '..khhffffFk.....',
      '..khhhkffk......',
      '..khhkpppppk....',
      '..khkplpppPk....',
      '...kpgggggpk....',
      '...kpppppPpk....',
      '..kppplpppPpk...',
      '..kpppppppPpk...',
      '.kpppplppppPpk..',
      '.kkkkkkkkkkkkk..',
    ],
  },
  sorc_bare: {
    pal: { k: '#15101c', h: '#2a1420', f: '#f0c090', F: '#d8a070', e: '#224', t: '#e8e0d0', T: '#b8b0a0', b: '#8a6a3a' },
    rows: [
      '................',
      '....kkkkkkk.....',
      '...khhhhhhhk....',
      '...khhhhhhhk....',
      '..khhffffffk....',
      '..khhfffefk.....',
      '..khhffffFk.....',
      '..khhhkffk......',
      '..khhktttttk....',
      '..khktttttTk....',
      '...ktbbbbbtk....',
      '...kttttttTk....',
      '...kttttttTk....',
      '...kttttttTk....',
      '...kkkkkkkkk....',
      '................',
    ],
  },
  // 네크로맨서: 두건, 창백한 얼굴과 녹색 눈, 뼈 견갑, 녹색 장식 망토
  necro: {
    pal: { k: '#0e0e14', c: '#2a2a36', C: '#1c1c26', p: '#d8d0c0', e: '#7fff7f', b: '#e0d8c0', g: '#6fbf5f', m: '#4a3a2a' },
    rows: [
      '................',
      '.....kkkkk......',
      '....kcccccck....',
      '...kccccccck....',
      '...kccpppppk....',
      '...kccppepek....',
      '...kcccpppck....',
      '...kccccccck....',
      '..kbbbcccccck...',
      '..kbbbcgccCck...',
      '...kccgcccCk....',
      '...kccgcccCk....',
      '...kmmbmmmmk....',
      '..kccgccccCck...',
      '..kccgcccccCck..',
      '..kkkkkkkkkkkk..',
    ],
  },
  necro_bare: {
    pal: { k: '#0e0e14', h: '#111118', p: '#d8d0c0', P: '#b0a898', e: '#7fff7f', C: '#2a2a36', b: '#e0d8c0' },
    rows: [
      '................',
      '................',
      '....kkkkkkk.....',
      '...khhhhhhhk....',
      '...khhpppppk....',
      '...khppppepk....',
      '...kpppppppk....',
      '....kpppppk.....',
      '...kpppppppk....',
      '...kpPpppPpk....',
      '...kpppPpppk....',
      '...kpPpppPpk....',
      '...kpppppppk....',
      '...kCCCCCCCk....',
      '...kCbCCCbCk....',
      '....kCCCCCk.....',
    ],
  },
  // 좀비
  zombie: {
    pal: { k: '#12140e', g: '#7a9a5a', G: '#5a7a3a', r: '#ff3322', m: '#2a1a14', t: '#5a4a6a', T: '#3e3048', n: '#4a3a3a', N: '#2e2424' },
    rows: [
      '....kkkkkk......',
      '...kgGggggk.....',
      '...kgggggGk.....',
      '...kggggrgk.....',
      '...kGggggGk.....',
      '...kgmmmmgk.....',
      '....kgggGk......',
      '...kttttttk.....',
      '..kttgtttTtkkkk.',
      '..kttttTttggggk.',
      '..kTttgtttkkkk..',
      '..ktttttTtk.....',
      '..kTtttgttk.....',
      '...knnnnnnk.....',
      '...knnNnnnk.....',
      '...knnkknNk.....',
      '...knnk.knnk....',
      '...kNnk.kNnk....',
      '...knnk..knk....',
      '...knnk..knnk...',
      '..kkkkk..kkkk...',
      '..mmmm....mmm...',
    ],
  },
  // 망령
  ghost: {
    pal: { k: '#a8c0d0', w: '#e8f4ff', W: '#c8dcec', e: '#113', m: '#335' },
    rows: [
      '....kkkkkk....',
      '...kwwwwwwk...',
      '..kwwwwwwwwk..',
      '..kwweewweek..',
      '..kwweewweek..',
      '..kwwwwwwwwk..',
      '.kwwwwmmwwwwk.',
      '.kwwwwmmwwwWk.',
      'kWwwwwwwwwwWWk',
      'kwwwwwwwwwwwWk',
      'kWwwwwwwwwwWWk',
      '.kwwwwwwwwwWk.',
      '.kwWwwwwwWwWk.',
      '.kwwwwWwwwwk..',
      '..kwWk.kwWk...',
      '..kwk..kwwk...',
      '...k....kk....',
      '..............',
    ],
  },
};

const _sprCache = {};
function spriteCanvas(name) {
  if (_sprCache[name]) return _sprCache[name];
  const sp = SPRITES[name];
  const w = Math.max(...sp.rows.map(r => r.length)), h = sp.rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  sp.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = sp.pal[row[x]];
      if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    }
  });
  _sprCache[name] = cv;
  return cv;
}
function blit(name, x, y) { drawCtx.drawImage(spriteCanvas(name), Math.round(x), Math.round(y)); }

// ---------- 주인공 ----------
const HERO_LEGS = {
  paladin: [{ leg: '#c3cbd9', dark: '#8a93a6', boot: '#4a4a58' }, { leg: '#f0c090', dark: '#d8a070', boot: '#d8a070' }],
  sorc:    [{ leg: '#3a2a4a', dark: '#2a1e38', boot: '#6a4424' }, { leg: '#f0c090', dark: '#d8a070', boot: '#8a6a3a' }],
  necro:   [{ leg: '#24242e', dark: '#15151c', boot: '#15151c' }, { leg: '#d8d0c0', dark: '#b0a898', boot: '#b8b0a0' }],
};
const HERO_ARM = {
  paladin: ['#c3cbd9', '#f0c090'], sorc: ['#6b43a8', '#f0c090'], necro: ['#2a2a36', '#d8d0c0'],
};

// 좌표계: 16x24, 발끝 = y 24, 오른쪽을 바라봄
function drawHero(cls, bare, walkPhase, attacking, wtype) {
  const lc = HERO_LEGS[cls][bare ? 1 : 0];
  const lift = walkPhase;              // -1, 0, 1
  const legL = (x, dx, up) => {
    R(x + dx, 16, 3, 6 - up, lc.leg); R(x + dx, 16, 1, 6 - up, lc.dark);
    R(x + dx, 22 - up, 3 + (dx >= 0 ? 1 : 0), 2, lc.boot);
  };
  legL(4, lift < 0 ? -1 : 0, lift > 0 ? 1 : 0);
  legL(8, lift > 0 ? 1 : 0, lift < 0 ? 1 : 0);
  // 뒷팔(몸 뒤)
  const arm = HERO_ARM[cls][bare ? 1 : 0];
  R(3, 9, 2, 5, arm);
  blit(cls + (bare ? '_bare' : ''), 0, 0);
  drawHeldWeapon(wtype, attacking, arm, bare);
}

function drawHeldWeapon(wtype, attacking, arm, bare) {
  const hand = bare ? arm : '#3a2a1a';
  if (!attacking) {
    R(10, 8, 3, 5, arm); R(10, 13, 3, 2, hand);
    switch (wtype) {
      case 'lance': R(12, 0, 1, 22, '#8a5a2a'); R(11, -3, 3, 3, '#e8e8f0'); R(12, -5, 1, 2, '#ffffff'); break;
      case 'dagger': R(11, 12, 3, 1, '#aa8a3a'); R(12, 13, 1, 6, '#e8e8f0'); break;
      case 'axe': R(12, 5, 1, 13, '#7a4a2a'); R(13, 5, 3, 5, '#c8c8d8'); R(15, 4, 1, 7, '#e8e8f0'); break;
      case 'torch': {
        R(12, 8, 1, 7, '#7a4a2a');
        const fl = Math.sin(gtime * 25) > 0 ? 1 : 0;
        R(11, 4 + fl, 3, 4, '#ff9020'); R(12, 3 + fl, 1, 2, '#ffe060');
        break;
      }
      case 'orb':
        R(12, 2, 1, 21, '#6a4a2a');
        drawCtx.globalAlpha = 0.35 + Math.sin(gtime * 5) * 0.15; R(10, -2, 5, 5, '#d0a8ff'); drawCtx.globalAlpha = 1;
        R(11, -1, 3, 3, '#b080ff'); R(11, -1, 1, 1, '#fff');
        break;
    }
  } else {
    // 공격 자세: 팔을 앞으로 뻗는다
    R(10, 9, 5, 3, arm); R(14, 9, 2, 3, hand);
    switch (wtype) {
      case 'lance': R(13, 10, 12, 1, '#8a5a2a'); R(24, 9, 3, 3, '#e8e8f0'); break;
      case 'dagger': R(16, 10, 5, 1, '#e8e8f0'); R(15, 9, 1, 3, '#aa8a3a'); break;
      case 'axe': R(15, 6, 1, 7, '#7a4a2a'); R(16, 5, 4, 4, '#c8c8d8'); break;
      case 'torch': R(15, 8, 1, 5, '#7a4a2a'); R(15, 5, 3, 3, '#ff9020'); break;
      case 'orb': R(15, 9, 1, 2, '#6a4a2a'); R(16, 8, 3, 3, '#b080ff'); drawCtx.globalAlpha = 0.4; R(15, 7, 5, 5, '#d0a8ff'); drawCtx.globalAlpha = 1; break;
    }
  }
}

// 직업 선택 화면용 초상화 (4배 확대)
function heroPortrait(cls, bare = false, wtype = CLASSES[cls].weapon) {
  const sc = 4, cv = document.createElement('canvas');
  cv.width = 32 * sc; cv.height = 32 * sc;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.setTransform(sc, 0, 0, sc, 8 * sc, 6 * sc);
  const prev = drawCtx; drawCtx = c;
  try { drawHero(cls, bare, 0, false, wtype); } finally { drawCtx = prev; }
  return cv.toDataURL();
}
