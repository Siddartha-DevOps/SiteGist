import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { CTAButton } from "~/frontend/components/CTAButton";
import { 
  Target, 
  Users, 
  Send, 
  PieChart, 
  CheckCircle2, 
  Bot,
  Mail,
  Smartphone,
  Layers,
  ArrowRight
} from "lucide-react";

export default function LeadGeneration() {
  const steps = [
    {
      title: "Active Qualification",
      description: "Instead of passive forms, our AI naturally qualifies visitors through conversation. It asks meaningful questions to understand intent and budget.",
      icon: <Users className="w-6 h-6" />
    },
    {
      title: "Contextual Extraction",
      description: "SiteGist automatically extracts names, emails, company details, and pain points directly from the natural flow of chat—no rigid forms required.",
      icon: <Layers className="w-6 h-6" />
    },
    {
      title: "Instant Routing",
      description: "Qualified leads are instantly sent to your email, Slack, or favorite CRM (HubSpot, Salesforce, Pipedrive) so your team can act while the iron is hot.",
      icon: <Send className="w-6 h-6" />
    }
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
          <div className="flex-1 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-bold uppercase tracking-widest mb-6">
              <Target className="w-3 h-3" />
              Turn Traffic into Revenue
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-6 tracking-tight leading-[1.1]">
              Capture leads <br />
              <span className="text-brand-accent">while you sleep.</span>
            </h1>
            <p className="text-xl text-brand-gray mb-10 max-w-xl leading-relaxed">
              Ditch the static forms. SiteGist uses intelligent chat to qualify prospects, book meetings, and collect details on autopilot.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <CTAButton to="/signup" variant="primary" className="px-10 py-5 text-base w-full sm:w-auto">Start Generating Leads</CTAButton>
              <CTAButton to="/book-a-demo" variant="secondary" className="px-10 py-5 text-base w-full sm:w-auto">Book a Demo</CTAButton>
            </div>
          </div>
          <div className="flex-1 relative">
             <div className="bg-brand-dark rounded-[40px] p-8 md:p-12 shadow-2xl relative z-10 border border-white/10">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-white font-bold">SG</div>
                   <div>
                     <h3 className="text-white font-bold">New Lead Qualified</h3>
                     <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest leading-none mt-1">Status: Ready to Close</p>
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-white/60 text-sm">Prospect Name</span>
                      <span className="text-white font-bold text-sm">Siddartha Reddy</span>
                   </div>
                   <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-white/60 text-sm">Company</span>
                      <span className="text-white font-bold text-sm">SiteGist</span>
                   </div>
                   <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-white/60 text-sm">Interest Level</span>
                      <span className="px-3 py-1 rounded-full bg-brand-online/20 text-brand-online text-[10px] font-extrabold border border-brand-online/20 uppercase tracking-widest tracking-tighter">High Intent</span>
                   </div>
                   <div className="flex justify-between items-center py-4">
                      <span className="text-white/60 text-sm">Lead Source</span>
                      <span className="text-white font-bold text-sm">Home Page Widget</span>
                   </div>
                </div>
                <div className="mt-8">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-[11px] text-white/40 uppercase font-bold tracking-widest mb-3">AI Summary</p>
                    <p className="text-sm text-white/80 leading-relaxed italic italic-none">
                      "Siddartha is looking to automate customer support for their SaaS platform. They currently have 5,000 users and are interested in the Enterprise plan."
                    </p>
                  </div>
                </div>
             </div>
             {/* Decorative blob */}
             <div className="absolute -bottom-10 -right-10 w-full h-full bg-brand-accent/30 blur-[100px] -z-10 rounded-full"></div>
          </div>
        </div>

        {/* The Process */}
        <div className="mb-32">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-extrabold text-brand-dark mb-6 tracking-tight">The 24/7 Sales Engine</h2>
            <p className="text-xl text-brand-gray max-w-2xl mx-auto">
              While traditional agents have shifts, SiteGist works around the clock to capture every opportunity.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="p-10 rounded-3xl bg-brand-light/50 border border-brand-border relative overflow-hidden group">
                <div className="text-brand-accent/20 font-black text-8xl absolute -top-4 -right-4 transition-transform group-hover:scale-110">{i + 1}</div>
                <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-white mb-8 relative z-10">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-brand-dark mb-4 relative z-10">{step.title}</h3>
                <p className="text-brand-gray text-sm leading-relaxed font-medium relative z-10">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Callout */}
        <div className="bg-brand-dark rounded-[40px] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-8 tracking-tight">Integrates with your stack.</h2>
            <p className="text-white/60 text-xl max-w-2xl mx-auto mb-12">
              Sync captured leads automatically with over 3,000+ apps via native integrations and Zapier.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale filter hover:grayscale-0 transition-all duration-700">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-brand-dark">Hub</div>
                 <span className="text-white font-bold tracking-tight">HubSpot</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-[#00A1E0] rounded-full flex items-center justify-center font-bold text-white">S</div>
                 <span className="text-white font-bold tracking-tight">Salesforce</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-[#E11931] rounded-full flex items-center justify-center font-bold text-white">Z</div>
                 <span className="text-white font-bold tracking-tight">Zapier</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-[#4A154B] rounded-full flex items-center justify-center font-bold text-white">S</div>
                 <span className="text-white font-bold tracking-tight">Slack</span>
               </div>
            </div>
            <div className="mt-16">
               <CTAButton to="/integrations" variant="primary" className="px-12 py-5 text-base">Explore All Integrations</CTAButton>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent"></div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
