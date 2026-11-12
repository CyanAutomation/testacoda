import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectFiles, countSource, filterProjects, formatReleaseDate, isWebUrl} from '../src/data.js';
test('source selection excludes dependencies and respects bounds',()=>{const r=selectFiles([{type:'blob',path:'src/a.js',size:20},{type:'blob',path:'node_modules/a.js',size:2},{type:'blob',path:'src/b.ts',size:30}],1,100);assert.deepEqual(r.files.map(x=>x.path),['src/a.js']);assert.equal(r.partial,true)});
test('source and estimated test declarations are counted',()=>{assert.deepEqual(countSource('a\n\n test("x",()=>{})\n',true),{lines:2,tests:1})});
test('search and category filters compose',()=>{let list=[{name:'dojo',description:'judo tracker',category:'Judo'},{name:'tool',category:'Tools'}];assert.deepEqual(filterProjects(list,'TRACK','Judo').map(x=>x.name),['dojo']);assert.equal(filterProjects(list,'track','Tools').length,0)});

test('screenshot paths are encoded one segment at a time',async()=>{const {encodePath}=await import('../src/data.js');assert.equal(encodePath('screenshots/"a#b? c.png'), 'screenshots/%22a%23b%3F%20c.png')});
test('reports when both snapshot and bundled fallback fail',async()=>{const {loadSnapshot}=await import('../src/data.js');const calls=[];const fetcher=async url=>{calls.push(url);if(url==='/api/snapshot')return new Response('',{status:503});throw new Error('offline')};const result=await loadSnapshot(fetcher,[]);assert.deepEqual(calls,['/api/snapshot','/repos.json']);assert.equal(result.repos.length,0);assert.match(result.message,/unavailable/i);assert.equal(result.snapshot,null)});
test('keeps existing data when snapshot refresh fails',async()=>{const {loadSnapshot}=await import('../src/data.js');let calls=0;const existing=[{name:'old'}];const result=await loadSnapshot(async()=>{calls++;throw Error('offline')},existing);assert.equal(calls,1);assert.deepEqual(result.repos,existing);assert.match(result.message,/unavailable/i)});

test('formats valid release dates and handles missing or invalid dates',()=>{assert.equal(formatReleaseDate('2025-12-03T10:30:00Z'),'3 Dec 2025');assert.equal(formatReleaseDate(null),'');assert.equal(formatReleaseDate('not-a-date'),'')});
test('demo links accept only HTTP and HTTPS URLs',()=>{assert.equal(isWebUrl('https://gogomio.cloud.run'),true);assert.equal(isWebUrl('http://example.test'),true);assert.equal(isWebUrl('javascript:alert(1)'),false);assert.equal(isWebUrl(null),false)});
test('portfolio UI has no stars metric and labels its optional homepage link as a demo',async()=>{const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/\bid="stars"|\bSTARS\b|\bid="updated"/);assert.match(html,/<a id="live"[^>]*>Visit demo<\/a>/);});
