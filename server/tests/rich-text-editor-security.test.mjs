import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const harnessPath = '/__rich_text_security_test__';

const harnessHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><title>Rich-text security test</title></head>
  <body>
    <div id="app"></div>
    <script type="module">
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import Quill from 'quill';
      import RichTextEditor from '/src/components/ui/RichTextEditor.jsx';
      import { sanitizeRichTextHtml } from '/src/lib/richTextSanitizer.js';

      const root = createRoot(document.getElementById('app'));
      window.__richTextChanges = [];
      window.__richTextErrors = [];
      window.addEventListener('error', (event) => {
        window.__richTextErrors.push(event.message);
      });
      window.renderRichTextEditor = ({ value = '', placeholder = '', className = '' }) => {
        window.__richTextChanges = [];
        root.render(React.createElement(
          React.StrictMode,
          null,
          React.createElement(RichTextEditor, {
            value,
            placeholder,
            className,
            onChange: (nextValue) => window.__richTextChanges.push(nextValue),
          }),
        ));
      };
      window.getQuillForTest = () => Quill.find(document.querySelector('.ql-container'));
      window.sanitizeRichTextHtmlForTest = sanitizeRichTextHtml;
      window.__richTextHarnessReady = true;
    </script>
  </body>
</html>`;

let viteServer;
let browser;
let page;

test.before(async () => {
  viteServer = await createServer({
    root: repoRoot,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true },
    plugins: [{
      name: 'rich-text-security-test-harness',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url !== harnessPath) return next();
          const html = await server.transformIndexHtml(request.url, harnessHtml);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(html);
        });
      },
    }],
  });
  await viteServer.listen();
  const address = viteServer.httpServer.address();
  assert.equal(typeof address, 'object');

  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}${harnessPath}`);
  await page.waitForFunction(() => window.__richTextHarnessReady === true);
});

test.after(async () => {
  await page?.close();
  await browser?.close();
  await viteServer?.close();
});

test('rich-text editor excludes the vulnerable ReactQuill and Quill 1 dependency chain', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const lockedPackages = packageLock.packages || {};
  const reactQuillEntries = Object.entries(lockedPackages)
    .filter(([packagePath]) => /(?:^|\/)node_modules\/react-quill$/.test(packagePath));
  const quillEntries = Object.entries(lockedPackages)
    .filter(([packagePath]) => /(?:^|\/)node_modules\/quill$/.test(packagePath));

  assert.equal(packageJson.dependencies?.['react-quill'], undefined);
  assert.equal(packageJson.dependencies?.quill, '2.0.2');
  assert.deepEqual(reactQuillEntries, []);
  assert.deepEqual(
    quillEntries.map(([packagePath, metadata]) => [packagePath, metadata.version]),
    [['node_modules/quill', '2.0.2']],
  );
});

test('strict reconstruction rejects the advisory image payload and all attacker attributes', async () => {
  const payload = [
    '<h2 onmouseover="window.__richTextAttack = 1">Heading',
    '<img src="x" onloadstart="window.__richTextAttack = 2" onerror="window.__richTextAttack = 3">',
    '</h2>',
    '<p><strong onclick="window.__richTextAttack = 4">Safe</strong>',
    '<a href="javascript:window.__richTextAttack = 5">link</a>',
    '<svg onload="window.__richTextAttack = 6"><foreignObject>bad</foreignObject></svg>',
    '<script>window.__richTextAttack = 7</script></p>',
    '<ol onclick="window.__richTextAttack = 8"><li data-list="ordered" style="color:red" onfocus="window.__richTextAttack = 9">One</li></ol>',
  ].join('');

  const result = await page.evaluate((maliciousHtml) => {
    const sanitized = window.sanitizeRichTextHtmlForTest(maliciousHtml);
    const probe = document.createElement('div');
    probe.innerHTML = sanitized;
    return {
      sanitized,
      tags: [...probe.querySelectorAll('*')].map((element) => element.tagName),
      attributes: [...probe.querySelectorAll('*')]
        .flatMap((element) => [...element.attributes].map((attribute) => (
          `${element.tagName}:${attribute.name}=${attribute.value}`
        ))),
      attackExecuted: Boolean(window.__richTextAttack),
    };
  }, payload);

  assert.equal(
    result.sanitized,
    '<h2>Heading</h2><p><strong>Safe</strong>link</p><ol><li data-list="ordered">One</li></ol>',
  );
  assert.deepEqual(result.tags, ['H2', 'P', 'STRONG', 'OL', 'LI']);
  assert.deepEqual(result.attributes, ['LI:data-list=ordered']);
  assert.equal(result.attackExecuted, false);
});

test('controlled editor preserves its contract and never renders unsafe supplied markup', async () => {
  const payload = [
    '<h2 onclick="window.__richTextAttack = 10">Heading</h2>',
    '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u>',
    '<img src="x" onloadstart="window.__richTextAttack = 11" onerror="window.__richTextAttack = 12"></p>',
    '<ol><li>Ordered</li></ol><ul><li>Bullet</li></ul>',
  ].join('');

  await page.evaluate((value) => {
    delete window.__richTextAttack;
    window.renderRichTextEditor({
      value,
      placeholder: 'Write a clinical summary',
      className: 'contract-class',
    });
  }, payload);
  await page.waitForSelector('.contract-class .ql-editor');
  await page.waitForFunction(() => document.querySelector('.ql-editor')?.textContent.includes('Bullet'));

  const rendered = await page.evaluate(() => {
    const editor = document.querySelector('.ql-editor');
    return {
      html: editor.innerHTML,
      text: editor.textContent,
      placeholder: editor.getAttribute('data-placeholder'),
      hasContractClass: document.querySelector('.rich-text-editor')?.classList.contains('contract-class'),
      forbiddenCount: editor.querySelectorAll('img,svg,script,style,iframe,object,embed,a').length,
      eventAttributes: [...editor.querySelectorAll('*')]
        .flatMap((element) => [...element.attributes])
        .filter((attribute) => attribute.name.toLowerCase().startsWith('on'))
        .length,
      attackExecuted: Boolean(window.__richTextAttack),
      toolbar: {
        count: document.querySelectorAll('.rich-text-editor > .ql-toolbar').length,
        heading: Boolean(document.querySelector('.ql-toolbar .ql-header')),
        bold: Boolean(document.querySelector('.ql-toolbar .ql-bold')),
        italic: Boolean(document.querySelector('.ql-toolbar .ql-italic')),
        underline: Boolean(document.querySelector('.ql-toolbar .ql-underline')),
        ordered: Boolean(document.querySelector('.ql-toolbar .ql-list[value="ordered"]')),
        bullet: Boolean(document.querySelector('.ql-toolbar .ql-list[value="bullet"]')),
        clean: Boolean(document.querySelector('.ql-toolbar .ql-clean')),
      },
    };
  });

  assert.match(rendered.text, /Heading/);
  assert.match(rendered.text, /Bold Italic Underline/);
  assert.match(rendered.text, /Ordered/);
  assert.match(rendered.text, /Bullet/);
  assert.equal(rendered.placeholder, 'Write a clinical summary');
  assert.equal(rendered.hasContractClass, true);
  assert.equal(rendered.forbiddenCount, 0);
  assert.equal(rendered.eventAttributes, 0);
  assert.equal(rendered.attackExecuted, false);
  assert.deepEqual(rendered.toolbar, {
    count: 1,
    heading: true,
    bold: true,
    italic: true,
    underline: true,
    ordered: true,
    bullet: true,
    clean: true,
  });

  await page.locator('.ql-editor').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' updated');
  await page.waitForFunction(() => window.__richTextChanges.some((value) => value.includes('updated')));
  const lastChange = await page.evaluate(() => window.__richTextChanges.at(-1));
  assert.match(lastChange, /updated/);
  assert.match(lastChange, /<ol>/);
  assert.match(lastChange, /<ul>/);
  assert.doesNotMatch(lastChange, /<img|onloadstart|onerror|onclick/i);
});

test('external controlled updates, empty normalization and toolbar commands remain functional', async () => {
  await page.evaluate(() => {
    window.renderRichTextEditor({ value: '<p>Original value</p>', placeholder: 'Controlled' });
  });
  await page.waitForFunction(() => document.querySelector('.ql-editor')?.textContent === 'Original value');
  assert.deepEqual(await page.evaluate(() => window.__richTextChanges), []);

  await page.evaluate(() => {
    window.renderRichTextEditor({ value: '<h3>Replacement</h3><p>Body</p>', placeholder: 'Controlled' });
  });
  await page.waitForFunction(() => document.querySelector('.ql-editor')?.textContent.includes('ReplacementBody'));
  assert.deepEqual(await page.evaluate(() => window.__richTextChanges), []);

  await page.evaluate(() => {
    const editor = window.getQuillForTest();
    editor.setSelection(0, 'Replacement'.length, 'silent');
    document.querySelector('.ql-toolbar .ql-bold').click();
  });
  await page.waitForFunction(() => window.__richTextChanges.some((value) => /<strong>Replacement<\/strong>/.test(value)));

  await page.evaluate(() => {
    window.renderRichTextEditor({ value: '<p><br></p>', placeholder: 'Controlled' });
  });
  await page.waitForFunction(() => document.querySelector('.ql-editor')?.textContent === '');
  const emptyState = await page.evaluate(() => ({
    html: document.querySelector('.ql-editor').innerHTML,
    changes: window.__richTextChanges,
    toolbars: document.querySelectorAll('.rich-text-editor > .ql-toolbar').length,
  }));
  assert.equal(emptyState.html, '<p><br></p>');
  assert.deepEqual(emptyState.changes, []);
  assert.equal(emptyState.toolbars, 1, 'StrictMode remount must not leave a duplicate toolbar');
});

test('paste and drop paths sanitize HTML before Quill receives it', async () => {
  const payload = [
    '<p><strong onpointerenter="window.__richTextAttack = 20">Pasted</strong>',
    '<img src="x" onloadstart="window.__richTextAttack = 21" onerror="window.__richTextAttack = 22">',
    '<svg onload="window.__richTextAttack = 23"></svg></p>',
  ].join('');

  await page.evaluate(() => {
    delete window.__richTextAttack;
    window.renderRichTextEditor({ value: '', placeholder: 'Paste here' });
  });
  await page.waitForSelector('.ql-editor');
  await page.locator('.ql-editor').click();

  const pastePrevented = await page.evaluate((maliciousHtml) => {
    const transfer = new DataTransfer();
    transfer.setData('text/html', maliciousHtml);
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer,
    });
    document.querySelector('.ql-editor').dispatchEvent(event);
    return event.defaultPrevented;
  }, payload);
  assert.equal(pastePrevented, true);
  await page.waitForFunction(() => window.__richTextChanges.some((value) => value.includes('Pasted')));

  const dropPrevented = await page.evaluate((maliciousHtml) => {
    const transfer = new DataTransfer();
    transfer.setData('text/html', maliciousHtml.replace('Pasted', 'Dropped'));
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    document.querySelector('.ql-editor').dispatchEvent(event);
    return event.defaultPrevented;
  }, payload);
  assert.equal(dropPrevented, true);
  await page.waitForFunction(() => window.__richTextChanges.some((value) => value.includes('Dropped')));

  const result = await page.evaluate(() => ({
    html: document.querySelector('.ql-editor').innerHTML,
    changes: window.__richTextChanges,
    attackExecuted: Boolean(window.__richTextAttack),
    errors: window.__richTextErrors,
  }));
  assert.match(result.html, /Pasted/);
  assert.match(result.html, /Dropped/);
  assert.doesNotMatch(result.html, /<img|<svg|onloadstart|onerror|onpointerenter/i);
  assert.doesNotMatch(JSON.stringify(result.changes), /<img|<svg|onloadstart|onerror|onpointerenter/i);
  assert.equal(result.attackExecuted, false);
  assert.deepEqual(result.errors, []);
});
