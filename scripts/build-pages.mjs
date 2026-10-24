import {build} from 'vite';
import {copyFileSync,writeFileSync} from 'node:fs';
await build({configFile:'vite.pages.config.ts'});
copyFileSync('docs/index.html','index.html');
writeFileSync('.nojekyll','');
