import { ArrowRight, Code, Key, Globe, Terminal, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import React, { useState } from 'react';

export default function ApiReference() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex items-center gap-2 text-brand-dark font-black text-sm uppercase tracking-widest">
        <span>API Documentation</span>
        <ArrowRight className="w-3 h-3" />
        <span className="text-brand-gray">Getting started</span>
      </div>

      <h1 className="text-4xl lg:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">
        Getting started with the SiteGist API
      </h1>

      <p className="text-xl text-brand-gray font-medium leading-relaxed mb-10">
        Learn how to authenticate and make requests to the SiteGist API.
      </p>

      <div className="bg-brand-light border border-brand-border rounded-2xl p-6 mb-16 flex items-start gap-4">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <Terminal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-bold text-brand-dark mb-1">Documentation Index</h4>
          <p className="text-sm text-brand-gray leading-relaxed">
            Fetch the complete documentation index at: <code className="bg-white px-2 py-0.5 rounded border border-brand-border text-primary font-bold">https://sitegist.co/docs/llms.txt</code>
          </p>
        </div>
      </div>

      <div className="prose prose-brand max-w-none">
        <p className="text-lg leading-relaxed text-brand-dark/80 mb-12">
          The SiteGist API allows you to programmatically manage chatbots, send messages, access conversation history, and configure settings. All endpoints use REST principles and return JSON responses.
        </p>

        <h2 className="text-2xl font-black text-brand-dark mb-8">Base URL</h2>
        <div className="bg-brand-dark text-white p-4 rounded-xl flex items-center justify-between group mb-12">
          <code className="font-mono text-sm">https://api.sitegist.co/v1</code>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Copy className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <h2 className="text-2xl font-black text-brand-dark mb-8">Authentication</h2>
        <p className="text-brand-gray font-medium mb-6">
          SiteGist uses API keys for authentication. Include your API key in the <code className="text-primary font-bold">Authorization</code> header of every request.
        </p>

        <div className="space-y-8 mb-16">
          <ApiStep number="1" title="Get your API key" description="Sign in to your SiteGist account, navigate to Profile > API Access, and copy your key." />
          <ApiStep number="2" title="Keep it secure" description="Store it securely. Anyone with your key can access and modify your chatbots." />
          <ApiStep number="3" title="Using your key" description="Include the key in the Authorization header with the Bearer scheme." />
        </div>

        <h3 className="text-lg font-black text-brand-dark mb-4">Example request</h3>
        <CodeBlock 
          title="cURL" 
          code={`curl https://api.sitegist.co/v1/chatbots \\
  -H "Authorization: Bearer YOUR_API_KEY"`} 
        />

        <h3 className="text-lg font-black text-brand-dark mt-12 mb-4">Response format</h3>
        <p className="text-brand-gray font-medium mb-6">All API responses use a consistent JSON structure:</p>
        
        <CodeBlock 
          title="Success Response" 
          code={`{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "project_id": "proj_12345",
    "name": "Customer Support Bot"
  }
}`} 
        />

        <div className="mt-16 p-8 bg-brand-light rounded-[32px] border border-brand-border">
          <h3 className="text-2xl font-black mb-4 text-brand-dark">API Resources</h3>
          <p className="text-brand-gray font-medium mb-8">The SiteGist API provides endpoints for:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
            {[ "Chatbots", "Appearance", "Content", "Messages", "Threads", "Settings", "Prompts", "Webhooks" ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm font-bold text-brand-dark">
                <CheckCircle2 className="w-4 h-4 text-brand-online" /> {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiStep({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-8 h-8 rounded-full bg-brand-light text-primary flex items-center justify-center text-sm font-black shrink-0 border border-primary/20">
        {number}
      </div>
      <div>
        <h4 className="font-bold text-brand-dark text-lg mb-1">{title}</h4>
        <p className="text-brand-gray font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string, code: string }) {
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
        <pre className="text-white/90 text-sm font-mono leading-relaxed overflow-x-auto">
          {code}
        </pre>
      </div>
    </div>
  );
}
