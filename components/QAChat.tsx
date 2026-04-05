'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/hooks/useStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface QAChatProps {
  bugId: string;
  bugTitle: string;
  initialMessages?: Message[];
}

const quickQuestions = [
  'Why might this occur?',
  'What tests should I add?',
  'How to fix this?',
  'Estimate the impact',
];

export default function QAChat({ bugId, bugTitle, initialMessages = [] }: QAChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { currentProject } = useAppStore();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugReportId: bugId, message: text, history: messages.map((m) => ({ role: m.role, content: m.content })), projectId: currentProject?.id }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || 'Sorry, I could not generate a response.', createdAt: new Date().toISOString() }]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'An error occurred. Please try again.', createdAt: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel flex flex-col h-[460px]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2.5">
        <Bot className="w-4 h-4 text-text-muted" />
        <div>
          <h3 className="text-sm font-medium text-text-primary">QA Assistant</h3>
          <p className="text-[10px] text-text-muted truncate max-w-[200px]">{bugTitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-text-primary">Ask about this bug</p>
            <p className="text-xs text-text-muted">Root causes, testing strategy, fix approach</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickQuestions.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
            <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
              {msg.role === 'user' ? <User className="w-3 h-3 text-text-muted" /> : <Bot className="w-3 h-3 text-text-muted" />}
            </div>
            <div className={cn(
              'max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed',
              msg.role === 'user' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary'
            )}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center">
              <Bot className="w-3 h-3 text-text-muted" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-bg-tertiary">
              <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about this bug..."
            className="input-field py-2 text-sm"
            disabled={isLoading}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-lg bg-text-primary text-bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
