'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Chat.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Regulation {
  id: number | string;
  title: string;
  body: string;
}

interface ChatProps {
  isAuthenticated: boolean;
  regulations: Regulation[];
  loading: boolean;
  error: string | null;
}

export default function Chat({ isAuthenticated, regulations, loading, error }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [streamedContent, setStreamedContent] = useState('');
  const streamedContentRef = useRef('');

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `ようこそ！社内規定チャットアシスタントです。\n\n${regulations.length}件の社内規定にアクセスできます。\n\nお気軽にご質問ください。`,
        },
      ]);
    }
  }, [messages.length, regulations.length]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-clear streamed content when new user message is sent
  const handleSend = useCallback(async () => {
    if ((!input.trim()) || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setStreamedContent('');
    streamedContentRef.current = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          regulations: regulations,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content;
              if (content) {
                streamedContentRef.current += content;
                setStreamedContent(streamedContentRef.current);
              }
            } catch {
              // Skip non-JSON data
            }
          }
        }
      }

      // Add the streamed content as a final message
      const assistantMessage: Message = {
        role: 'assistant',
        content: streamedContentRef.current,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamedContent('');
      streamedContentRef.current = '';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Chat error:', errorMessage);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `エラーが発生しました: ${errorMessage}` },
      ]);
      setStreamedContent('');
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, regulations]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format message content with line breaks
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  };

  return (
    <div className="chat-container">
      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-message ${
              msg.role === 'user' ? 'user' : 'assistant'
            }`}
          >
            <div className="chat-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="chat-bubble">
              {msg.role === 'user' ? (
                <p>{msg.content}</p>
              ) : (
                <div>{renderContent(msg.content)}</div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {isStreaming && streamedContent && (
          <div className="chat-message assistant streaming">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble">
              <div>{renderContent(streamedContent)}</div>
              <span className="cursor">▌</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? '応答中...' : '質問を入力...'}
          disabled={isStreaming || !isAuthenticated}
          className="chat-input"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !isAuthenticated || !input.trim()}
          className="chat-send-button"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
