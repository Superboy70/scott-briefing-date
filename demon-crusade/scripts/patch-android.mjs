// `npx cap add android` 이후 실행: 가로 고정, 몰입형 전체화면, 화면 켜짐 유지, 앱 아이콘 적용
import { readFileSync, writeFileSync, copyFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'android', 'app', 'src', 'main');

// 1) AndroidManifest: 가로 모드 + 게임 카테고리
const mf = join(app, 'AndroidManifest.xml');
let xml = readFileSync(mf, 'utf8');
if (!xml.includes('screenOrientation')) {
  xml = xml.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"');
}
if (!xml.includes('appCategory')) {
  xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="true"\n        android:appCategory="game"');
}
// 게임은 완전 오프라인 → 인터넷 권한 제거 (불필요한 권한은 Play 프로텍트 경고 요인)
xml = xml.replace(/\s*<uses-permission android:name="android.permission.INTERNET" \/>/, '');
writeFileSync(mf, xml);

// 1-1) build.gradle: 고정 서명 키 + 빌드마다 증가하는 versionCode
//  → 서명이 매번 같아야 기존 앱 위에 '업데이트' 설치가 되고 저장 데이터가 유지된다
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const gradle = join(root, 'android', 'app', 'build.gradle');
let gr = readFileSync(gradle, 'utf8');
if (!gr.includes('signingConfigs')) {
  gr = gr.replace(/versionCode \d+/, 'versionCode Integer.parseInt(System.getenv("BUILD_NUMBER") ?: "1")');
  gr = gr.replace(/versionName "[^"]*"/, `versionName "${pkg.version}." + (System.getenv("BUILD_NUMBER") ?: "0")`);
  gr = gr.replace('    buildTypes {', `    signingConfigs {
        release {
            storeFile file(System.getenv("DC_KEYSTORE_PATH") ?: "../../signing/demon-crusade.jks")
            storePassword System.getenv("DC_KEYSTORE_PASS") ?: "demoncrusade"
            keyAlias System.getenv("DC_KEY_ALIAS") ?: "demoncrusade"
            keyPassword System.getenv("DC_KEY_PASS") ?: "demoncrusade"
        }
    }
    buildTypes {`);
  gr = gr.replace('            minifyEnabled false', '            minifyEnabled false\n            signingConfig signingConfigs.release');
  writeFileSync(gradle, gr);
}

// 2) MainActivity 교체
const javaDir = join(app, 'java', 'com', 'itx', 'demoncrusade');
mkdirSync(javaDir, { recursive: true });
copyFileSync(join(root, 'android-overrides', 'MainActivity.java'), join(javaDir, 'MainActivity.java'));

// 3) 아이콘
const resSrc = join(root, 'android-res');
for (const d of readdirSync(resSrc)) {
  const dst = join(app, 'res', d);
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(join(resSrc, d))) copyFileSync(join(resSrc, d, f), join(dst, f));
}
const bg = join(app, 'res', 'values', 'ic_launcher_background.xml');
if (existsSync(bg)) writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1A0A14</color>\n</resources>\n');

// 4) 화면 꺼짐 방지는 웹에서 처리 불가 → 창 플래그를 MainActivity 대신 테마로 설정
const styles = join(app, 'res', 'values', 'styles.xml');
let st = readFileSync(styles, 'utf8');
if (!st.includes('android:keepScreenOn')) {
  st = st.replace('<item name="android:background">@null</item>', '<item name="android:background">@null</item>\n        <item name="android:keepScreenOn">true</item>');
  writeFileSync(styles, st);
}
console.log('android patched');
