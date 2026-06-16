import type { MetaFunction } from "@remix-run/node";
import { Header } from "~/frontend/components/Header";

export const meta: MetaFunction = () => [
  { title: "Security — Enterprise-Grade AI Chatbot | SiteGist" },
  {
    name: "description",
    content:
      "SiteGist is built with security first. Data encryption in transit and at rest, SOC 2-aligned infrastructure, and strict access controls keep your customer data safe.",
  },
];
import { Footer } from "~/frontend/components/Footer";
import { CTAButton } from "~/frontend/components/CTAButton";
import { 
  Shield, 
  Lock, 
  Eye, 
  Server, 
  UserCheck, 
  Database,
  FileCheck,
  AlertCircle
} from "lucide-react";

export default function Security() {
  const securityFeatures = [
    {
      icon: <Lock className="w-8 h-8 text-primary" />,
      title: "Data Isolation",
      description: "Each project has its own encrypted vector namespace. Your data is never mixed with other customers' information."
    },
    {
      icon: <Eye className="w-8 h-8 text-primary" />,
      title: "Privacy by Design",
      description: "We don't use your data to train our own models. Your knowledge base is exclusively yours to use and control."
    },
    {
      icon: <Database className="w-8 h-8 text-primary" />,
      title: "Secure Storage",
      description: "Data is stored with AES-256 encryption at rest and TLS 1.3 encryption in transit."
    },
    {
      icon: <UserCheck className="w-8 h-8 text-primary" />,
      title: "SOC 2 Type II Compliance",
      description: "SiteGist is built on infrastructure that meets the highest industry standards for security and availability."
    },
    {
      icon: <Server className="w-8 h-8 text-primary" />,
      title: "Infrastructure",
      description: "Hosted on AWS and Cloudflare with multiple redundancy zones to ensure 99.9% uptime and zero data loss."
    },
    {
      icon: <FileCheck className="w-8 h-8 text-primary" />,
      title: "GDPR & CCPA",
      description: "Fully compliant with global data protection regulations. Users can request data deletion at any time."
    }
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-6 border border-brand-border">
            <Shield className="w-3 h-3 text-brand-online" />
            Security & Trust
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-6 tracking-tight">
             Your data is <span className="text-primary italic font-display">safe</span> with us.
          </h1>
          <p className="text-xl text-brand-gray max-w-2xl mx-auto font-medium">
            At SiteGist, security isn't just a feature—it's our foundation. We use enterprise-grade protocols to protect your proprietary knowledge.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-32">
          {securityFeatures.map((f, i) => (
            <div key={i} className="p-10 bg-brand-light/30 rounded-[40px] border border-brand-border hover:shadow-2xl hover:shadow-primary/5 transition-all group">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform">
                 {f.icon}
               </div>
               <h3 className="text-2xl font-bold text-brand-dark mb-4">{f.title}</h3>
               <p className="text-brand-gray font-medium leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Audit Section */}
        <div className="bg-brand-dark text-white rounded-[60px] p-16 md:p-24 relative overflow-hidden mb-32">
          <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
            <div>
               <h2 className="text-4xl md:text-5xl font-bold mb-8 font-display">Regular Audits & Penetration Testing</h2>
               <p className="text-lg text-brand-gray/80 font-medium mb-10 leading-relaxed">
                 We conduct monthly external penetration tests and regular internal audits to ensure our systems remain bulletproof against evolving threats.
               </p>
               <div className="flex gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Last Audit</p>
                    <p className="text-sm font-bold">April 2024</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Status</p>
                    <p className="text-sm font-bold text-brand-online">Certified Perfect</p>
                  </div>
               </div>
            </div>
            <div className="flex flex-col gap-6">
               <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 hover:border-brand-accent/50 transition-all">
                 <div className="flex items-center gap-4 mb-4">
                    <AlertCircle className="w-6 h-6 text-brand-accent" />
                    <h4 className="text-xl font-bold">Threat Monitoring</h4>
                 </div>
                 <p className="text-sm text-brand-gray/80 leading-relaxed font-medium">Real-time monitoring for SQL injection, XSS, and brute-force attacks across all end-points.</p>
               </div>
               <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 hover:border-brand-accent/50 transition-all">
                 <div className="flex items-center gap-4 mb-4">
                    <Eye className="w-6 h-6 text-brand-accent" />
                    <h4 className="text-xl font-bold">Access Logs</h4>
                 </div>
                 <p className="text-sm text-brand-gray/80 leading-relaxed font-medium">Full audit logs for every data access event, stored indelibly for compliance and security review.</p>
               </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        </div>

        {/* Contact/CTA */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-brand-dark mb-6">Have security questions?</h2>
          <p className="text-lg text-brand-gray font-medium mb-10">
            Our security team is happy to provide detailed documentation or participate in a security review for enterprise customers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <CTAButton to="/contact-us" className="px-12 py-5 rounded-2xl w-full sm:w-auto">Contact Security Team</CTAButton>
            <CTAButton to="/docs/security" variant="secondary" className="px-12 py-5 rounded-2xl w-full sm:w-auto border-none bg-brand-light">Read Whitepaper</CTAButton>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
