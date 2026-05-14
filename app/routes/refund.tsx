import React from 'react';
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { CreditCard, RefreshCcw, ShieldCheck, Mail, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function Refund() {
  const lastUpdated = "May 6, 2026";

  return (
    <div className="bg-white min-h-screen font-sans">
      <Header />
      
      <main className="pt-40 pb-24 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto">
          <div className="mb-20 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-primary text-[11px] font-black uppercase tracking-[0.2em] mb-8"
            >
              <CreditCard className="w-4 h-4" />
              Billing Transparency
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-brand-dark mb-6 tracking-tight">Refund Policy</h1>
            <p className="text-brand-gray font-medium text-lg max-w-2xl mx-auto leading-relaxed">
              We aim for 100% satisfaction. If SiteGist doesn't meet your expectations, we're here to help.
            </p>
          </div>

          <div className="space-y-12 mb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <RefreshCcw className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-xl font-black text-brand-dark mb-4">7-Day Money Back</h3>
                <p className="text-brand-gray font-medium leading-relaxed">
                  We offer a full refund within the first 7 days of your initial subscription if you find that our platform doesn't suit your business needs.
                </p>
              </div>
              <div className="p-8 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <ShieldCheck className="w-10 h-10 text-brand-online mb-6" />
                <h3 className="text-xl font-black text-brand-dark mb-4">Fair Usage First</h3>
                <p className="text-brand-gray font-medium leading-relaxed">
                  Refunds are subject to our Fair Usage Policy. Accounts with excessive message consumption or automated misuse may be ineligible.
                </p>
              </div>
            </div>

            <div className="prose prose-brand max-w-none text-brand-gray font-medium space-y-6">
              <h2 className="text-2xl font-black text-brand-dark tracking-tight">Standard Procedure</h2>
              <p>Refunds are processed to the original payment method used during purchase. It may take 5-10 business days for the credit to appear on your statement depending on your bank.</p>
              <p>To request a refund, please send an email to support@sitegist.co with your account details and the reason for your request. Our billing team reviewed every request personally.</p>
            </div>
          </div>

          <div className="p-12 rounded-[40px] bg-brand-dark text-white flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md text-center md:text-left">
              <h3 className="text-2xl font-black mb-2">Have Billing Questions?</h3>
              <p className="text-white/60 font-medium">Our support team is available 24/7 to discuss your subscription.</p>
            </div>
            <a href="mailto:support@sitegist.co" className="px-8 py-4 bg-brand-accent text-white rounded-xl font-black hover:scale-105 transition-all text-sm whitespace-nowrap">
              Contact Billing Support
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
