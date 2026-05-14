import { Header } from "~/frontend/components/Header";
import { Footer } from "~/frontend/components/Footer";
import { CTAButton } from "~/frontend/components/CTAButton";
import { 
  Plus, 
  Search, 
  Layers, 
  MessageSquare, 
  Mail, 
  Database, 
  Workflow, 
  Zap,
  Globe
} from "lucide-react";
import { useState } from "react";

export default function Integrations() {
  const [searchTerm, setSearchTerm] = useState("");

  const categories = ["All", "CRM", "Email", "Slack", "Automations", "E-commerce"];
  const [activeCategory, setActiveCategory] = useState("All");

  const integrations = [
    { name: "HubSpot", category: "CRM", description: "Sync contacts and conversations directly to HubSpot.", icon: "H" },
    { name: "Salesforce", category: "CRM", description: "Manage leads and opportunities in the world's #1 CRM.", icon: "S" },
    { name: "Slack", category: "Slack", description: "Get instant notifications for every new lead.", icon: "S" },
    { name: "Zapier", category: "Automations", description: "Connect with 5,000+ apps using Zapier workflows.", icon: "Z" },
    { name: "Resend", category: "Email", description: "Automated event-triggered transactional emails.", icon: "R" },
    { name: "Intercom", category: "Slack", description: "Seamlessly handoff chats to human agents.", icon: "I" },
    { name: "Shopify", category: "E-commerce", description: "Answer product questions and track orders directly.", icon: "S" },
    { name: "Zendesk", category: "CRM", description: "Convert chats into support tickets automatically.", icon: "Z" },
    { name: "Make.com", category: "Automations", description: "Advanced automation workflows for your AI bot.", icon: "M" },
    { name: "Mailchimp", category: "Email", description: "Add new leads to your marketing campaigns.", icon: "M" },
  ];

  const filtered = integrations.filter(int => {
    const matchesSearch = int.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "All" || int.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white min-h-screen">
      <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent text-xs font-bold uppercase tracking-widest mb-6">
            <Layers className="w-3 h-3" />
            Ecosystem
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-6 tracking-tight">
            Connect your <span className="text-brand-accent">workflows.</span>
          </h1>
          <p className="text-xl text-brand-gray max-w-2xl mx-auto">
            SiteGist plays well with the tools you already use. Seamlessly sync your data across your entire tech stack.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex bg-brand-light p-1 rounded-2xl overflow-x-auto max-w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? "bg-white text-brand-dark shadow-sm" 
                    : "text-brand-gray hover:text-brand-dark"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
            <input 
              type="text" 
              placeholder="Search integrations..."
              className="w-full pl-12 pr-6 py-3.5 bg-brand-light rounded-2xl border border-transparent focus:border-brand-accent/30 focus:ring-4 focus:ring-brand-accent/5 outline-none font-medium text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {filtered.map((item) => (
            <div key={item.name} className="p-8 rounded-3xl border border-brand-border hover:border-brand-accent/30 bg-white transition-all duration-300 group flex flex-col">
              <div className="flex items-center justify-between mb-8">
                 <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-xl font-black text-brand-dark border border-brand-border group-hover:border-brand-accent/20 group-hover:scale-105 transition-all">
                    {item.name[0]}
                 </div>
                 <div className="px-3 py-1 rounded-full bg-brand-light text-[10px] font-bold text-brand-gray uppercase tracking-widest border border-brand-border">
                    {item.category}
                 </div>
              </div>
              <h3 className="text-xl font-extrabold text-brand-dark mb-3 tracking-tight">{item.name}</h3>
              <p className="text-sm font-medium text-brand-gray leading-relaxed mb-8 flex-grow">
                {item.description}
              </p>
              <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-light text-brand-dark text-xs font-bold uppercase tracking-widest hover:bg-brand-dark hover:text-white transition-all border border-brand-dark/5">
                 Configure
                 <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-brand-gray font-bold">No integrations found matching your search.</p>
            </div>
          )}
        </div>

        {/* Suggestion box */}
        <div className="bg-brand-accent text-white rounded-[40px] p-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold mb-6">Need a custom integration?</h2>
            <p className="mb-8 font-medium text-white/80 max-w-xl mx-auto">
              Our developer API is ready for you. Or just reach out and we'll see if we can build it for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <CTAButton to="/docs" variant="secondary" className="bg-white text-brand-accent border-white hover:bg-brand-light px-10 border-none">Check API Docs</CTAButton>
               <CTAButton to="/contact-us" variant="text" className="text-white hover:text-white/80">Submit Integration Request</CTAButton>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-20 -translate-y-20"></div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
