import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const harnessPath = '/__safe_html_output_test__';
const harnessHtml = `<!doctype html><html><body><iframe id="preview"></iframe><script type="module">
  import { renderSafeHtmlDocument, sanitizeHtml, sanitizeHtmlDocument, sanitizeHtmlWithBreaks, sanitizeStyleSheet } from '/src/lib/safeHtml.js';
  Object.assign(window, { renderSafeHtmlDocument, sanitizeHtml, sanitizeHtmlDocument, sanitizeHtmlWithBreaks, sanitizeStyleSheet });
  window.__safeHtmlReady = true;
</script></body></html>`;

let viteServer;
let browser;
let page;
let requests;

test.before(async () => {
  viteServer = await createServer({
    root: new URL('../..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)),
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true },
    plugins: [{
      name: 'safe-html-output-harness',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url !== harnessPath) return next();
          response.end(await server.transformIndexHtml(request.url, harnessHtml));
        });
      },
    }],
  });
  await viteServer.listen();
  const address = viteServer.httpServer.address();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`http://127.0.0.1:${address.port}${harnessPath}`);
  await page.waitForFunction(() => window.__safeHtmlReady === true);
});

test.after(async () => {
  await page?.close();
  await browser?.close();
  await viteServer?.close();
});

test('rejects active HTML, advisory IMG/onloadstart, dangerous URLs, CSS URLs, SVG and MathML', async () => {
  const payload = [
    '<style>.ok{color:#123}.leak{background:url(https://attacker.invalid/style)}</style>',
    '<meta http-equiv="refresh" content="0;url=https://attacker.invalid/meta">',
    '<link rel="stylesheet" href="https://attacker.invalid/sheet"><base href="https://attacker.invalid/base/">',
    '<h2 onmouseover="window.__safeHtmlAttack=1">Heading<img src="https://attacker.invalid/pixel" onloadstart="window.__safeHtmlAttack=2" onerror="window.__safeHtmlAttack=3"></h2>',
    '<p style="color:red;background-image:url(https://attacker.invalid/css)">Safe <a href="javascript:window.__safeHtmlAttack=4">link</a></p>',
    '<script>window.__safeHtmlAttack=5</script><iframe src="https://attacker.invalid/frame"></iframe>',
    '<object data="https://attacker.invalid/object"></object><svg onload="window.__safeHtmlAttack=6"><foreignObject>bad</foreignObject></svg>',
    '<math><mtext>bad</mtext></math>',
  ].join('');

  const result = await page.evaluate((html) => {
    delete window.__safeHtmlAttack;
    const sanitized = window.sanitizeHtml(html);
    const documentHtml = window.sanitizeHtmlDocument(html);
    const frame = document.getElementById('preview');
    window.renderSafeHtmlDocument(frame.contentWindow, html);
    const preview = frame.contentDocument;
    return {
      sanitized,
      documentHtml,
      previewHtml: preview.documentElement.outerHTML,
      csp: preview.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
      attackExecuted: Boolean(window.__safeHtmlAttack || frame.contentWindow.__safeHtmlAttack),
    };
  }, payload);

  for (const value of [result.sanitized, result.documentHtml, result.previewHtml]) {
    assert.doesNotMatch(value, /<(?:script|iframe|object|svg|math)\b|onload|onerror|onmouseover|javascript:|attacker\.invalid|url\s*\(/i);
  }
  assert.match(result.sanitized, /<h2>Heading<\/h2>/);
  assert.match(result.sanitized, /<p style="color: red;">Safe <a rel="noopener noreferrer">link<\/a><\/p>/);
  assert.match(result.csp, /default-src 'none'/);
  assert.equal(result.attackExecuted, false);
  assert.equal(requests.some((url) => url.includes('attacker.invalid')), false);
});

test('preserves report formatting, safe links, line breaks and outcome tables', async () => {
  const input = '<style>@media print { table { border-collapse: collapse; } } .py-0\\.5 { padding-top: 2px; }</style><h1 class="title">Report</h1><p style="color:#123456;text-align:center">One\n<strong>Two</strong> <a href="https://example.test/report" target="_blank">source</a></p><table class="outcome"><thead><tr><th scope="col">Assessment</th><th>Current</th></tr></thead><tbody><tr><td rowspan="2">Walk</td><td><em>Improved</em></td></tr></tbody></table>';
  const result = await page.evaluate((html) => ({
    fragment: window.sanitizeHtmlWithBreaks(html),
    documentHtml: window.sanitizeHtmlDocument(html),
    unsafeSheet: window.sanitizeStyleSheet('.x{background:url(https://example.test/x)}'),
  }), input);

  assert.match(result.fragment, /<h1 class="title">Report<\/h1>/);
  assert.match(result.fragment, /color: rgb\(18, 52, 86\); text-align: center;/);
  assert.match(result.fragment, /One<br><strong>Two<\/strong>/);
  assert.match(result.fragment, /<table class="outcome">[\s\S]*<th scope="col">Assessment<\/th>[\s\S]*<td rowspan="2">Walk<\/td>/);
  assert.match(result.fragment, /href="https:\/\/example\.test\/report" target="_blank" rel="noopener noreferrer"/);
  assert.match(result.documentHtml, /@media print \{ table \{ border-collapse: collapse; \} \}/);
  assert.match(result.documentHtml, /\.py-0\\\.5 \{ padding-top: 2px; \}/);
  assert.equal(result.unsafeSheet, '');
});
