const path = require('node:path');

// Extend the live application's Tailwind theme so the reused UI primitives
// render identically, but scan only the demo workspace and the primitives it
// imports. The live configuration file is read, not modified.
const base = require(path.join(__dirname, '..', '..', 'tailwind.config.js'));

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [
    path.join(__dirname, 'app', 'index.html'),
    path.join(__dirname, 'app', '**', '*.{js,jsx}'),
    path.join(__dirname, '..', '..', 'src', 'components', 'ui', '**', '*.{js,jsx}'),
  ],
};
