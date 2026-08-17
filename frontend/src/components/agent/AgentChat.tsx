import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  User as UserIcon,
  Sparkles,
  Download,
  Check,
  Copy,
  Plus,
  FileText,
  X,
  ArrowRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "@/components/ui/input";
import type { Paper } from "@/lib/mock-data";
import { buildAgentReply, AGENT_TASKS } from "@/lib/agent";
import { downloadText, slugify, stamp } from "@/lib/download";
import { AgentSteps } from "@/components/agent/AgentSteps";
import {
  answerSteps,
  detectIntent,
  type Artifact,
  type PlanStep,
} from "@/lib/agent-plan";

export type ChatTool = { id: string; label: string; icon?: typeof FileText };

export type Execution = {
  steps: PlanStep[];
  finish: () => { text: string; artifact?: Artifact } | Promise<{ text: string; artifact?: Artifact }>;
  /** Sprint 7: mark this run as backend-driven. When true, AgentSteps shows
   *  real progress (via onProgress below) instead of animating on a timer. */
  live?: boolean;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  prompt?: string;
  steps?: PlanStep[];
  artifact?: Artifact;
  tag?: string;
};

export function AgentChat({
  papers,
  scope,
  title = "Research Agent",
  subtitle,
  className,
  suggestions = [...AGENT_TASKS],
  seedMessage,
  tools = [],
  execute,
  renderArtifact,
}: {
  papers: Paper[];
  scope: string;
  title?: string;
  subtitle?: string;
  className?: string;
  suggestions?: string[];
  seedMessage?: string;
  tools?: ChatTool[];
  execute?: (
    text: string,
    toolId: string | null,
    onProgress: (index: number) => void,
  ) => Execution | null;
  renderArtifact?: (a: Artifact) => React.ReactNode;
}) {
  const [messages, setMessages] = useState<Msg[]>(() =>
    seedMessage ? [{ id: crypto.randomUUID(), role: "assistant", text: seedMessage }] : [],
  );
  const [input, setInput] = useState("");
  const [running, setRunning] = useState<{
    steps: PlanStep[];
    prompt: string;
    tag?: string;
    live?: boolean;
  } | null>(null);
  const [liveIndex, setLiveIndex] = useState(0);
  const finishRef = useRef<(() => { text: string; artifact?: Artifact } | Promise<{ text: string; artifact?: Artifact }>) | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [thinkingTooLong, setThinkingTooLong] = useState(false);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, running]);

  useEffect(() => {
    if (!running) inputRef.current?.focus();
  }, [running]);

  // 15s "still thinking" warning — only for live backend runs
  useEffect(() => {
    if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
    setThinkingTooLong(false);
    if (running?.live) {
      thinkingTimerRef.current = setTimeout(() => setThinkingTooLong(true), 15_000);
    }
    return () => {
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
    };
  }, [running]);

  const busy = running !== null;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    const toolId = activeTool?.id ?? null;
    const tag = activeTool?.label;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text, tag }]);
    setInput("");
    setMenuOpen(false);
    setActiveTool(null);

    setThinkingTooLong(false);
    setLiveIndex(0);
    const run: Execution =
      execute?.(text, toolId, setLiveIndex) ?? {
        steps: answerSteps(papers.length),
        finish: () => ({ text: buildAgentReply(text, papers, scope) }),
      };

    setRunning({ steps: run.steps, prompt: text, tag, live: run.live });

    if (run.live) {
      try {
        const result = (await run.finish()) ?? { text: "" };
        setRunning(null);
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: result.text,
            prompt: text,
            steps: run.steps,
            artifact: result.artifact,
          },
        ]);
      } catch (err: any) {
        setRunning(null);
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `⚠️ Agent execution error: ${err.message || "Failed to complete agent run."}`,
            prompt: text,
            steps: run.steps,
          },
        ]);
      }
    } else {
      finishRef.current = run.finish;
    }
  };

  const completeRun = async () => {
    const result = (await finishRef.current?.()) ?? { text: "" };
    const steps = running?.steps;
    const prompt = running?.prompt;
    finishRef.current = null;
    setRunning(null);
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.text,
        prompt,
        steps,
        artifact: result.artifact,
      },
    ]);
  };

  const exportTranscript = () => {
    const body = messages
      .map((m) => (m.role === "user" ? `\n---\n\n**You:** ${m.text}\n` : `\n${m.text}\n`))
      .join("\n");
    downloadText(
      `${slugify(scope)}-agent-session-${stamp()}.txt`,
      `# ${title} — ${scope}\n\n_${papers.length} papers · exported ${stamp()}_\n${body}`,
      "text/plain"
    );
  };

  return (
    <div
      className={`card-3d flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/90 backdrop-blur ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-b from-secondary/50 to-transparent px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {title}
            <Sparkles className="h-3 w-3 text-accent" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="live-dot" /> {subtitle ?? `Analyzing ${papers.length} papers in ${scope}`}
          </div>
        </div>
        {messages.some((m) => m.role === "user") && (
          <button
            onClick={exportTranscript}
            title="Download full session as Markdown"
            className="btn-pop rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-center text-xs text-muted-foreground">
            Pick a task below — the agent reasons across{" "}
            <span className="font-medium text-foreground">{papers.length}</span> papers in {scope}.
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} msg={m} scope={scope} renderArtifact={renderArtifact} />
        ))}
        {running && (
          <div className="flex gap-2">
            <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <AgentSteps
                steps={running.steps}
                onDone={completeRun}
                liveIndex={running.live ? liveIndex : undefined}
              />
              {thinkingTooLong && (
                <p className="mt-2 text-[11px] text-muted-foreground animate-pulse">
                  ⏳ Still thinking — Groq inference can take a moment on free tier…
                </p>
              )}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Agent tasks
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="btn-pop rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground/80 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3"
      >
        {activeTool && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent animate-in fade-in zoom-in-95">
            <FileText className="h-3 w-3" />
            {activeTool.label}
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="rounded-full p-0.5 hover:bg-accent/20"
              aria-label="Remove tag"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-2">
          {tools.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={busy}
                aria-label="Add tool"
                className="btn-pop grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-40"
              >
                <Plus className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-45" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute bottom-12 left-0 z-30 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-xl animate-in fade-in slide-in-from-bottom-1">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Tools
                  </div>
                  {tools.map((t) => {
                    const Icon = t.icon ?? FileText;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTool(t);
                          setMenuOpen(false);
                          inputRef.current?.focus();
                        }}
                        className="btn-pop flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1">{t.label}</span>
                        <ArrowRight className="h-3 w-3 opacity-50" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeTool ? `Describe the ${activeTool.label.toLowerCase()}…` : `Ask about ${scope}…`
              }
              className="h-10 pr-10 text-sm"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="btn-pop absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ChatBubble({
  msg,
  scope,
  renderArtifact,
}: {
  msg: Msg;
  scope: string;
  renderArtifact?: (a: Artifact) => React.ReactNode;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={`flex gap-2 ${isUser ? "justify-end" : ""} animate-in fade-in slide-in-from-bottom-1 duration-200`}
    >
      {!isUser && (
        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-3 w-3" />
        </div>
      )}
      <div className={`max-w-[88%] ${isUser ? "" : "min-w-0 flex-1"}`}>
        {msg.tag && isUser && (
          <div className="mb-1 flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              <FileText className="h-2.5 w-2.5" /> {msg.tag}
            </span>
          </div>
        )}
        {!isUser && msg.steps && <AgentSteps steps={msg.steps} collapsedSummary />}
        <div
          className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
            isUser
              ? "whitespace-pre-wrap bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
          }`}
        >
          {isUser ? (
            msg.text
          ) : (
            <div className="agent-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && msg.artifact && renderArtifact && (
          <div className="mt-2">{renderArtifact(msg.artifact)}</div>
        )}
        {!isUser && msg.prompt && (
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => {
                downloadText(`${slugify(msg.prompt!)}-${slugify(scope)}-${stamp()}.txt`, msg.text, "text/plain");
              }}
              className="btn-pop inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
            >
              <Download className="h-3 w-3" /> Download
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(msg.text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
              className="btn-pop inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-foreground">
          <UserIcon className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

export { detectIntent };
