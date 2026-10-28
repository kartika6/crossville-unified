const clone=v=>structuredClone(v);
const now=()=>new Date().toISOString();
const allowed=i=>i.access==='shared'&&i.status==='active';
const categories=['brief','decisions','constraints','questions'];
function snapshot(project) {
  const withheld=new Set((project.conflicts||[]).filter(c=>c.status==='unresolved').flatMap(c=>c.itemIds));
  return {items:clone(project.items.filter(i=>allowed(i)&&!withheld.has(i.id))),withheldCount:project.items.filter(i=>allowed(i)&&withheld.has(i.id)).length};
}
export function createPersonalWorkspace(project,actor,packet=null) {
  if(!actor?.id)throw new Error('A workspace owner is required.');
  if(packet&&packet.projectId!==project.id)throw new Error('This handoff belongs to another project.');
  const current=snapshot(project);
  const items=packet?clone(packet.items.filter(allowed)):current.items;
  const session={id:`private-${project.id}-${actor.id}`,projectId:project.id,ownerId:actor.id,tool:packet?.tool||'Claude',contextVersion:packet?.projectVersion||project.version,snapshotItems:items,withheldCount:packet?0:current.withheldCount,includedCategories:categories.filter(c=>items.some(i=>i.category===c)),notes:'We are part of the study, not just observers.\n\nLook at how context changes our own collaboration. Capture moments of friction, not just outcomes.',notesEligible:true,autoManage:true,messages:[],draft:null,managerState:'ready',updatedAt:now()};
  const question=packet?.task||(project.id==='shared-context'?'What if we shift from interview-first to action research inside our own team? How would that change our study method?':'How could we pilot event discovery with a small group of new students?');
  session.messages.push({id:crypto.randomUUID(),role:'user',text:question,time:now(),contextVersion:session.contextVersion});
  session.messages.push(simulatePrivateReply(session,question));
  return session;
}
export function effectiveItems(session) {
  return clone(session.snapshotItems.filter(i=>allowed(i)&&(i.category==='brief'||session.includedCategories.includes(i.category))));
}
export function refreshPersonalContext(session,project) {
  if(session.projectId!==project.id)throw new Error('Workspace and project do not match.');
  const s=clone(session),current=snapshot(project);
  s.snapshotItems=current.items;s.withheldCount=current.withheldCount;s.contextVersion=project.version;s.updatedAt=now();
  if(s.draft&&!s.draft.proposalId){const item=s.snapshotItems.find(i=>i.id===s.draft.itemId);if(item){s.draft.before=item.content;s.draft.baseVersion=project.version;s.draft.rebased=true;}else{s.draft=null;}}
  return s;
}
export function simulatePrivateReply(session,prompt) {
  const items=effectiveItems(session),method=items.find(i=>i.category==='decisions');
  const constraints=items.filter(i=>i.category==='constraints').map(i=>i.content).join(' ');
  const research=/action research|行动研究/i.test(prompt);
  const text=research?`That is a useful direction to explore. Instead of only asking people how they work with AI, you could study how your own team uses the prototype.\n\nThis is an exploration, not an approved team decision.${method?` The current shared approach is: ${method.content}`:' No Decisions section is included in this conversation.'}\n\nHere is a lightweight action research cycle:`:`I can help explore this using the ${items.length} selected context items in v${session.contextVersion}.\n\n${method?`Current approved direction: ${method.content}`:'No approved decision was selected for this conversation.'}\n\nFor “${prompt}”, start with a bounded task, record what happens, and compare the result with your goal.${constraints?`\n\nSelected constraints: ${constraints}`:''}\n\nAny suggested project change remains a private draft until you send it for review.`;
  return {id:crypto.randomUUID(),role:'assistant',text,time:now(),contextVersion:session.contextVersion,itemIds:items.map(i=>i.id),tool:session.tool,steps:research?[{title:'Plan',text:'Agree on one collaboration task and what you want to learn.'},{title:'Act',text:'Use the prototype in your team’s real workflow.'},{title:'Observe',text:'Capture context updates, proposals, and moments of friction.'},{title:'Reflect',text:'Discuss what changed, then refine the next cycle.'}]:[],simulation:true};
}
export function deriveContextDraft(project,session,origin='notes',{force=false}={}) {
  if(session.draft?.proposalId)return clone(session.draft);
  if(!force&&!session.autoManage)return clone(session.draft||null);
  if(origin==='notes'&&!session.notesEligible)return clone(session.draft||null);
  if(session.draft?.edited&&!force)return clone(session.draft);
  const message=[...session.messages].reverse().find(m=>m.role==='user');
  const response=[...session.messages].reverse().find(m=>m.role==='assistant');
  const text=(origin==='notes'?session.notes:response?.text||message?.text||'').trim();
  if(text.length<12)return clone(session.draft||null);
  const fingerprint=`${origin}:${text}`;
  if(!force&&(session.draft?.fingerprint===fingerprint||session.dismissedFingerprint===fingerprint))return clone(session.draft||null);
  const items=effectiveItems(session),target=items.find(i=>i.category==='decisions')||items.find(i=>i.category==='brief');
  if(!target)return null;
  const research=origin==='chat'?Boolean(response?.steps?.length):/action research|行动研究/i.test(text);
  const after=research?'Run action research inside our own team, using short cycles of planning, acting, observing, and reflecting.':origin==='chat'?'Pilot one bounded team task, record context updates and moments of friction, then compare the result with our project goal.':text.split(/\n/).map(v=>v.trim()).find(v=>v.length>=12)?.slice(0,1000)||text.slice(0,1000);
  return {id:crypto.randomUUID(),itemId:target.id,category:target.category,before:target.content,after,why:research?'Study our actual collaboration, learn from real use, and improve the prototype together.':`A candidate improvement extracted from ${origin==='notes'?'my eligible private notes':'my private exploration'}. Review and edit it before sharing.`,baseVersion:session.contextVersion,sourceTool:session.tool,origin,originMessageId:origin==='chat'?(response?.id||message?.id):null,fingerprint,edited:false,rebased:false,createdAt:now(),proposalId:null};
}
export function submitDraftPayload(project,session,actor) {
  if(actor?.id!==session.ownerId||!['owner','editor'].includes(actor.role))throw new Error('Only this workspace owner with write permission can submit a proposal.');
  const draft=session.draft;
  if(!draft)throw new Error('Create or generate a draft first.');
  if(draft.proposalId)throw new Error('This draft has already been submitted.');
  if(project.id!==session.projectId||project.version!==draft.baseVersion||session.contextVersion!==project.version)throw new Error('Project context has a newer version. Update context and review the draft before sending.');
  const target=project.items.find(i=>i.id===draft.itemId&&allowed(i));
  if(!target||target.content!==draft.before)throw new Error('The source context changed. Update context before submitting.');
  if(!draft.after?.trim()||!draft.why?.trim())throw new Error('Add both the proposed change and a reason.');
  if(draft.after.trim()===target.content.trim())throw new Error('The proposed context is unchanged.');
  return {itemId:target.id,before:target.content,after:draft.after.trim(),why:draft.why.trim(),baseVersion:project.version,workspaceId:session.id,origin:draft.origin,originMessageId:draft.originMessageId||null,sourceTool:draft.sourceTool||session.tool};
}
