/**
 * AIAssistantPage — Full AI Finance Assistant chat interface.
 *
 * Features:
 *  - Chat history persisted to DB, loaded on mount
 *  - Auto-scroll to latest message
 *  - Typing indicator while Ollama responds
 *  - Suggested prompts (click to send)
 *  - Inline markdown rendering (bold, bullets, code)
 *  - Copy response to clipboard
 *  - Clear conversation with confirmation
 *  - Mobile responsive layout
 *  - Error handling for Ollama unavailable / timeout
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  User,
} from 'lucide-react';
import { aiApi } from '@/api/ai';
import type { AssistantMessage } from '@/types/ai';
import { getApiError } from '@/api/client';

// ── Suggested prompts ──────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { icon: '💸', text: 'How much did I spend this month?' },
  { icon: '🍽️', text: 'How much did I spend on food?' },
  { icon: '🏆', text: 'Show my biggest expenses' },
  { icon: '🔁', text: 'Which subscriptions am I paying for?' },
  { icon: '🎯', text: 'What should I cut to save ₹5000?' },
  { icon: '💰', text: 'How much have I saved this year?' },
  { icon: '📊', text: 'Where am I overspending?' },
  { icon: '📅', text: 'Compare this month with last month' },
  { icon: '🔍', text: 'Show unusual transactions' },
  { icon: '📆', text: 'What are my recurring expenses?' },
];

// ── Inline Markdown renderer ───────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="fc-code-block">$1</pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="fc-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="text-white/80">$1</em>')
    // Headings (## H2)
    .replace(/^##\s+(.+)$/gm, '<p class="text-white font-bold text-base mt-3 mb-1">$1</p>')
    // Headings (# H1)
    .replace(/^#\s+(.+)$/gm, '<p class="text-white font-bold text-lg mt-3 mb-1">$1</p>')
    // Unordered list items
    .replace(/^[-•]\s+(.+)$/gm, '<li class="fc-md-li">$1</li>')
    // Wrap consecutive li elements
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="fc-md-ul">${m}</ul>`)
    // Numbered list items
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="fc-md-li">$1</li>')
    // Line breaks (double newline = paragraph break)
    .replace(/\n\n/g, '</p><p class="mb-2">')
    // Single newline
    .replace(/\n/g, '<br/>');
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="prose-finance"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 max-w-[85%]">
      <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-brand-400" strokeWidth={2} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface-card border border-surface-border">
        <div className="flex items-center gap-1 py-1">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isLatest,
}: {
  message: AssistantMessage;
  isLatest: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-end gap-2 max-w-[80%]">
          <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-brand-600/25 border border-brand-500/30 text-sm text-white leading-relaxed">
            {message.content}
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-card border border-surface-border flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-white/60" strokeWidth={2} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-3 max-w-[85%] group ${isLatest ? 'animate-fade-in' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-brand-400" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface-card border border-surface-border text-sm text-white/90 leading-relaxed">
          <MarkdownContent content={message.content} />
        </div>
        {/* Copy button — visible on hover */}
        <button
          onClick={handleCopy}
          className="mt-1 ml-1 flex items-center gap-1 text-xs text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Copy response"
        >
          {copied ? (
            <><Check className="w-3 h-3" /> Copied</>
          ) : (
            <><Copy className="w-3 h-3" /> Copy</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4 animate-fade-in">
      {/* Hero */}
      <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-5 shadow-glow">
        <Bot className="w-8 h-8 text-brand-300" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-white mb-2 text-center">
        Ask me about your finances
      </h2>
      <p className="text-sm text-white/50 text-center max-w-sm mb-8 leading-relaxed">
        I can analyse your spending, track goals, compare months, and give
        personalised insights — all using your real data.
      </p>

      {/* Suggested prompts grid */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Try asking
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED_PROMPTS.map(({ icon, text }) => (
            <button
              key={text}
              onClick={() => onPrompt(text)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-card border border-surface-border
                         text-left text-sm text-white/70 hover:text-white hover:border-brand-500/40
                         hover:bg-brand-600/10 transition-all duration-200 group"
            >
              <span className="text-base shrink-0">{icon}</span>
              <span className="flex-1 line-clamp-1">{text}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-brand-400 shrink-0 transition-colors duration-200" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Error banner ───────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-expense/10 border border-expense/30 text-sm text-expense animate-fade-in">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-expense/60 hover:text-expense transition-colors">✕</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AIAssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const history = await aiApi.getHistory();
        setMessages(history.messages);
        setConversationId(history.conversation_id);
      } catch {
        // History load failure is non-fatal — start fresh
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setInput('');

    // Optimistically add user message to UI
    const optimisticUser: AssistantMessage = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setIsLoading(true);

    try {
      const res = await aiApi.assistant({
        message: trimmed,
        conversation_id: conversationId,
      });

      setConversationId(res.conversation_id);

      // Replace optimistic + add real messages from server
      // (server persists the messages so we reload to get real IDs)
      const history = await aiApi.getHistory();
      setMessages(history.messages);
    } catch (err) {
      setError(getApiError(err) || 'Failed to get a response. Please try again.');
      // Remove optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setIsLoading(false);
      // Refocus textarea
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isLoading, conversationId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Clear conversation ──────────────────────────────────────────────────────
  const handleClear = async () => {
    try {
      await aiApi.clearHistory();
      setMessages([]);
      setShowClearConfirm(false);
      setError(null);
    } catch (err) {
      setError('Failed to clear conversation history.');
      setShowClearConfirm(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-48px)] max-h-[860px] min-h-[480px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shadow-glow">
            <Bot className="w-5 h-5 text-brand-300" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Finance Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-income animate-pulse" />
              <span className="text-xs text-white/40">Powered by Ollama · llama3.2:3b</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-600/15 text-brand-400 border border-brand-500/30">
            <Sparkles className="w-3 h-3" />
            AI
          </span>
          {hasMessages && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="fc-icon-btn"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Clear confirm ───────────────────────────────────────────────────── */}
      {showClearConfirm && (
        <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl bg-surface-card border border-surface-border text-sm animate-fade-in shrink-0">
          <span className="text-white/70 flex-1">Clear all conversation history?</span>
          <button
            onClick={handleClear}
            className="px-3 py-1 rounded-lg bg-expense/20 border border-expense/30 text-expense text-xs font-medium hover:bg-expense/30 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setShowClearConfirm(false)}
            className="px-3 py-1 rounded-lg bg-surface-input text-white/50 text-xs font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-3 shrink-0">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* ── Messages area ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-surface-card border border-surface-border min-h-0">
        {isHistoryLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-white/30">
              <div className="w-8 h-8 border-2 border-brand-500/40 border-t-brand-400 rounded-full animate-spin" />
              <span className="text-sm">Loading conversation…</span>
            </div>
          </div>
        ) : !hasMessages ? (
          <EmptyState onPrompt={(p) => sendMessage(p)} />
        ) : (
          <div className="flex flex-col gap-4 p-4 md:p-6">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Suggested prompts (compact, when chat is active) ─────────────────── */}
      {hasMessages && !isLoading && (
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1 shrink-0">
          {SUGGESTED_PROMPTS.slice(0, 5).map(({ icon, text }) => (
            <button
              key={text}
              onClick={() => sendMessage(text)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-card border border-surface-border
                         text-xs text-white/50 hover:text-white hover:border-brand-500/40 whitespace-nowrap
                         transition-all duration-200 shrink-0"
            >
              <span>{icon}</span>
              <span>{text}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="mt-3 shrink-0">
        <div className="flex items-end gap-3 p-3 rounded-2xl bg-surface-card border border-surface-border focus-within:border-brand-500/50 transition-colors duration-200">
          <textarea
            ref={textareaRef}
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your spending, goals, portfolio…"
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none
                       py-1 leading-relaxed disabled:opacity-50 max-h-40"
            aria-label="Message input"
          />
          <button
            id="assistant-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-95
                       flex items-center justify-center shrink-0
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                       transition-all duration-200 shadow-glow"
            title="Send (Enter)"
            aria-label="Send message"
          >
            {isLoading ? (
              <RotateCcw className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-white/20 mt-2">
          Press Enter to send · Shift+Enter for new line · Answers use only your real data
        </p>
      </div>
    </div>
  );
}
