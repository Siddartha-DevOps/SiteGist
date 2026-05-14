import { ArrowRight, History, Calendar, CheckCircle2, Star, Sparkles } from "lucide-react";
import React from 'react';

export default function Changelog() {
  const updates = [
    {
      date: "May 2026",
      weeks: [
        {
          week: "Week 19",
          title: "New Dashboard UI & Docs",
          new: ["Redesigned Dashboard for better accessibility", "Launched comprehensive documentation center"],
          improvements: ["Faster embedding indexing", "Improved chatbot response latency"],
          fixes: ["Fixed a bug with billing redirects"]
        }
      ]
    },
    {
      date: "April 2026",
      weeks: [
        {
          week: "Week 16",
          title: "Advanced Integrations",
          new: ["Zendesk & Salesforce integrations", "Custom webhook triggers"],
          improvements: ["Enhanced RAG retrieval strategy", "Better lead qualification flows"],
          fixes: ["Resolved mobile menu layout issues"]
        }
      ]
    }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex items-center gap-2 text-brand-dark font-black text-sm uppercase tracking-widest">
        <span>Updates</span>
        <ArrowRight className="w-3 h-3" />
        <span className="text-brand-gray">Changelog</span>
      </div>

      <h1 className="text-4xl lg:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">
        Changelog
      </h1>

      <p className="text-xl text-brand-gray font-medium leading-relaxed mb-10">
        Complete history of SiteGist updates since March 2026
      </p>

      <div className="bg-brand-light border border-brand-border rounded-2xl p-6 mb-16 flex items-start gap-4">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-bold text-brand-dark mb-1">Documentation Index</h4>
          <p className="text-sm text-brand-gray leading-relaxed">
            Fetch the complete documentation index at: <code className="bg-white px-2 py-0.5 rounded border border-brand-border text-primary font-bold">https://sitegist.co/docs/llms.txt</code>
          </p>
        </div>
      </div>

      <p className="text-lg leading-relaxed text-brand-dark/80 mb-12">
        Welcome to the SiteGist changelog. This page provides a comprehensive week-by-week breakdown of all updates, new features, improvements, and bug fixes since the product’s launch.
      </p>

      <div className="space-y-12 pb-20">
        {updates.map((month) => (
          <div key={month.date}>
            <div className="sticky top-20 bg-white/80 backdrop-blur-sm py-4 z-10 border-b border-brand-border mb-8">
              <h2 className="text-2xl font-black text-brand-dark flex items-center gap-3">
                <Calendar className="w-6 h-6 text-primary" /> {month.date}
              </h2>
            </div>

            <div className="space-y-12">
              {month.weeks.map((week) => (
                <div key={week.week} className="relative pl-8 border-l-2 border-brand-light">
                  <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm"></div>
                  
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-brand-light text-primary rounded-full text-xs font-black mb-2">
                      {week.week}
                    </span>
                    <h3 className="text-xl font-bold text-brand-dark">{week.title}</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                        <Star className="w-3 h-3" /> New features
                      </h4>
                      <ul className="space-y-2">
                        {week.new.map(item => (
                          <li key={item} className="text-sm text-brand-gray font-medium flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-brand-online uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Improvements
                      </h4>
                      <ul className="space-y-2">
                        {week.improvements.map(item => (
                          <li key={item} className="text-sm text-brand-gray font-medium flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-brand-online rounded-full mt-1.5 shrink-0" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" /> Bug fixes
                      </h4>
                      <ul className="space-y-2">
                        {week.fixes.map(item => (
                          <li key={item} className="text-sm text-brand-gray font-medium flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full mt-1.5 shrink-0" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
