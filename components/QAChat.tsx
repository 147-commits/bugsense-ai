'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/Loading';
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
  'Why might this bug occur?',
  'What tests should be added?',
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bugReportId: bugId,
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          projectId: currentProject?.id,
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'An error occurred. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-violet/15 flex items-center justify-center">
          <Bot className="w-4 h-4 text-accent-violet" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">QA Assistant</h3>
          <p className="text-[10px] text-text-muted truncate max-w-[200px]">Discussing: {bugTitle}</p>
        </div>
        <Sparkles className="w-3.5 h-3.5 text-accent-amber ml-auto" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-accent-violet/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent-violet" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Ask me anything about this bug</p>
              <p className="text-xs text-text-muted mt-1">I can help analyze root causes, suggest tests, and more</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-bg-tertiary text-text-secondary border border-border hover:border-accent-violet/30 hover:text-text-primary transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div
              className={cn(
                'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                msg.role === 'user' ? 'bg-accent-blue/15' : 'bg-accent-violet/15'
              )}
            >
              {msg.role === 'user' ? (
                <User className="w-3.5 h-3.5 text-accent-blue" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-accent-violet" />
              )}
            </div>
            <div
              className={cn(
                'max-w-[80%] p-3 rounded-xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-accent-blue/10 text-text-primary'
                  : 'bg-bg-tertiary text-text-secondary'
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent-violet/15 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-accent-violet" />
            </div>
            <div className="p-3 rounded-xl bg-bg-tertiary">
              <Spinner size="sm" />
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
            className="input-field py-2.5 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="btn-primary px-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
