import type { PersonalSession, PersonalItem, PersonalMessage, PersonalDraft } from '../model.ts'
interface PrivateProject {id:string;version:number;items:PersonalItem[];conflicts:{status:string;itemIds:string[]}[]}
export function createPersonalWorkspace(p:PrivateProject,actor:{id:string},packet:{projectId:string;tool:string;projectVersion:number;items:PersonalItem[];task:string}|null):PersonalSession
export function effectiveItems(s:PersonalSession):PersonalItem[]
export function simulatePrivateReply(s:PersonalSession,prompt:string):PersonalMessage
export function deriveContextDraft(p:PrivateProject,s:PersonalSession,origin:string,options?:{force?:boolean}):PersonalDraft|null
export function submitDraftPayload(p:PrivateProject,s:PersonalSession,actor:{id:string;role:string}):{itemId:string;before:string;after:string;why:string;baseVersion:number;sourceTool:string;origin:string;originMessageId:string|null;workspaceId:string}
