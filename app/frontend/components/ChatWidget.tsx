import * as React from "react";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { X, Send, Bot, MessageSquare, Sparkles, Copy, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { createChatSocket } from "../../lib/partykit.client";

/**
 * ActionButtons
 * Reusable component for message actions (copy, like, dislike).
 */
const ActionButtons = ({ text, id, reactions, handleCopy, handleReaction, copiedId }: { 
  text: string; 
  id: number | string; 
  reactions: Record<string | number, 'like' | 'dislike' | null>;
  handleCopy: (text: string, id: number | string) => void;
  handleReaction: (id: string | number, type: 'like' | 'dislike') => void;
  copiedId: number | string | null;
}) => {
  const reaction = reactions[id];
  
  return (
    <div className="absolute -bottom-4 right-4 flex items-center gap-0.5 p-1 bg-white border border-zinc-100 rounded-2xl shadow-lg transition-all duration-300 opacity-0 -translate-y-1 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:translate-y-0 group-hover/msg:pointer-events-auto z-20 hover:shadow-xl">
      <div className="relative">
        <button 
          onClick={() => handleCopy(text, id)}
          className={`p-2 rounded-xl transition-all ${copiedId === id ? 'text-green-500 bg-green-50' : 'text-zinc-400 hover:text-[#155DEE] hover:bg-[#155DEE]/5'} active:scale-90`}
          title="Copy"
        >
          {copiedId === id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <button 
        onClick={() => handleReaction(id, 'like')}
        className={`p-2 rounded-xl transition-all ${reaction === 'like' ? 'text-[#155DEE] bg-[#155DEE]/10' : 'text-zinc-400 hover:text-[#155DEE] hover:bg-[#155DEE]/5'} active:scale-90`}
        title="Like"
      >
        <ThumbsUp className={`w-3.5 h-3.5 ${reaction === 'like' ? 'fill-current' : ''}`} />
      </button>
      <button 
        onClick={() => handleReaction(id, 'dislike')}
        className={`p-2 rounded-xl transition-all ${reaction === 'dislike' ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50'} active:scale-90`}
        title="Dislike"
      >
        <ThumbsDown className={`w-3.5 h-3.5 ${reaction === 'dislike' ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
};

/**
 * ChatWidgetPanel
 * The main chat interface that slides into view.
 */
function ChatWidgetPanel({ onClose, suggestions: propSuggestions }: {
  onClose: () => void;
  suggestions?: string[];
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; timestamp?: Date; suggestions?: string[]; sources?: { source: string; title?: string; type?: string }[] }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [reactions, setReactions] = useState<Record<string | number, 'like' | 'dislike' | null>>({});
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [rateLimit, setRateLimit] = useState<{ remaining: number; window: string } | null>(null);

  const [mode, setMode] = useState<'ai' | 'human'>('ai');
  const [escalated, setEscalated] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [chatMode, setChatMode] = useState<'ai-only' | 'hybrid' | 'agent-only'>('ai-only');
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);

  useEffect(() => {
    if (!sessionId || (mode !== 'human' && chatMode !== 'agent-only')) return;
    const socket = createChatSocket(sessionId);
    if (!socket) return;
    
    const listener = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'message' && data.role === 'assistant') {
          // If agent replies, append to messages and stop the loader/typing indicator
          setMessages(prev => [...prev, { role: 'assistant', content: data.content, timestamp: new Date() }]);
          setIsTyping(false);
          setAgentJoined(true);
        } else if (data.type === 'escalated') {
          setEscalated(true);
          setMode('human');
          setResolved(false);
        } else if (data.type === 'resolved') {
          setResolved(true);
          setMode('ai');
          setEscalated(false);
          setAgentJoined(false);
        }
      } catch (err) {
        console.warn("[Widget PartyKit] Failed to parse websocket message:", err);
      }
    };
    
    socket.addEventListener('message', listener as any);
    return () => {
      try {
        socket.close();
      } catch (err) {}
    };
  }, [sessionId, mode, chatMode]);

  const handleEscalate = async () => {
    const activeSessionId = sessionId || "demo-session";
    if (!sessionId) {
      setSessionId("demo-session");
    }
    try {
      const res = await fetch("/api/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId, projectId: "demo-project" }),
      });
      if (res.ok) {
        setEscalated(true);
        setMode('human');
        setResolved(false);
        
        // Push a visual message confirming escalation to visitor
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "You are now connected to a human agent. They will review our history and respond shortly.", 
          timestamp: new Date() 
        }]);
      }
    } catch (err) {
      console.error("[Widget] Escalation fetch error:", err);
    }
  };

  const suggestedQuestions = (propSuggestions && propSuggestions.length > 0)
    ? propSuggestions
    : [
        "Can you tell me more about the AI-powered answers feature?",
        "What kind of tools can I integrate with SiteGist?",
        "How does the multi-channel deployment work?",
      ];

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReaction = (id: string | number, type: 'like' | 'dislike') => {
    setReactions(prev => ({
      ...prev,
      [id]: prev[id] === type ? null : type
    }));
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
    handleSend(question);
  };

  const getRelativeTime = (date?: Date) => {
    if (!date) return "just now";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    if (diff < 60000) return "just now";
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const el = document.getElementById("chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isTyping) return;

    // Clear suggestions from all previous messages on send
    setMessages((prev) => prev.map(m => m.suggestions ? { ...m, suggestions: undefined } : m));

    const userMessage = textToSend.trim();
    const now = new Date();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: now }]);
    setIsTyping(true);
    setShowSuggestions(false);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId: "demo-project",
          message: userMessage, 
          sessionId 
        }),
      });

      if (response.status === 429) {
        let limitMsg = "You've reached today's message limit. Please check back later.";
        try {
          const errData = await response.json();
          if (errData?.message) limitMsg = errData.message;
        } catch {}
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: limitMsg,
            timestamp: new Date()
          }
        ]);
        setIsTyping(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      if (!response.body) throw new Error("Response body is empty");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      // Add empty assistant message to start streaming into
      const assistantStartTime = new Date();
      setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: assistantStartTime }]);

      let currentEvent = "message";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          if (trimmedLine.startsWith("event: ")) {
            currentEvent = trimmedLine.slice(7).trim();
          } else if (trimmedLine.startsWith("data: ")) {
            try {
              const rawData = trimmedLine.slice(6);
              const data = JSON.parse(rawData);
              
              if (currentEvent === "session") {
                if (data.sessionId) setSessionId(data.sessionId);
                if (data.chatMode) setChatMode(data.chatMode);
              } else if (currentEvent === "ratelimit") {
                if (data.remaining !== undefined) {
                  setRateLimit({ remaining: data.remaining, window: data.window });
                }
              } else if (currentEvent === "agent-mode") {
                setIsAgentMode(true);
                setMode('human');
              } else if (currentEvent === "suggestions") {
                const chips = data as string[];
                setMessages((prev) => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].role === "assistant") {
                      updated[i] = { ...updated[i], suggestions: chips };
                      break;
                    }
                  }
                  return updated;
                });
              } else if (currentEvent === "metadata") {
                const { sources } = data;
                if (sources && Array.isArray(sources)) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    for (let i = updated.length - 1; i >= 0; i--) {
                      if (updated[i].role === "assistant") {
                        updated[i] = { ...updated[i], sources };
                        break;
                      }
                    }
                    return updated;
                  });
                }
              } else {
                if (data.content) {
                  const content = data.content;
                  if (content.toLowerCase().includes("[error]")) {
                    const errorMsg = content.replace(/\[ERROR\]/i, "").trim();
                    assistantMessage = `❌ Error: ${errorMsg}`;
                  } else {
                    assistantMessage += content;
                  }
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        content: assistantMessage,
                      };
                    }
                    return newMessages;
                  });
                }
              }
            } catch (e) {
              console.warn("Failed to parse SSE data line:", trimmedLine);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Connection Error: ${errorMsg}. Please check your internet or API keys.` },
      ]);
    } finally {
      setIsTyping(false);
      setShowSuggestions(true);
      // Clean up empty assistant bubble if stream returned no assistant text
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20, originX: 1, originY: 1 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-[420px] h-[720px] max-h-[90vh] bg-white rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.25)] border border-zinc-100 overflow-hidden flex flex-col mb-2 ring-1 ring-black/5"
    >
      {/* Header */}
      <div className="bg-white p-5 text-zinc-800 flex items-center justify-between border-b border-zinc-100 relative overflow-hidden group">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 flex items-center justify-center">
            <Logo size="sm" hideText />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-black flex items-center gap-1.5 bg-clip-text text-transparent bg-gradient-to-r from-[#155DEE] to-[#7C6EF0]">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
              ASK SiteGIST
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors relative z-10 text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div id="chat-messages" className="flex-1 overflow-y-auto p-5 space-y-6 bg-zinc-50/10">
        <div className="flex items-end gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-100 shadow-sm overflow-hidden p-1.5 mb-1">
            <Logo size="sm" hideText className="scale-75" />
          </div>
          <div className="flex flex-col max-w-[85%]">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none rounded-bl-none border border-zinc-100 text-[13px] font-medium text-zinc-900 shadow-sm leading-relaxed relative group/msg">
              <div className="text-zinc-900 space-y-2">
                <p>👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.</p>
                <p>Ask me about:</p>
                <p>
                  • AI-powered answers from your content<br/>
                  • Multi-channel deployment<br/>
                  • Lead capture with customizable forms<br/>
                  • Human agent handoff (Slack/Zendesk)<br/>
                  • Integrations (Zapier, Notion, etc)
                </p>
              </div>

              <ActionButtons 
                text={`👋 Hi, I’m the SiteGIST Assistant — built by SiteGIST itself.\nAsk me about:\n• AI-powered answers from your content\n• Multi-channel deployment\n• Lead capture with customizable forms\n• Human agent handoff (Slack/Zendesk)\n• Integrations (Zapier, Notion, etc)`} 
                id="welcome" 
                reactions={reactions}
                handleCopy={handleCopy}
                handleReaction={handleReaction}
                copiedId={copiedId}
              />
            </div>

            <span className="text-[9px] mt-1.5 ml-1 opacity-40 font-bold uppercase tracking-wider">
              just now
            </span>
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1.5 mb-1">
                <Logo size="sm" hideText className="scale-75" />
              </div>
            )}
            <div className={`flex flex-col max-w-[85%] relative group/msg`}>
              <div className={`p-4 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed whitespace-pre-wrap relative ${
                msg.role === "user" 
                  ? "bg-[#0A2D60] text-white rounded-tr-none" 
                  : "bg-white text-zinc-900 border border-zinc-200/50 rounded-tl-none rounded-bl-none"
              }`}>
                {msg.content ? (
                  <div className="prose prose-sm max-w-none text-[13px] font-medium leading-relaxed">
                    {msg.role === "assistant" ? (
                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#155DEE] hover:underline font-semibold"
                            />
                          ),
                          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 my-1 space-y-0.5" />,
                          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 my-1 space-y-0.5" />,
                          li: ({ node, ...props }) => <li {...props} className="my-0" />,
                          p: ({ node, ...props }) => <p {...props} className="my-1 last:mb-0 first:mt-0" />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                ) : (
                  <span className="flex gap-1 animate-pulse"><span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>.</span>
                )}
                
                {msg.role === "assistant" && msg.content && (
                  <ActionButtons text={msg.content} id={i} reactions={reactions} handleCopy={handleCopy} handleReaction={handleReaction} copiedId={copiedId} />
                )}
              </div>

              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 ml-2 flex flex-wrap gap-x-3 gap-y-1 items-center">
                  {msg.sources.map((s, idx) => {
                    const isUrl = s.source.startsWith('http');
                    let label = s.title || "";
                    if (!label) {
                      if (isUrl) {
                        try {
                          const urlObj = new URL(s.source);
                          label = urlObj.pathname && urlObj.pathname !== "/" ? urlObj.pathname : urlObj.hostname;
                        } catch {
                          label = s.source;
                        }
                      } else {
                        label = s.source.split('/').pop() || s.source;
                      }
                    }

                    return isUrl ? (
                      <a
                        key={idx}
                        href={s.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-500 hover:text-[#155DEE] hover:underline flex items-center gap-1 transition-all"
                      >
                        <span className="text-zinc-400">↗</span>
                        <span className="truncate max-w-[150px]">{label}</span>
                      </a>
                    ) : (
                      <span
                        key={idx}
                        className="text-[11px] text-zinc-500 flex items-center gap-1 select-none"
                      >
                        <span className="text-zinc-400">📄</span>
                        <span className="truncate max-w-[150px]">{label}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              <span className={`text-[9px] mt-1.5 opacity-40 font-bold uppercase tracking-wider ${msg.role === "user" ? "text-right mr-1" : "ml-1"}`}>
                {getRelativeTime(msg.timestamp)}
              </span>

              {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(suggestion)}
                      className="text-[12px] text-zinc-600 font-medium bg-zinc-50 hover:bg-[#155DEE]/5 hover:text-[#155DEE] border border-zinc-100 hover:border-[#155DEE]/20 px-3 py-1.5 rounded-xl transition-all text-left w-fit shadow-sm cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {showSuggestions && !isTyping && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <div className="flex flex-col gap-2 pl-11 pt-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(q)}
                className="text-[12px] text-zinc-600 font-medium bg-zinc-50 hover:bg-[#155DEE]/5 hover:text-[#155DEE] border border-zinc-100 hover:border-[#155DEE]/20 px-3 py-2 rounded-xl transition-all text-left w-fit shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {isTyping && messages[messages.length-1]?.role !== 'assistant' && (
          <div className="flex items-end gap-2 text-left">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 shadow-sm overflow-hidden p-1.5 mb-1">
              <Logo size="sm" hideText className="scale-75" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none rounded-bl-none border border-zinc-100 shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}

        {rateLimit && rateLimit.remaining <= 5 && (
          <p className="text-center text-[10px] text-zinc-400 font-bold tracking-wide uppercase py-1 mt-1 select-none">
            {rateLimit.remaining} message{rateLimit.remaining !== 1 ? 's' : ''} remaining {rateLimit.window === 'hour' ? 'this hour' : 'today'}
          </p>
        )}

        {chatMode === 'hybrid' && !escalated && (
          <button
            type="button"
            onClick={handleEscalate}
            className="text-xs text-zinc-400 hover:text-zinc-600 font-bold underline mx-auto block py-2 transition-colors cursor-pointer"
          >
            Talk to a human
          </button>
        )}
        {chatMode === 'agent-only' && !agentJoined && (
          <div className="text-center py-2 animate-pulse flex flex-col items-center justify-center gap-1">
            <span className="text-xs text-zinc-500 font-bold">
              You're in the queue. A live agent will respond shortly.
            </span>
          </div>
        )}
        {escalated && !resolved && (
          <div className="text-center py-2 animate-pulse flex flex-col items-center justify-center gap-1">
            <span className="text-xs text-amber-500 font-bold">
              Connected to a live agent • They'll respond shortly
            </span>
          </div>
        )}
        {resolved && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-2 text-center text-[11px] font-bold rounded-xl mt-2 animate-in fade-in">
            Chat resolved. Handed back to system.
          </div>
        )}
      </div>

      {/* Footer / Input */}
      <div className="p-4 bg-white border-t border-zinc-100">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 p-2 bg-zinc-50 border border-zinc-100 rounded-2xl focus-within:ring-2 focus-within:ring-[#155DEE]/10 focus-within:border-[#155DEE] transition-all"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping || (chatMode === 'agent-only' && !agentJoined)}
            placeholder={
              chatMode === 'agent-only' && !agentJoined
                ? 'Waiting for an agent...'
                : 'Type your message...'
            }
            className="flex-1 bg-transparent px-3 text-sm font-medium outline-none placeholder:text-zinc-400 text-zinc-800 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping || (chatMode === 'agent-only' && !agentJoined)}
            className="p-2.5 bg-white border border-zinc-100 text-zinc-400 rounded-xl shadow-sm hover:bg-zinc-50 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-center gap-1.5 mt-4 group cursor-default">
           <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">Powered by</span>
           <Logo size="sm" hideText className="scale-75 transition-all opacity-30 grayscale group-hover:opacity-100 group-hover:grayscale-0" />
           <span className="text-[10px] font-black uppercase tracking-tight -ml-1">
             <span className="text-zinc-800">Site</span><span className="text-[#155DEE]">Gist</span>
           </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * ChatWidgetLauncher
 * The floating button that triggers the panel.
 */
function ChatWidgetLauncher({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col items-end gap-2 group">
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-90 focus:outline-none ${
          isOpen ? "opacity-100" : "opacity-90 hover:opacity-100"
        }`}
      >
      <div className="relative p-2">
        <Logo 
          size="lg" 
          hideText 
          className={`transition-all duration-500 ${
            isOpen ? "scale-110 drop-shadow-2xl" : "drop-shadow-xl group-hover:drop-shadow-[0_10px_20px_rgba(108,92,231,0.4)]"
          }`} 
        />
        {!isOpen && (
          <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm pointer-events-none animate-pulse" />
        )}
      </div>
      </button>
    </div>
  );
}

/**
 * ChatWidget
 * The high-level component that manages state and layout.
 */
export function ChatWidget({ suggestions }: { suggestions?: string[] } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return (
    <div className="fixed bottom-4 right-6 z-[100] flex flex-col items-end opacity-0 pointer-events-none">
       {/* Placeholder to avoid hydration mismatch */}
    </div>
  );

  return (
    <div className="fixed bottom-4 right-6 z-[100] flex flex-col items-end" suppressHydrationWarning>
      <AnimatePresence mode="wait">
        {isOpen && <ChatWidgetPanel onClose={() => setIsOpen(false)} suggestions={suggestions} />}
      </AnimatePresence>
      <ChatWidgetLauncher isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  );
}
