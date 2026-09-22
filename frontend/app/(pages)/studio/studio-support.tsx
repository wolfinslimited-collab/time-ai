"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Headphones, LoaderCircle, RefreshCw, Ticket, X } from "lucide-react";
import {supportTimeline,hasUnreadSupport,type SupportHistory} from "./support-history";
import { SupportAnswer, SupportSkeleton } from "./support-answer";
import { studioSupabase, studioFetch } from "./supabase";

type Message = { role: "user" | "assistant"; content: string };
const HANDOFF_KEY = "timeless.support.handoff";
function boundedHistory(history: Message[]) {
  const recent = history.slice(-12);
  while (recent.reduce((total, item) => total + item.content.length, 0) > 24000) recent.shift();
  return recent;
}

type Conversation = SupportHistory & {
  id: string;
  status: "chat" | "open" | "resolved";
  ticket_number: number;
  transcript: Message[];
  staff_reply: string | null;
};

export function StudioSupport({ userId, onSignIn }: { userId: string | null; onSignIn: () => void }) {
  const [animatedMessage, setAnimatedMessage] = useState(-1);
  const [open, setOpen] = useState(false);
  const [guestMessages, setGuestMessages] = useState<Message[]>([]);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [streamedAnswer,setStreamedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  const log = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const ticket = conversation && conversation.status !== "chat";

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const request = useCallback(async (action: "load" | "message" | "ticket", message = "", quiet = false) => {
    if (locked.current) return;
    if (!userId && action !== "message") return;
    locked.current = true;
    if (!quiet) { setBusy(true); setError(""); setPendingMessage(message); setStreamedAnswer(""); }
    try {
      let guestHistory: Message[] | undefined;
      if (userId && action === "ticket") {
        try { guestHistory = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null")?.history; } catch { /* Storage may be unavailable. */ }
      }
      const endpoint = userId ? "studio-support" : "studio-support-public";
      const body = userId ? {action,message,guestHistory} : {action,message,history:boundedHistory(guestMessages)};
      let data;
      if (action === "message") {
        const {data: session} = await studioSupabase.auth.getSession();
        const response = await studioFetch(`https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:"sb_publishable_WUFwWg577SCT9xxbYY9i9g_fAUDsR0Q",...(session.session?{Authorization:`Bearer ${session.session.access_token}`}:{})},body:JSON.stringify({...body,stream:true})});
        if(!response.ok)throw {context:response};
        if(!response.body)throw Error("empty_response");
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
        while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;
          while((end=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(!line.startsWith("data:"))continue;const event=JSON.parse(line.slice(5));
            if(event.type==="delta"&&alive.current)setStreamedAnswer(event.answer);
            if(event.type==="done")data=event.data;
            if(event.type==="error")throw Error(event.error);
          }if(done)break;
        }
      } else {
        const result=await studioSupabase.functions.invoke(endpoint,{body});if(result.error)throw result.error;data=result.data;
      }
      if (!data || (userId ? !("conversation" in data) : typeof data.answer !== "string")) throw new Error("invalid_response");
      if (!alive.current) return;
      if (userId) {
        setAnimatedMessage(-1);
        setConversation(data.conversation);
        if (action === "ticket") { try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* Optional handoff storage. */ } }
      } else {
        setAnimatedMessage(-1);
        setGuestMessages(current => [...current, {role: "user", content: message}, {role: "assistant", content: data.answer}]);
        setNeedsSignIn(data.requiresSignIn === true);
      }
      setLoaded(true);
      if (action !== "load") setDraft("");
    } catch (failure) {
      if (alive.current && !quiet) {
        const context = (failure as { context?: Response })?.context;
        setError(context?.status === 429
          ? "You have reached the hourly support limit. Please try again in an hour."
          : "We could not reach support. Your message is saved here—please try again.");
      }
    } finally {
      locked.current = false;
      if (alive.current && !quiet) { setBusy(false); setPendingMessage(""); }
    }
  }, [userId, guestMessages]);

  useEffect(() => {
    if (!userId) return;
    const initial = window.setTimeout(async () => {
      await request("load", "", !open);
      let handoff = null;
      try { handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null"); } catch { /* Optional storage. */ }
      if (open && handoff?.ticket && alive.current) await request("ticket", handoff.message || "Please help with the guest conversation.");
    }, 0);
    const timer = window.setInterval(() => void request("load", "", true), 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [open, userId, request]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => {
      try { if (sessionStorage.getItem(HANDOFF_KEY)) setOpen(true); } catch { /* Optional storage. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [conversation, guestMessages, pendingMessage, error, streamedAnswer]);
  useEffect(() => { if (open && (loaded || !userId)) input.current?.focus(); }, [open, loaded, userId]);

  const unread = hasUnreadSupport(conversation);
  useEffect(() => {
    if (!open || !userId || !conversation?.id || !conversation.last_staff_at || !unread) return;
    const id=conversation.id, seenAt=conversation.last_staff_at;
    void studioSupabase.rpc("studio_support_mark_seen",{p_id:id,p_seen_at:seenAt,p_staff:false}).then(({error})=>{
      if(!error && alive.current)setConversation(current=>current?.id===id?{...current,customer_seen_at:seenAt}:current);
    });
  }, [open,userId,conversation?.id,conversation?.last_staff_at,unread]);

  function signInForHelp() {
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ history: boundedHistory(guestMessages), message: draft.trim(), ticket: true })); } catch { /* Sign-in still works without storage. */ }
    close(); onSignIn();
  }
  function close() { setOpen(false); trigger.current?.focus(); }
  function send(event: FormEvent) { event.preventDefault(); if (draft.trim()) void request("message", draft.trim()); }

  return <aside className="studio-support" aria-label="Studio support">
    {open && <section className="studio-support-panel" id="studio-support-panel" aria-labelledby="studio-support-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className="studio-support-header">
        <span className="studio-support-mark"><Headphones size={22} aria-hidden="true" /></span>
        <div><h2 id="studio-support-title">Studio support</h2><p><span /> AI assistant · Always here</p></div>
        <button type="button" className="studio-support-icon" onClick={close} aria-label="Close support"><X size={20} /></button>
      </header>
      <div className="studio-support-log" ref={log} role="log" aria-label="Support conversation" aria-live="polite" aria-relevant="additions text">
        <div className="studio-support-message assistant"><span>TIMELESS AI</span><p>Hi! What can I help you with?</p><p>Ask about Studio, models, credits or a generation. General questions need no sign-in. For account help or a support ticket, I’ll ask you to sign in.</p></div>
        {(userId ? supportTimeline(conversation) : guestMessages)?.map((message, index) => <div className={`studio-support-message ${message.role}`} key={index}><span>{message.role === "user" ? "YOU" : message.role === "staff" ? "SUPPORT TEAM" : "TIMELESS AI"}</span><SupportAnswer animate={message.role === "assistant" && index === animatedMessage} onProgress={() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }} content={message.content.startsWith("Guest conversation supplied by the customer (unverified context):") ? message.content.replace("Guest conversation supplied by the customer (unverified context):", "Your conversation before signing in:").replace(/\nuser:/g, "\nYou:").replace(/\nassistant:/g, "\nTimeless AI:") : message.content} /></div>)}
        {!userId && needsSignIn && <div className="studio-support-signin"><p>For help with your account or to open a ticket, please sign in. You can keep asking general questions here.</p><button type="button" onClick={signInForHelp}>Sign in for account help</button></div>}
        {pendingMessage && <div className="studio-support-message user"><span>YOU</span><p>{pendingMessage}</p></div>}
        {ticket && <div className="studio-support-ticket"><Ticket size={18} aria-hidden="true" /><div><strong>Ticket #{conversation.ticket_number} · {conversation.status === "resolved" ? "Resolved" : "Open"}</strong><p>Your conversation is attached. Replies appear here.</p></div></div>}

        {busy && (pendingMessage ? (streamedAnswer ? <div className="studio-support-message assistant"><span>TIMELESS AI</span><p className="studio-support-answer">{streamedAnswer}<span className="studio-support-caret" aria-hidden="true" /></p></div> : <SupportSkeleton />) : <p className="studio-support-wait"><LoaderCircle size={15} className="studio-support-spin" /> Connecting…</p>)}
        {error && <div className="studio-support-error" role="alert"><p>{error}</p>{userId && !loaded && <button type="button" disabled={busy} onClick={() => void request("load")}>Try again</button>}</div>}
      </div>
      {<footer className="studio-support-footer">
        <div className="studio-support-actions"><button type="button" disabled={busy || (!!userId && !loaded)} onClick={() => userId ? void request("ticket", draft.trim()) : signInForHelp()}><Ticket size={15} />{ticket ? "Still need help" : "Open a ticket"}</button>{userId && <button type="button" className="studio-support-icon" disabled={busy} aria-label="Refresh support replies" onClick={() => void request("load")}><RefreshCw size={15} /></button>}</div>
        <form onSubmit={send}><textarea ref={input} aria-label="Your support message" placeholder="How can we help?" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} disabled={busy || (!!userId && !loaded)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (draft.trim()) void request("message", draft.trim()); } }} /><button type="submit" aria-label="Send support message" disabled={busy || (!!userId && !loaded) || !draft.trim()}><ArrowUp size={19} /></button></form>
        <p>Free support · Never share passwords or card details.</p>
      </footer>}
    </section>}
    <button ref={trigger} className={`studio-support-launcher${open ? " is-open" : ""}`} type="button" aria-expanded={open} aria-controls="studio-support-panel" onClick={() => setOpen(value => !value)}><Headphones size={20} aria-hidden="true" /><span>{unread ? "New support reply" : "Support"}</span>{unread && <i aria-label="Unread support reply" />}{!unread && ticket && conversation.status === "open" && <i aria-label="Open support ticket" />}</button>
  </aside>;
}
