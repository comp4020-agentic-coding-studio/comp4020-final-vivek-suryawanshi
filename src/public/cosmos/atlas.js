// Notes are untrusted text. Only textContent is used, including live events.
const MAX_LENGTH = 280;
export function createAtlas({ listEl, formEl, textareaEl, charCountEl }) {
  let currentObjectId=null, observations=[], generation=0, loading=false, queued=[], editing=null;
  const drafts=new Map();
  const status=document.getElementById('atlas-status');
  const say=text=>{if(status)status.textContent=text;};
  const endpoint=(object,id)=>`/api/objects/${encodeURIComponent(object)}/observations${id==null?'':`/${id}`}`;
  function updateCharCount(){if(charCountEl)charCountEl.textContent=`${textareaEl.value.length}/${MAX_LENGTH}`;}
  function apply(type,data){
    if(type==='observation-deleted')observations=observations.filter(o=>o.id!==data.id);
    else {const index=observations.findIndex(o=>o.id===data.observation.id);if(index<0)observations.push(data.observation);else observations[index]=data.observation;}
  }
  function render(){
    listEl.replaceChildren(...observations.map(obs=>{
      const li=document.createElement('li');li.className='observation';li.dataset.id=String(obs.id);
      const byline=document.createElement('p');byline.className='observation-byline';byline.textContent=obs.mine?'you':'an explorer';
      const text=document.createElement('p');text.className='observation-text';text.textContent=obs.text;li.append(byline,text);
      if(editing?.id===obs.id){text.replaceWith(editing.form);return li;}
      if(obs.mine){
        const actions=document.createElement('div');actions.className='observation-actions';
        const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>beginEdit(obs));
        const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';
        remove.addEventListener('click',()=>{
          // Inline confirmation keeps an accidental tap reversible until confirmed.
          const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Confirm delete';
          const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Keep';cancel.addEventListener('click',render);
          confirm.addEventListener('click',()=>mutate('DELETE',obs.id,null,confirm));actions.replaceChildren(confirm,cancel);cancel.focus();
        });
        actions.append(edit,remove);li.append(actions);
      }
      return li;
    }));
    if(!observations.length){const empty=document.createElement('li');empty.className='atlas-empty';empty.textContent=loading?'Loading shared observations…':'No observations yet. Be the first to notice something.';listEl.append(empty);}
  }
  async function mutate(method,id,text,button){
    const object=currentObjectId, token=generation;
    if(button)button.disabled=true;say('Saving…');
    try{
      const res=await fetch(endpoint(object,id),{method,headers:{'Content-Type':'application/json'},...(text==null?{}:{body:JSON.stringify({text})})});
      if(!res.ok)throw new Error(res.status===403?'Only the author can change this note.':'Could not save. Your text is kept; please try again.');
      const data=await res.json();
      if(object!==currentObjectId||token!==generation)return true;
      editing=null;apply(method==='DELETE'?'observation-deleted':method==='POST'?'observation-added':'observation-edited',data);render();say(method==='DELETE'?'Observation deleted.':'Saved to the shared atlas.');return true;
    }catch(error){if(token===generation)say(error.message || 'Connection lost. Your text is kept.');return false;}
    finally{if(button)button.disabled=false;}
  }
  function beginEdit(obs){
    const form=document.createElement('form');form.className='observation-edit-form';
    const input=document.createElement('textarea');input.value=obs.text;input.maxLength=MAX_LENGTH;input.required=true;input.setAttribute('aria-label','Edit your observation');
    const save=document.createElement('button');save.type='submit';save.textContent='Save';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.addEventListener('click',()=>{editing=null;render();});
    form.append(input,save,cancel);editing={id:obs.id,form};render();input.focus();
    form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(text)mutate('PATCH',obs.id,text,save);});
  }
  async function refresh(){
    if(!currentObjectId)return;
    const object=currentObjectId,token=++generation;loading=true;queued=[];say('');
    if(!observations.length)render();
    try{
      const res=await fetch(endpoint(object));if(!res.ok)throw new Error();const body=await res.json();
      if(token!==generation)return;
      observations=body.observations??[];
      for(const [type,data] of queued)apply(type,data);
      loading=false;queued=[];render();
    }catch{if(token===generation){loading=false;say('Could not load the atlas. Reopen this destination to retry.');render();}}
  }
  async function open(object){
    if(currentObjectId)drafts.set(currentObjectId,textareaEl.value);
    currentObjectId=object;observations=[];editing=null;
    textareaEl.value=drafts.get(object)??'';updateCharCount();return refresh();
  }
  textareaEl.addEventListener('input',()=>{updateCharCount();if(currentObjectId)drafts.set(currentObjectId,textareaEl.value);});
  formEl.addEventListener('submit',async event=>{
    event.preventDefault();const text=textareaEl.value.trim(),object=currentObjectId;
    if(!text||!object)return;
    const button=formEl.querySelector('button[type="submit"]')??formEl.querySelector('button');
    if(button?.disabled)return;
    if(await mutate('POST',null,text,button)){
      if(currentObjectId===object && textareaEl.value.trim()===text){textareaEl.value='';drafts.delete(object);updateCharCount();}
    }
  });
  function handleStreamEvent(type,data){
    if((data.observation?.objectId??data.objectId)!==currentObjectId)return;
    if(loading){queued.push([type,data]);return;}
    apply(type,data);render();
  }
  return {open,refresh,handleStreamEvent};
}
