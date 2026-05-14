import React from 'react';
import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { FileText, Clock, Mail, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Terms() {
  const lastUpdated = "May 6, 2026";

  const Sections = [
    {
      title: "1. Introduction",
      content: `Welcome to SiteGist, operated by SiteGist AI Technologies Inc ("Company", “us”, “we”, or “our”)! These Terms of Service (“Terms”, “Terms of Service”) govern your use of our web pages located at sitegist.co operated by SiteGist. Our Privacy Policy also governs your use of our Service and explains how we collect, safeguard and disclose information that results from your use of our web pages. Your agreement with us includes these Terms and our Privacy Policy (“Agreements”). You acknowledge that you have read and understood Agreements, and agree to be bound of them.`
    },
    {
      title: "2. Communications",
      content: "By creating an Account on our Service, you agree to subscribe to newsletters, marketing or promotional materials and other information we may send. However, you may opt out of receiving any, or all, of these communications from us by following the unsubscribe link or by emailing at support@sitegist.co."
    },
    {
      title: "3. Purchases",
      content: "If you wish to purchase any product or service made available through Service (“Purchase”), you may be asked to supply certain information relevant to your Purchase including, without limitation, your credit card number, the expiration date of your credit card, your billing address, and your shipping information. You represent and warrant that: (i) you have the legal right to use any credit card(s) or other payment method(s) in connection with any Purchase; and that (ii) the information you supply to us is true, correct and complete."
    },
    {
      title: "4. Subscriptions",
      content: "Some parts of Service are billed on a subscription basis (“Subscription(s)”). You will be billed in advance on a recurring and periodic basis (“Billing Cycle”). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select. At the end of each Billing Cycle, your Subscription will automatically renew under the exact same conditions unless you cancel it or SiteGist cancels it."
    },
    {
      title: "5. Fair Usage Policy (FUP)",
      content: "SiteGist is committed to providing high-quality, reliable service for all users. We expect all our users to avoid misuse or overuse of our services. Overuse by one user may impact the quality of service for others. Users are encouraged to select plans that align with their professional needs and business size. High-usage users should consider upgrading to a more robust plan, requesting a custom plan, or utilizing our business API."
    },
    {
      title: "6. Prohibited Uses",
      content: "You may use Service only for lawful purposes and in accordance with Terms. You agree not to use Service in any way that violates any applicable national or international law or regulation, or for the purpose of exploiting, harming, or attempting to exploit or harm minors in any way."
    }
  ];

  return (
    <div className="bg-white min-h-screen font-sans">
      <Header />
      
      <main className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-16 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-dark/5 border border-brand-border text-brand-dark text-[11px] font-black uppercase tracking-[0.2em] mb-8"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
              Legal Documents
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-brand-dark mb-6 tracking-tight">Terms and Conditions</h1>
            <p className="text-brand-gray font-medium text-lg max-w-2xl mx-auto leading-relaxed">
              By continuing to use our platform, you agree to these terms and conditions. These terms govern your professional relationship with SiteGist.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Table of Contents / Meta */}
            <div className="md:col-span-1 space-y-8">
              <div className="p-6 bg-[#F8F9FA] rounded-[32px] border border-brand-border">
                <div className="flex items-center gap-2 text-brand-dark font-black text-xs uppercase tracking-widest mb-6">
                  <Clock className="w-4 h-4 text-primary" />
                  Last Updated
                </div>
                <p className="text-xl font-black text-brand-dark">{lastUpdated}</p>
              </div>

              <div className="p-6 bg-brand-dark text-white rounded-[32px]">
                <Mail className="w-6 h-6 text-brand-accent mb-4" />
                <p className="text-xs font-black uppercase tracking-widest mb-2 text-white/40">Questions?</p>
                <p className="text-sm font-medium mb-4 leading-relaxed">Need clarification on our terms?</p>
                <a href="mailto:support@sitegist.co" className="text-brand-accent font-black hover:underline">support@sitegist.co</a>
              </div>
            </div>

            {/* Content */}
            <div className="md:col-span-3 space-y-12">
              <div className="prose prose-brand max-w-none">
                {Sections.map((section, idx) => (
                  <motion.div 
                    key={section.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="mb-12 group"
                  >
                    <h2 className="text-2xl font-black text-brand-dark mb-4 tracking-tight flex items-center gap-4">
                      <span className="text-primary/20 text-4xl font-black font-mono leading-none tracking-tighter tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {section.title}
                    </h2>
                    <p className="text-brand-gray text-base leading-[1.8] font-medium pl-1 gap-4">
                      {section.content}
                    </p>
                  </motion.div>
                ))}

                <div className="bg-brand-light/20 p-8 rounded-[40px] border border-brand-border mt-16 leading-relaxed">
                  <h3 className="text-xl font-black text-brand-dark mb-4">Contact Us</h3>
                  <p className="text-brand-gray font-medium mb-0">
                    If you have any questions about these Terms, please contact us at support@sitegist.co. Our team typically responds within 24 business hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
