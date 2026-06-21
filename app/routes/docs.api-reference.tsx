import { ArrowRight, Terminal, Copy, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";

const BASE_URL = "https://www.sitegist.co/api/v1";

export default function ApiReference() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex items-center gap-2 text-brand-dark font-black text-sm uppercase tracking-widest">
        <span>API Documentation</span>
        <ArrowRight className="w-3 h-3" />
        <span className="text-brand-gray">v1 Reference</span>
      </div>

      <h1 className="text-4xl lg:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">
        SiteGist API v1
      </h1>

      <p className="text-xl text-brand-gray font-medium leading-relaxed mb-10">
        Send messages to your chatbots, list bots, and read conversations programmatically. REST over HTTPS, JSON in and out.
      </p>

      <div className="prose prose-brand max-w-none">
        <h2 className="text-2xl font-black text-brand-dark mb-4">Base URL</h2>
        <CodeBlock title="Base URL" code={BASE_URL} />

        <h2 className="text-2xl font-black text-brand-dark mt-12 mb-4">Authentication</h2>
        <p className="text-brand-gray font-medium mb-6">
          Create a key in the dashboard under <strong>Profile → API keys</strong>, then send it as a Bearer token on every
          request. Keys look like <code className="text-primary font-bold">sk_live_…</code> — keep them secret.
        </p>
        <CodeBlock
          title="cURL"
          code={`curl ${BASE_URL}/chatbots \\
  -H "Authorization: Bearer sk_live_YOUR_KEY"`}
        />

        <div className="bg-brand-light border border-brand-border rounded-2xl p-6 my-10 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold text-brand-dark mb-1">Rate limits</h4>
            <p className="text-sm text-brand-gray leading-relaxed">
              120 requests/minute per API key. Exceeding it returns <code className="bg-white px-1.5 py-0.5 rounded border border-brand-border text-primary font-bold">429</code> with a <code className="bg-white px-1.5 py-0.5 rounded border border-brand-border text-primary font-bold">Retry-After</code> header.
            </p>
          </div>
        </div>

        {/* Endpoints */}
        <h2 className="text-2xl font-black text-brand-dark mt-12 mb-6">Endpoints</h2>

        <Endpoint method="POST" path="/chat" desc="Send a message and get the AI answer (also persists the conversation)." />
        <p className="text-sm font-bold text-brand-dark mt-4 mb-2">Request body</p>
        <CodeBlock
          title="JSON"
          code={`{
  "chatbotId": "proj_abc123",   // required — the chatbot/project id
  "message": "What are your pricing plans?", // required
  "sessionId": "sess_xyz"       // optional — continue an existing conversation
}`}
        />
        <p className="text-sm font-bold text-brand-dark mt-6 mb-2">Example</p>
        <CodeBlock
          title="cURL"
          code={`curl -X POST ${BASE_URL}/chat \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"chatbotId":"proj_abc123","message":"Hello"}'`}
        />
        <p className="text-sm font-bold text-brand-dark mt-6 mb-2">Response</p>
        <CodeBlock title="200 OK" code={`{
  "sessionId": "sess_xyz",
  "answer": "Our plans are Free, Pro ($19/mo) and Enterprise…"
}`} />

        <div className="mt-12" />
        <Endpoint method="GET" path="/chatbots" desc="List the chatbots owned by the API key." />
        <p className="text-sm font-bold text-brand-dark mt-4 mb-2">Response</p>
        <CodeBlock title="200 OK" code={`{
  "data": [
    { "id": "proj_abc123", "name": "Support Bot", "status": "ACTIVE", "createdAt": "2026-06-01T10:00:00.000Z" }
  ]
}`} />

        <div className="mt-12" />
        <Endpoint method="GET" path="/conversations?chatbotId=proj_abc123" desc="List recent conversations (latest 100). chatbotId is optional." />
        <p className="text-sm font-bold text-brand-dark mt-4 mb-2">Response</p>
        <CodeBlock title="200 OK" code={`{
  "data": [
    {
      "id": "sess_xyz",
      "chatbotId": "proj_abc123",
      "customerEmail": "jane@example.com",
      "status": "active",
      "mode": "ai",
      "messageCount": 6,
      "createdAt": "2026-06-20T09:00:00.000Z",
      "updatedAt": "2026-06-20T09:05:00.000Z"
    }
  ]
}`} />

        <h2 className="text-2xl font-black text-brand-dark mt-16 mb-4">Errors</h2>
        <p className="text-brand-gray font-medium mb-6">Errors return a JSON body with an <code className="text-primary font-bold">error</code> message and an appropriate status code.</p>
        <CodeBlock title="Error" code={`{ "error": "chatbotId and message are required." }`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 mt-6 text-sm">
          {[
            ["400", "Missing/invalid parameters"],
            ["401", "Missing, invalid, or revoked API key"],
            ["404", "Chatbot not found / not yours"],
            ["429", "Rate limit exceeded (see Retry-After)"],
            ["502", "Answer generation failed"],
          ].map(([code, meaning]) => (
            <div key={code} className="flex items-center gap-3 text-brand-dark">
              <code className="font-mono font-bold bg-brand-light px-2 py-0.5 rounded text-primary">{code}</code>
              <span className="text-brand-gray font-medium">{meaning}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === "GET" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100";
  return (
    <div className="rounded-2xl border border-brand-border p-5 bg-white">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${color}`}>{method}</span>
        <code className="font-mono text-sm font-bold text-brand-dark">{path}</code>
      </div>
      <p className="text-sm text-brand-gray font-medium mt-2">{desc}</p>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-2xl overflow-hidden border border-brand-border shadow-sm">
      <div className="bg-brand-bg px-4 py-2 border-b border-brand-border flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-brand-gray">{title}</span>
        <button onClick={copy} className="p-1.5 hover:bg-brand-border rounded-lg transition-colors">
          {copied ? <CheckCircle2 className="w-4 h-4 text-brand-online" /> : <Copy className="w-4 h-4 text-brand-gray" />}
        </button>
      </div>
      <div className="bg-brand-dark p-6">
        <pre className="text-white/90 text-sm font-mono leading-relaxed overflow-x-auto">{code}</pre>
      </div>
    </div>
  );
}
