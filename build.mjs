import { cp, copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/site', { recursive: true });
await Promise.all([
  copyFile('index.html', 'dist/site/index.html'),
  copyFile('script.js', 'dist/site/script.js'),
  copyFile('style.css', 'dist/site/style.css'),
  cp('assets', 'dist/site/assets', { recursive: true }),
]);
