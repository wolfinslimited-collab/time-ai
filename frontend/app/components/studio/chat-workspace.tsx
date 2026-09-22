"use client";

import type { User } from "@supabase/supabase-js";
import {
  ChevronDown,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { displayName } from "./auth-dialog";
import { modelCatalog } from "../../lib/studio/model-catalog";
import type { ChatMessage, ChatThread } from "../../lib/studio/studio-types";

const chatModelName =
  modelCatalog.chat.find((model) => model.modelKey === "gpt-5-2")?.name ||
  modelCatalog.chat[0]?.name ||
  "GPT 5.2";

export function ChatWorkspace({
  busy,
  chatPrompt,
  chatSearch,
  messages,
  onNew,
  onPrompt,
  onSearch,
  onSelectThread,
  onSend,
  selectedThreadId,
  threads,
  user,
}: {
  busy: boolean;
  chatPrompt: string;
  chatSearch: string;
  messages: ChatMessage[];
  onNew: () => void;
  onPrompt: (value: string) => void;
  onSearch: (value: string) => void;
  onSelectThread: (id: string) => void;
  onSend: () => void;
  selectedThreadId: string | null;
  threads: ChatThread[];
  user: User | null;
}) {
  return (
    <section className="studio-chat-workspace">
      <aside className="studio-chat-history">
        <div>
          <strong>Conversations</strong>
          <button type="button" onClick={onNew}>
            <Plus size={15} /> New chat
          </button>
        </div>
        <label>
          <Search size={14} />
          <input value={chatSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Search conversations" />
        </label>
        <nav>
          {threads.map((thread) => (
            <button
              className={thread.id === selectedThreadId ? "is-active" : ""}
              type="button"
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
            >
              <MessageSquareText size={14} />
              <span>{thread.title}</span>
              <small>{new Date(thread.updated_at).toLocaleDateString()}</small>
            </button>
          ))}
        </nav>
      </aside>
      <div className="studio-chat-main">
        {!messages.length ? (
          <div className="studio-chat-empty">
            <span>
              <MessageSquareText size={21} />
            </span>
            <p>TIMELESS CHAT</p>
            <h1>What can we create together?</h1>
            <small>Plan a campaign, write a script, improve a prompt, or develop your next story with {chatModelName}.</small>
            <div>
              {[
                "Write a 30-second launch script",
                "Turn my idea into an image prompt",
                "Plan five creator posts",
                "Give this story a stronger opening",
              ].map((idea) => (
                <button key={idea} type="button" onClick={() => onPrompt(idea)}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="studio-chat-messages">
            {messages.map((message) => (
              <article className={`is-${message.role}`} key={message.id}>
                <span>
                  {message.role === "assistant" ? (
                    <Sparkles size={15} />
                  ) : user ? (
                    displayName(user).slice(0, 2).toUpperCase()
                  ) : (
                    "YOU"
                  )}
                </span>
                <div>
                  <p>{message.content}</p>
                  {message.role === "assistant" && (
                    <small>
                      {message.credits_charged} credit · {message.provider_tokens?.toLocaleString() || "—"} tokens
                    </small>
                  )}
                </div>
              </article>
            ))}
            {busy && (
              <article className="is-assistant is-thinking">
                <span>
                  <Sparkles size={15} />
                </span>
                <div>
                  <LoaderCircle size={17} /> Thinking with {chatModelName}…
                </div>
              </article>
            )}
          </div>
        )}
        <div className="studio-chat-composer">
          <textarea
            value={chatPrompt}
            onChange={(event) => onPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder="Message Timeless Chat…"
            rows={2}
          />
          <div>
            <button type="button" title="Attachments coming next">
              <Paperclip size={16} />
            </button>
            <button className="studio-chat-model" type="button">
              <WandSparkles size={14} /> {chatModelName} <ChevronDown size={12} />
            </button>
            <span>1 credit</span>
            <button className="studio-chat-send" type="button" onClick={onSend} disabled={busy || !chatPrompt.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
