import React from 'react';
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { Mail, MessageSquare, Send, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { ChatWidget } from "~/frontend/components/ChatWidget";

export default function ContactUs() {
  return (
    <div className="bg-white min-h-screen font-sans">
      <Header />
      
      <main className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/5 border border-brand-accent/20 text-brand-accent text-[11px] font-black uppercase tracking-[0.2em] mb-8"
            >
              <MessageSquare className="w-4 h-4" />
              Direct Support
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-brand-dark mb-6 tracking-tight">Contact Us</h1>
            <p className="text-brand-gray font-medium text-lg max-w-2xl mx-auto leading-relaxed">
              You can contact us at any time you like. We will get back to you as soon as possible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-20">
            {/* Contact Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-10 rounded-[40px] bg-brand-dark text-white shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
              
              <div className="relative z-10">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-10">
                  <Mail className="w-7 h-7 text-brand-accent" />
                </div>
                
                <h2 className="text-3xl font-black mb-4">Email</h2>
                <p className="text-white/60 font-medium leading-[1.8] mb-10 text-pretty">
                  You can contact <span className="text-white font-black">Siddartha Reddy</span>, the founder of SiteGist, directly via email. You will get a response as soon as possible.
                </p>
                
                <a 
                  href="mailto:support@sitegist.co" 
                  className="inline-flex items-center gap-3 text-xl font-black text-brand-accent hover:gap-5 transition-all"
                >
                  support@sitegist.co
                  <Send className="w-5 h-5" />
                </a>
              </div>
            </motion.div>

            {/* Quick Info Cards */}
            <div className="space-y-6">
              <div className="p-8 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-black text-brand-dark">Headquarters</h3>
                </div>
                <p className="text-brand-gray font-medium text-sm leading-relaxed">
                  Decentralized Team<br />
                  Supporting global customers 24/7.
                </p>
              </div>

              <div className="p-8 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-2 bg-brand-online/10 rounded-lg">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-brand-online rounded-full animate-pulse transition-all"></div>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-brand-dark">Live Status</h3>
                </div>
                <p className="text-brand-gray font-medium text-sm leading-relaxed">
                  Support queue is currently <span className="text-brand-online font-black">Active</span>.<br />
                  Expected response time: &lt; 12 hours.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center p-12 border-t border-brand-border">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gray/40 mb-2">Technical Queries</p>
            <p className="text-brand-gray font-medium">Looking for API documentation? <a href="/docs" className="text-primary font-black hover:underline">Read our Docs</a></p>
          </div>
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
