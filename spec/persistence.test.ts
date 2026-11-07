import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

it('preserves an owned observation after the database process exits and restarts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cosmos-persistence-'));
  const dbPath=join(dir,'cosmos.db');
  const moduleUrl=pathToFileURL(join(process.cwd(),'src/db.ts')).href;
  const prelude=`import {openDb,addObservation,getObservations,setPlayerName,getPlayerName} from ${JSON.stringify(moduleUrl)};const db=openDb(${JSON.stringify(dbPath)});`;
  try {
    execFileSync(process.execPath,['--input-type=module','-e',prelude+`setPlayerName(db,'test-author','Explorer');addObservation(db,'earth','test-author','A note that survives a restart');db.close();`]);
    const output=execFileSync(process.execPath,['--input-type=module','-e',prelude+`console.log(JSON.stringify({name:getPlayerName(db,'test-author'),notes:getObservations(db,'earth')}));db.close();`],{encoding:'utf8'});
    const data=JSON.parse(output);expect(data.name).toBe('Explorer');expect(data.notes[0].authorId).toBe('test-author');expect(data.notes[0].text).toBe('A note that survives a restart');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
