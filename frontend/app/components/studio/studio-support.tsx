"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Headphones, LoaderCircle, RefreshCw, Ticket, X } from "lucide-react";
import { supportTimeline, hasUnreadSupport, type SupportHistory } from "../../lib/studio/support-history";
import { SupportAnswer, SupportSkeleton } from "./support-answer";
import { studioSupabase, studioFetch } from "../../lib/studio/supabase";
import { supportCopy } from "./copy/support";

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

function roleLabel(role: string) {
  if (role === "user") return supportCopy.roles.user;
  if (role === "staff") return supportCopy.roles.staff;
  return supportCopy.roles.assistant;
}

function formatGuestContent(content: string) {
  if (!content.startsWith(supportCopy.guestPrefix)) return content;
  return content
    .replace(supportCopy.guestPrefix, supportCopy.guestPrefixReplacement)
    .replace(/\nuser:/g, supportCopy.guestUserLabel)
    .replace(/\nassistant:/g, supportCopy.guestAssistantLabel);
}

const messageBubble =
  "mb-3.5 w-fit max-w-[95%] rounded-bl-2xl rounded-br-2xl rounded-tr-2xl rounded-tl-sm bg-white/5 px-4 py-3";
const userBubble =
  "mb-3.5 ml-auto w-fit max-w-[95%] rounded-bl-2xl rounded-br-2xl rounded-tl-2xl rounded-tr-sm bg-accent/10 px-4 py-3";
const roleSpan = "flex items-center gap-1 text-xs tracking-wider text-muted";
const iconButton =
  "inline-grid size-9 shrink-0 place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:text-foreground disabled:cursor-default disabled:opacity-40";

export function StudioSupport({ userId, onSignIn }: { userId: string | null; onSignIn: () => void }) {
  const [animatedMessage, setAnimatedMessage] = useState(-1);
  const [open, setOpen] = useState(false);
  const [guestMessages, setGuestMessages] = useState<Message[]>([]);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  const log = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const ticket = conversation && conversation.status !== "chat";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(
    async (action: "load" | "message" | "ticket", message = "", quiet = false) => {
      if (locked.current) return;
      if (!userId && action !== "message") return;
      locked.current = true;
      if (!quiet) {
        setBusy(true);
        setError("");
        setPendingMessage(message);
        setStreamedAnswer("");
      }
      try {
        let guestHistory: Message[] | undefined;
        if (userId && action === "ticket") {
          try {
            guestHistory = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null")?.history;
          } catch {
            /* Storage may be unavailable. */
          }
        }
        const endpoint = userId ? "studio-support" : "studio-support-public";
        const body = userId
          ? { action, message, guestHistory }
          : { action, message, history: boundedHistory(guestMessages) };
        let data;
        if (action === "message") {
          const { data: session } = await studioSupabase.auth.getSession();
          const response = await studioFetch(
            `https://xmxsqmxuiksldqhtugvv.supabase.co/functions/v1/${endpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: "sb_publishable_WUFwWg577SCT9xxbYY9i9g_fAUDsR0Q",
                ...(session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
              },
              body: JSON.stringify({ ...body, stream: true }),
            },
          );
          if (!response.ok) throw { context: response };
          if (!response.body) throw Error("empty_response");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            let end;
            while ((end = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, end).trim();
              buffer = buffer.slice(end + 1);
              if (!line.startsWith("data:")) continue;
              const event = JSON.parse(line.slice(5));
              if (event.type === "delta" && alive.current) setStreamedAnswer(event.answer);
              if (event.type === "done") data = event.data;
              if (event.type === "error") throw Error(event.error);
            }
            if (done) break;
          }
        } else {
          const result = await studioSupabase.functions.invoke(endpoint, { body });
          if (result.error) throw result.error;
          data = result.data;
        }
        if (!data || (userId ? !("conversation" in data) : typeof data.answer !== "string")) {
          throw new Error("invalid_response");
        }
        if (!alive.current) return;
        if (userId) {
          setAnimatedMessage(-1);
          setConversation(data.conversation);
          if (action === "ticket") {
            try {
              sessionStorage.removeItem(HANDOFF_KEY);
            } catch {
              /* Optional handoff storage. */
            }
          }
        } else {
          setAnimatedMessage(-1);
          setGuestMessages((current) => [
            ...current,
            { role: "user", content: message },
            { role: "assistant", content: data.answer },
          ]);
          setNeedsSignIn(data.requiresSignIn === true);
        }
        setLoaded(true);
        if (action !== "load") setDraft("");
      } catch (failure) {
        if (alive.current && !quiet) {
          const context = (failure as { context?: Response })?.context;
          setError(
            context?.status === 429 ? supportCopy.rateLimitError : supportCopy.genericError,
          );
        }
      } finally {
        locked.current = false;
        if (alive.current && !quiet) {
          setBusy(false);
          setPendingMessage("");
        }
      }
    },
    [userId, guestMessages],
  );

  useEffect(() => {
    if (!userId) return;
    const initial = window.setTimeout(async () => {
      await request("load", "", !open);
      let handoff = null;
      try {
        handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null");
      } catch {
        /* Optional storage. */
      }
      if (open && handoff?.ticket && alive.current) {
        await request("ticket", handoff.message || supportCopy.handoffDefault);
      }
    }, 0);
    const timer = window.setInterval(() => void request("load", "", true), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [open, userId, request]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(HANDOFF_KEY)) setOpen(true);
      } catch {
        /* Optional storage. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [conversation, guestMessages, pendingMessage, error, streamedAnswer]);

  useEffect(() => {
    if (open && (loaded || !userId)) input.current?.focus();
  }, [open, loaded, userId]);

  const unread = hasUnreadSupport(conversation);
  useEffect(() => {
    if (!open || !userId || !conversation?.id || !conversation.last_staff_at || !unread) return;
    const id = conversation.id;
    const seenAt = conversation.last_staff_at;
    void studioSupabase
      .rpc("studio_support_mark_seen", { p_id: id, p_seen_at: seenAt, p_staff: false })
      .then(({ error }) => {
        if (!error && alive.current) {
          setConversation((current) =>
            current?.id === id ? { ...current, customer_seen_at: seenAt } : current,
          );
        }
      });
  }, [open, userId, conversation?.id, conversation?.last_staff_at, unread]);

  function signInForHelp() {
    try {
      sessionStorage.setItem(
        HANDOFF_KEY,
        JSON.stringify({
          history: boundedHistory(guestMessages),
          message: draft.trim(),
          ticket: true,
        }),
      );
    } catch {
      /* Sign-in still works without storage. */
    }
    close();
    onSignIn();
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) void request("message", draft.trim());
  }

  return (
    <aside
      className="fixed right-4 bottom-4 z-50 text-sm text-foreground max-md:bottom-24"
      aria-label={supportCopy.ariaLabel}
    >
      {open && (
        <section
          className="mb-3 flex h-[min(38rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-surface shadow-2xl max-md:h-[min(36rem,calc(100dvh-14rem))]"
          id="studio-support-panel"
          aria-labelledby="studio-support-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-5">
            <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <Headphones size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 id="studio-support-title" className="m-0 text-base font-semibold leading-snug">
                {supportCopy.title}
              </h2>
              <p className="mt-0.5 mb-0 flex items-center gap-1.5 text-xs text-muted">
                <span className="size-1.5 rounded-full bg-accent" /> {supportCopy.subtitle}
              </p>
            </div>
            <button
              type="button"
              className={`${iconButton} ml-auto`}
              onClick={close}
              aria-label={supportCopy.close}
            >
              <X size={20} />
            </button>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [color-scheme:dark] [scrollbar-width:thin]"
            ref={log}
            role="log"
            aria-label={supportCopy.logLabel}
            aria-live="polite"
            aria-relevant="additions text"
          >
            <div className={messageBubble}>
              <span className={roleSpan}>{supportCopy.welcomeRole}</span>
              <p className="mt-1.5 m-0 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {supportCopy.welcomeGreeting}
              </p>
              <p className="mt-1.5 m-0 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {supportCopy.welcomeBody}
              </p>
            </div>

            {(userId ? supportTimeline(conversation) : guestMessages)?.map((message, index) => (
              <div
                className={message.role === "user" ? userBubble : messageBubble}
                key={index}
              >
                <span
                  className={[
                    roleSpan,
                    message.role === "user" || message.role === "staff" ? "text-accent" : "",
                  ].join(" ")}
                >
                  {roleLabel(message.role)}
                </span>
                <SupportAnswer
                  animate={message.role === "assistant" && index === animatedMessage}
                  onProgress={() => {
                    if (log.current) log.current.scrollTop = log.current.scrollHeight;
                  }}
                  content={formatGuestContent(message.content)}
                />
              </div>
            ))}

            {!userId && needsSignIn && (
              <div className="mb-3.5">
                <p className="m-0 leading-relaxed text-muted">{supportCopy.signInPrompt}</p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border-0 bg-accent px-3 py-3 text-accent-foreground disabled:cursor-default disabled:opacity-40"
                  onClick={signInForHelp}
                >
                  {supportCopy.signInButton}
                </button>
              </div>
            )}

            {pendingMessage && (
              <div className={userBubble}>
                <span className={`${roleSpan} text-accent`}>{supportCopy.roles.user}</span>
                <p className="mt-1.5 m-0 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {pendingMessage}
                </p>
              </div>
            )}

            {ticket && (
              <div className="my-4 flex gap-2.5 text-accent">
                <Ticket size={18} aria-hidden="true" />
                <div>
                  <strong className="text-sm">
                    {supportCopy.ticketTitle(
                      conversation.ticket_number,
                      conversation.status === "resolved"
                        ? supportCopy.ticketResolved
                        : supportCopy.ticketOpen,
                    )}
                  </strong>
                  <p className="mt-1 mb-0 leading-relaxed text-muted">{supportCopy.ticketBody}</p>
                </div>
              </div>
            )}

            {busy &&
              (pendingMessage ? (
                streamedAnswer ? (
                  <div className={messageBubble}>
                    <span className={roleSpan}>{supportCopy.roles.assistant}</span>
                    <p className="mt-1.5 m-0 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {streamedAnswer}
                      <span
                        className="ml-0.5 inline-block h-[1em] w-1 -translate-y-0.5 rounded-sm bg-accent align-[-0.1em]"
                        aria-hidden="true"
                      />
                    </p>
                  </div>
                ) : (
                  <SupportSkeleton />
                )
              ) : (
                <p className="m-0 flex items-center gap-2 text-muted">
                  <LoaderCircle size={15} className="animate-spin" /> {supportCopy.connecting}
                </p>
              ))}

            {error && (
              <div className="leading-relaxed text-accent-soft" role="alert">
                <p className="m-0">{error}</p>
                {userId && !loaded && (
                  <button
                    type="button"
                    disabled={busy}
                    className="border-0 bg-transparent text-inherit underline disabled:opacity-40"
                    onClick={() => void request("load")}
                  >
                    {supportCopy.tryAgain}
                  </button>
                )}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 px-3.5 pb-3">
            <div className="flex items-center justify-between gap-2 py-1">
              <button
                type="button"
                disabled={busy || (!!userId && !loaded)}
                className="flex items-center gap-1.5 border-0 bg-transparent py-2 text-muted disabled:cursor-default disabled:opacity-40"
                onClick={() => (userId ? void request("ticket", draft.trim()) : signInForHelp())}
              >
                <Ticket size={15} />
                {ticket ? supportCopy.stillNeedHelp : supportCopy.openTicket}
              </button>
              {userId && (
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy}
                  aria-label={supportCopy.refreshReplies}
                  onClick={() => void request("load")}
                >
                  <RefreshCw size={15} />
                </button>
              )}
            </div>
            <form
              className="flex items-end gap-2 rounded-xl border border-white/15 bg-canvas p-2.5"
              onSubmit={send}
            >
              <textarea
                ref={input}
                aria-label={supportCopy.messageLabel}
                placeholder={supportCopy.placeholder}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={2}
                disabled={busy || (!!userId && !loaded)}
                className="min-w-0 w-full resize-none border-0 bg-transparent text-base leading-normal text-foreground outline-none placeholder:text-subtle disabled:opacity-40 focus-visible:outline-none"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (draft.trim()) void request("message", draft.trim());
                  }
                }}
              />
              <button
                type="submit"
                aria-label={supportCopy.sendLabel}
                disabled={busy || (!!userId && !loaded) || !draft.trim()}
                className="grid size-8 shrink-0 place-items-center rounded-lg border-0 bg-accent text-accent-foreground disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ArrowUp size={19} />
              </button>
            </form>
            <p className="mt-2 mb-0 text-center text-xs leading-snug text-muted">
              {supportCopy.footerNote}
            </p>
          </footer>
        </section>
      )}

      <button
        ref={trigger}
        className="ml-auto flex min-h-12 items-center gap-2.5 rounded-full border border-accent bg-accent px-5 font-semibold text-accent-foreground shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        type="button"
        aria-expanded={open}
        aria-controls="studio-support-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Headphones size={20} aria-hidden="true" />
        <span>{unread ? supportCopy.launcherUnread : supportCopy.launcher}</span>
        {unread && (
          <i className="size-1.5 rounded-full bg-canvas" aria-label={supportCopy.unreadAria} />
        )}
        {!unread && ticket && conversation.status === "open" && (
          <i className="size-1.5 rounded-full bg-canvas" aria-label={supportCopy.openTicketAria} />
        )}
      </button>
    </aside>
  );
}
