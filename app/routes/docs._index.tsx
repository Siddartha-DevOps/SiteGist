import { ArrowRight, Bot, Zap, Users, Globe, Link as LinkIcon, RefreshCw, Layers } from "lucide-react";
import { Link } from "@remix-run/react";
import React from 'react';

export default function DocsIndex() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex items-center gap-2 text-primary font-bold text-sm">
        <span>Getting started</span>
        <ArrowRight className="w-3 h-3" />
        <span className="text-brand-gray">Introduction to SiteGist</span>
      </div>

      <h1 className="text-4xl lg:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">
        Introduction to SiteGist
      </h1>

      <p className="text-xl text-brand-gray font-medium leading-relaxed mb-10">
        An AI-powered chatbot platform that transforms your website content into intelligent customer conversations.
      </p>

      <div className="bg-brand-light border border-brand-border rounded-2xl p-6 mb-12 flex items-start gap-4">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <BookOpenIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-bold text-brand-dark mb-1">Documentation Index</h4>
          <p className="text-sm text-brand-gray leading-relaxed">
            Fetch the complete documentation index at: <code className="bg-white px-2 py-0.5 rounded border border-brand-border text-primary font-bold select-all">https://sitegist.co/docs/llms.txt</code>
          </p>
        </div>
      </div>

      <div className="prose prose-brand max-w-none">
        <p className="text-lg leading-relaxed text-brand-dark/80 mb-12">
          SiteGist is an AI-powered chatbot platform that helps you automate customer support, capture leads, and engage visitors 24/7. Train your chatbot on your website content, documents, and knowledge base to provide instant, accurate responses to customer questions.
        </p>

        <h2 className="text-2xl font-black text-brand-dark mb-8">What SiteGist does</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <FeatureCard 
            icon={Zap} 
            title="Instant answers" 
            description="Answers customer questions instantly using your website, documentation, and knowledge base" 
          />
          <FeatureCard 
            icon={Users} 
            title="Lead capture" 
            description="Captures and qualifies leads with customizable forms and automated follow-ups" 
          />
          <FeatureCard 
            icon={Bot} 
            title="Human handoff" 
            description="Escalates to human agents when needed with seamless handoff" 
          />
          <FeatureCard 
            icon={Layers} 
            title="Integrations" 
            description="Integrates with your tools including Slack, Messenger, Zendesk, and more" 
          />
          <FeatureCard 
            icon={RefreshCw} 
            title="Auto-sync" 
            description="Syncs content automatically to keep your chatbot up to date" 
          />
          <FeatureCard 
            icon={Globe} 
            title="Multi-channel" 
            description="Deploy across website, messaging platforms, and third-party tools" 
          />
        </div>

        <h2 className="text-2xl font-black text-brand-dark mb-8">How it works</h2>
        <div className="space-y-6 mb-16">
          <Step 
            number="1" 
            title="Train your chatbot" 
            description="Add your website URLs, documents, or knowledge base content" 
          />
          <Step 
            number="2" 
            title="Customize the experience" 
            description="Configure your branding, personality, and conversation flows" 
          />
          <Step 
            number="3" 
            title="Deploy anywhere" 
            description="Launch on your website, in messaging apps, or through integrations" 
          />
          <Step 
            number="4" 
            title="Monitor and improve" 
            description="Track analytics, conversation history, and feedback" 
          />
        </div>

        <div className="p-8 bg-brand-dark rounded-[32px] text-white">
          <h3 className="text-2xl font-black mb-6">Next steps</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NextStepLink to="/create-chatbot" title="Create your first chatbot" description="Get started by creating and customizing your first chatbot" />
            <NextStepLink to="/#live-demo" title="Try the live demo" description="Experience SiteGist in action with our interactive demo" />
            <NextStepLink to="/integrations" title="View integrations" description="Connect SiteGist with your existing tools and platforms" />
            <NextStepLink to="/features" title="Explore use cases" description="See how businesses use SiteGist to solve real problems" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="group p-6 bg-white border border-brand-border rounded-2xl hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all">
      <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-brand-dark mb-2">{title}</h3>
      <p className="text-sm text-brand-gray leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-sm font-black shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-bold text-brand-dark text-lg mb-1">{title}</h4>
        <p className="text-brand-gray font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function NextStepLink({ to, title, description }: { to: string, title: string, description: string }) {
  return (
    <Link 
      to={to} 
      className="block p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-left"
    >
      <h4 className="font-bold text-white mb-1 flex items-center gap-2">
        {title} <ArrowRight className="w-3 h-3" />
      </h4>
      <p className="text-xs text-white/60 leading-relaxed font-medium">{description}</p>
    </Link>
  );
}
