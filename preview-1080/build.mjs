import {build} from 'esbuild';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';

await mkdir('dist/assets/weather',{recursive:true});
await build({entryPoints:['src/preview.jsx'],bundle:true,minify:true,outfile:'dist/preview.js',loader:{'.svg':'dataurl'},jsx:'automatic',target:['es2022'],define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await copyFile('assets/avatar.png','dist/assets/avatar.png');
await copyFile('assets/meteocons-LICENSE.txt','dist/assets/weather/LICENSE.txt');
await writeFile('dist/index.html','<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hooper Navigation</title><link rel="icon" href="assets/avatar.png"><link rel="stylesheet" href="preview.css"><script defer src="preview.js"></script></head><body><div id="root"></div></body></html>');
