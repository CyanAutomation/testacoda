import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectFiles, countSource, filterProjects} from '../src/data.js';
test('source selection excludes dependencies and respects bounds',()=>{const r=selectFiles([{type:'blob',path:'src/a.js',size:20},{type:'blob',path:'node_modules/a.js',size:2},{type:'blob',path:'src/b.ts',size:30}],1,100);assert.deepEqual(r.files.map(x=>x.path),['src/a.js']);assert.equal(r.partial,true)});
test('source and estimated test declarations are counted',()=>{assert.deepEqual(countSource('a\n\n test("x",()=>{})\n',true),{lines:2,tests:1})});
test('search and category filters compose',()=>{let list=[{name:'dojo',description:'judo tracker',category:'Judo'},{name:'tool',category:'Tools'}];assert.deepEqual(filterProjects(list,'TRACK','Judo').map(x=>x.name),['dojo']);assert.equal(filterProjects(list,'track','Tools').length,0)});
