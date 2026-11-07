import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAtlas } from '../src/public/cosmos/atlas.js';
let dom: JSDOM;
let atlas: ReturnType<typeof createAtlas>;
let list: HTMLUListElement;
let input: HTMLTextAreaElement;
let form: HTMLFormElement;
const note = (id:number,objectId='earth')=>({id,objectId,text:`note ${id}`,mine:false});
const reply=(observations:unknown[])=>({ok:true,json:async()=>({observations})});
beforeEach(()=>{
  dom=new JSDOM('<p id="atlas-status"></p><ul></ul><form><textarea></textarea><button type="submit">Add</button></form><span></span>');
  vi.stubGlobal('document',dom.window.document);
  list=document.querySelector('ul')!;form=document.querySelector('form')!;input=document.querySelector('textarea')!;
  atlas=createAtlas({listEl:list,formEl:form,textareaEl:input,charCountEl:document.querySelector('span')});
});
afterEach(()=>{vi.unstubAllGlobals();dom.window.close();});
it('ignores an old destination response after switching destinations',async()=>{
  let resolveEarth!:(value:unknown)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveEarth=resolve;})).mockResolvedValueOnce(reply([note(2,'saturn')])));
  const old=atlas.open('earth');await atlas.open('saturn');resolveEarth(reply([note(1)]));await old;
  expect(list.textContent).toContain('note 2');expect(list.textContent).not.toContain('note 1');
});
it('merges a live event arriving while the initial snapshot loads, without duplicates',async()=>{
  let resolve!:(value:unknown)=>void;
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));
  const pending=atlas.open('earth');atlas.handleStreamEvent('observation-added',{observation:note(1)});
  resolve(reply([note(1)]));await pending;
  atlas.handleStreamEvent('observation-added',{observation:note(1)});
  expect(list.querySelectorAll('.observation')).toHaveLength(1);
});
it('keeps a separate unsent draft for each destination',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>reply([])));
  await atlas.open('earth');input.value='Earth draft';await atlas.open('saturn');input.value='Saturn draft';await atlas.open('earth');expect(input.value).toBe('Earth draft');
});
it('keeps text and shows a useful message when posting fails',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply([])).mockRejectedValueOnce(new Error('Offline')));
  await atlas.open('earth');input.value='Do not lose this';form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  await vi.waitFor(()=>expect(document.getElementById('atlas-status')!.textContent).toContain('Offline'));
  expect(input.value).toBe('Do not lose this');expect(form.querySelector('button')!.disabled).toBe(false);
});
