export type SupportMessage = {role:'user'|'assistant'|'staff';content:string;created_at?:string};
export type SupportHistory = {transcript?:SupportMessage[];staff_reply?:string|null;staff_replies?:{id:string;content:string;created_at:string}[];last_staff_at?:string|null;customer_seen_at?:string|null};
export function supportTimeline(conversation:SupportHistory|null):SupportMessage[] {
 if(!conversation)return [];
 const replies=conversation.staff_replies?.length?conversation.staff_replies:conversation.staff_reply?[{content:conversation.staff_reply,created_at:conversation.last_staff_at||undefined}]:[];
 return [...(conversation.transcript||[]),...replies.map(r=>({...r,role:'staff' as const}))].sort((a,b)=>(Date.parse(a.created_at||'')||0)-(Date.parse(b.created_at||'')||0));
}
export function hasUnreadSupport(conversation:SupportHistory|null){return !!conversation?.last_staff_at && Date.parse(conversation.last_staff_at)>(Date.parse(conversation.customer_seen_at||'')||0);}
