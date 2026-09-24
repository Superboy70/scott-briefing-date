// 웹 공유용 단일 HTML 빌드: CSS·JS를 한 파일에 넣는다 → dist/demon-crusade.html
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
const html = readFileSync(join(www, 'index.html'), 'utf8');
const css = readFileSync(join(www, 'style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(src => `// ---- ${src} ----\n` + readFileSync(join(www, src), 'utf8')).join('\n');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script src="[^"]+"><\/script>\s*/g, '');
const out = `<title>마계 성전</title>
<meta name="theme-color" content="#0b0806">
<style>
${css}
html, body { height: 100%; }
</style>
${body.trim()}
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'demon-crusade.html'), out);
console.log('dist/demon-crusade.html', (out.length / 1024).toFixed(0) + 'KB');
