import React from 'react';
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { ShieldCheck, Lock, Eye, Database, Mail, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function Privacy() {
  const lastUpdated = "May 6, 2026";

  const Sections = [
    {
      title: "1. Data Collection",
      icon: Eye,
      content: "We collect information you provide directly to us when you create an account, such as your name, email address, and company information. We also collect content provided for training your AI chatbots."
    },
    {
      title: "2. How We Use Data",
      icon: Database,
      content: "Data is used to provide, maintain, and improve our services, including training AI models specific to your domain. We process data to offer customized AI responses and lead generation features."
    },
    {
      title: "3. Data Sharing",
      icon: ShieldCheck,
      content: "We do not sell your personal data. We may share information with third-party vendors (like LLM providers or payment processors) only as necessary to provide the service under strict confidentiality agreements."
    },
    {
      title: "4. Security Measures",
      icon: Lock,
      content: "We implement robust technical and organizational measures to protect your data, including encryption at rest and in transit, continuous monitoring, and periodic security audits."
    }
  ];

  return (
    <div className="bg-white min-h-screen font-sans">
      <Header />
      
      <main className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-online/5 border border-brand-online/20 text-brand-online text-[11px] font-black uppercase tracking-[0.2em] mb-8"
            >
              <Lock className="w-4 h-4" />
              Privacy Priority
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-brand-dark mb-6 tracking-tight">Privacy Policy</h1>
            <p className="text-brand-gray font-medium text-lg max-w-2xl mx-auto leading-relaxed">
              We value your privacy and the security of your training data. This policy outlines how SiteGist handles and protects your information.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1 space-y-8">
              <div className="p-6 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <div className="flex items-center gap-2 text-brand-dark font-black text-xs uppercase tracking-widest mb-6">
                  <Clock className="w-4 h-4 text-primary" />
                  Last Updated
                </div>
                <p className="text-xl font-black text-brand-dark">{lastUpdated}</p>
              </div>
            </div>

            <div className="md:col-span-3 space-y-8">
              {Sections.map((section, idx) => (
                <motion.div 
                  key={section.title}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-8 bg-white border border-brand-border rounded-[32px] hover:border-primary transition-all group"
                >
                  <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <section.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-brand-dark mb-4">{section.title}</h3>
                  <p className="text-brand-gray font-medium leading-relaxed uppercase tracking-tight">
                    {section.content}
                  </p>
                </motion.div>
              ))}
              
              <div className="p-12 bg-brand-dark text-white rounded-[40px] text-center">
                <h3 className="text-2xl font-black mb-4">Privacy Concerns?</h3>
                <p className="text-white/60 mb-8 font-medium">Contact our Data Protection Officer for any specific queries.</p>
                <a href="mailto:privacy@sitegist.co" className="inline-flex items-center gap-2 px-8 py-4 bg-brand-accent text-white rounded-xl font-black hover:scale-105 transition-all">
                  <Mail className="w-5 h-5" />
                  Contact Privacy Team
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
