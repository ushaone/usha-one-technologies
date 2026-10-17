// Host with the existing CRM. api(path,{method,body,idempotencyKey}) calls its authenticated SAME-ORIGIN server proxy.
// Never inject model text into innerHTML. This component does not persist credentials or send messages.
export function mountReviewPanel(root,{api,leadId}) {
 root.replaceChildren();root.classList.add('one-ai-panel');
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const title=node('h3','ONE AI · Follow-up review'),status=node('p','Select a language to prepare a draft.'),select=node('select');
 select.setAttribute('aria-label','Draft language');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 for(const [value,label] of [['en','English'],['te','తెలుగు'],['hi','हिन्दी']]){const option=node('option',label);option.value=value;select.append(option);}
 const content=node('textarea');content.rows=6;content.maxLength=4000;content.setAttribute('aria-label','Draft message');
 const actions=node('div'),list=node('div');actions.className='one-ai-actions';list.className='one-ai-list';let draft=null,busy=false,requestKey=null,nextCursor=null;
 const controls=[];
 async function run(work){if(busy)return;busy=true;controls.forEach(x=>x.disabled=true);status.textContent='Working…';try{await work();}catch(e){status.textContent=e.message||'Unable to complete request';}finally{busy=false;controls.forEach(x=>x.disabled=false);}}
 function show(d){draft=d;content.value=d.message;status.textContent=`${d.state} · Version ${d.version}. Review accuracy and language before approval.`;}
 function button(label,work){const b=node('button',label);b.type='button';b.onclick=()=>run(work);actions.append(b);controls.push(b);}
 button('Generate draft',async()=>{requestKey??=crypto.randomUUID();const d=await api('/api/drafts/generate',{method:'POST',body:{leadId,language:select.value},idempotencyKey:requestKey});requestKey=null;show(d);await refresh(false);});
 select.onchange=()=>{requestKey=null;};
 for(const [action,label] of [['edit','Save revision'],['submit','Submit for approval'],['approve','Approve'],['reject','Reject']])button(label,async()=>{
  if(!draft)throw Error('Select a draft first.');
  if(action!=='edit'&&content.value!==draft.message)throw Error('Save your revision before continuing.');
  const d=await api(`/api/drafts/${draft.id}/transition`,{method:'POST',body:{action,version:draft.version,...(action==='edit'?{message:content.value}:{})}});show(d);await refresh(false);
 });
 async function refresh(showStatus=true,append=false){const result=await api('/api/drafts?leadId='+encodeURIComponent(leadId)+(append&&nextCursor?'&before='+encodeURIComponent(nextCursor):''));if(!append)list.replaceChildren();nextCursor=result.nextCursor;
  for(const d of result.drafts){const b=node('button',`${d.language} · ${d.state} · ${d.createdAt}`);b.type='button';b.onclick=()=>{if(!busy)show(d);};list.append(b);}
  if(showStatus)status.textContent=result.drafts.length?'Select a draft to review.':'No drafts yet.';
 }
 button('Reload drafts',()=>refresh());button('Load older drafts',async()=>{if(!nextCursor)throw Error('No older drafts.');await refresh(false,true);});
 root.append(title,select,content,actions,status,list,node('p','Sending is disabled. Approval does not contact the customer.'));
 run(()=>refresh());return {reload:()=>run(()=>refresh())};
}
