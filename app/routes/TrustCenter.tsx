import React from 'react';
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { Shield, CheckCircle2, Lock, FileText, Users, Globe, ExternalLink, Zap, AlertCircle } from "lucide-react";
import { Logo } from "~/frontend/components/Logo";
import { motion } from "framer-motion";

export default function TrustCenter() {
  const policies = [
    { name: "Vendor & Third-Party Risk", description: "How we evaluate and manage security risks for all our partners." },
    { name: "Remote Access & BYOD", description: "Security protocols for employee hardware and remote network access." },
    { name: "Secure Configuration & Hardening", description: "Strict infrastructure setup standards to prevent unauthorized access." },
    { name: "Risk Management", description: "Continuous identification and mitigation of operational threats." },
    { name: "Vulnerability & Patch Management", description: "Rapid identification and fixing of software security issues." },
    { name: "Change & Release Management", description: "Strict procedures for every code deployment to ensure stability." },
    { name: "Policy Management & Exception Handling", description: "Governance and documentation of all security protocols." },
    { name: "Secure Software Development Lifecycle", description: "Security integrated into every step of our coding process." }
  ];

  const controls = [
    "Acceptable Use", "Access Rights", "Architecture Diagram", "Asset Inventory",
    "Change management", "Configuration & Patch Management", "Credential Management", "Data Privacy"
  ];

  const frameworks = [
    { name: "SOC 2 Type 2", status: "Active", color: "bg-blue-500" },
    { name: "GDPR", status: "Active", color: "bg-green-500" },
    { name: "HIPAA", status: "Active", color: "bg-purple-500" }
  ];

  return (
    <div className="bg-white min-h-screen font-sans">
      <Header />
      
      {/* Trust Center Hero */}
      <section className="pt-32 pb-20 px-6 bg-[#F8F9FA] border-b border-brand-border overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full translate-x-20 -translate-y-20"></div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Logo size="sm" />
              <div className="w-1.5 h-1.5 bg-brand-online rounded-full"></div>
              <span className="text-xs font-black text-brand-online uppercase tracking-widest">Verified Security</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-brand-dark mb-6 tracking-tight">SiteGist Trust Center</h1>
            <p className="text-lg text-brand-gray font-medium leading-relaxed mb-8">
              This Trust Center provides transparent visibility into SiteGist's security, compliance, governance, and trust documentation, giving your procurement and security teams everything they need in one place.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-xl shadow-sm">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-brand-dark">sitegist.co</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-online text-white rounded-xl shadow-lg shadow-brand-online/20">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wider">All Systems Active</span>
              </div>
            </div>
          </div>
          
          <div className="w-full max-w-sm">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-brand-dark/5 border border-brand-border flex flex-col items-center text-center">
              <Shield className="w-16 h-16 text-primary mb-6 animate-pulse" />
              <p className="text-sm font-black text-brand-gray uppercase tracking-widest mb-2">Security Rating</p>
              <p className="text-6xl font-black text-brand-dark mb-4">A+</p>
              <p className="text-[11px] text-brand-gray font-medium px-6">
                Continuous automated monitoring and third-party penetration testing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 border-b border-brand-border bg-white">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center group">
            <p className="text-4xl font-black text-brand-dark mb-1 group-hover:text-primary transition-colors">25</p>
            <p className="text-[11px] font-black text-brand-gray uppercase tracking-widest">Active Policies</p>
          </div>
          <div className="text-center group">
            <p className="text-4xl font-black text-brand-dark mb-1 group-hover:text-primary transition-colors">3</p>
            <p className="text-[11px] font-black text-brand-gray uppercase tracking-widest">Global Frameworks</p>
          </div>
          <div className="text-center group">
            <p className="text-4xl font-black text-brand-dark mb-1 group-hover:text-primary transition-colors">0</p>
            <p className="text-[11px] font-black text-brand-gray uppercase tracking-widest">Open Vulnerabilities</p>
          </div>
          <div className="text-center group">
            <p className="text-4xl font-black text-brand-dark mb-1 group-hover:text-primary transition-colors">24/7</p>
            <p className="text-[11px] font-black text-brand-gray uppercase tracking-widest">Active Monitoring</p>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            
            {/* Sidebar Navigation */}
            <div className="space-y-4">
              <div className="p-1.5 bg-[#F8F9FA] rounded-2xl border border-brand-border">
                {["Overview", "Security Controls", "Compliance", "Privacy", "Subprocessors"].map((item, idx) => (
                  <button 
                    key={item}
                    className={`w-full text-left px-5 py-3 rounded-xl text-sm font-black transition-all ${idx === 0 ? "bg-white text-primary shadow-sm" : "text-brand-gray hover:text-brand-dark"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              
              <div className="p-6 bg-brand-dark text-white rounded-[32px] overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[40px] rounded-full group-hover:bg-primary/40 transition-all"></div>
                <div className="relative z-10">
                  <Zap className="w-8 h-8 text-brand-accent mb-4" />
                  <h3 className="text-xl font-black mb-2">Request Access</h3>
                  <p className="text-white/60 text-sm font-medium mb-6 leading-relaxed">
                    Need the full SOC 2 report or our latest pentest? Request secure access below.
                  </p>
                  <button className="w-full py-4 bg-brand-accent text-white rounded-xl font-black hover:scale-105 transition-all text-sm">
                    Open Questionnaire
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content Areas */}
            <div className="md:col-span-2 space-y-24">
              
              {/* Compliance Section */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <CheckCircle2 className="w-6 h-6 text-brand-online" />
                  <h2 className="text-3xl font-black text-brand-dark tracking-tight">Compliance & Frameworks</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {frameworks.map((f) => (
                    <div key={f.name} className="p-6 bg-white border border-brand-border rounded-[32px] hover:border-primary transition-all group">
                      <div className={`w-3 h-3 ${f.color} rounded-full mb-6`}></div>
                      <h4 className="text-xl font-black text-brand-dark mb-1">{f.name}</h4>
                      <p className="text-[10px] font-black text-brand-gray/60 uppercase tracking-widest">{f.status}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policies Section */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                  <h2 className="text-3xl font-black text-brand-dark tracking-tight">Internal Policies</h2>
                </div>
                <p className="text-brand-gray font-medium mb-8">Governance rules that ensure cross-organization security consistency.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {policies.map((p) => (
                    <div key={p.name} className="p-6 bg-[#F8F9FA] rounded-[24px] border border-transparent hover:border-brand-border hover:bg-white transition-all group">
                      <h4 className="text-sm font-black text-brand-dark mb-2 flex items-center justify-between">
                        {p.name}
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                      </h4>
                      <p className="text-[11px] text-brand-gray leading-relaxed font-medium">
                        {p.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls Section */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-brand-accent" />
                  <h2 className="text-3xl font-black text-brand-dark tracking-tight">Security Controls</h2>
                </div>
                <p className="text-brand-gray font-medium mb-8">Safeguards continuously monitored across our infrastructure and processes.</p>
                
                <div className="flex flex-wrap gap-3">
                  {controls.map((c) => (
                    <div key={c} className="px-5 py-3 bg-white border border-brand-border rounded-full text-xs font-black text-brand-dark flex items-center gap-2 hover:border-brand-accent transition-all">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-online" />
                      {c}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Trust Footer */}
      <section className="py-20 px-6 bg-brand-light/20 border-t border-brand-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray/40 mb-6">Security First Philosophy</p>
          <h2 className="text-2xl font-black text-brand-dark mb-10 leading-relaxed">
            "Trust is built on transparency. We invite our customers to verify our systems at any time."
          </h2>
          <div className="flex items-center justify-center gap-4 grayscale opacity-50">
            <span className="text-sm font-black text-brand-dark tracking-tighter">Powered by Comp AI</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
