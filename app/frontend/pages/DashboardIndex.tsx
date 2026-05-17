import { Form, Link } from "@remix-run/react";
import { Plus, Globe, ChevronRight, MessageSquare, Loader2, PlayCircle, Bot, TrendingUp, Users, Activity } from "lucide-react";
import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface DashboardIndexPageProps {
  projects: any[];
  isCreating: boolean;
}

const analyticsData = [
  { name: 'Mon', leads: 4, messages: 24 },
  { name: 'Tue', leads: 7, messages: 35 },
  { name: 'Wed', leads: 5, messages: 30 },
  { name: 'Thu', leads: 9, messages: 48 },
  { name: 'Fri', leads: 12, messages: 52 },
  { name: 'Sat', leads: 8, messages: 40 },
  { name: 'Sun', leads: 15, messages: 63 },
];

const AreaChartAny = AreaChart as any;
const AreaAny = Area as any;
const XAxisAny = XAxis as any;
const YAxisAny = YAxis as any;
const CartesianGridAny = CartesianGrid as any;
const TooltipAny = Tooltip as any;
const ResponsiveContainerAny = ResponsiveContainer as any;
const BarChartAny = BarChart as any;
const BarAny = Bar as any;
const CellAny = Cell as any;

export function DashboardIndexPage({ projects, isCreating }: DashboardIndexPageProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const totalLeads = projects.reduce((acc, p) => acc + (p._count.leads || 0), 0);
  const totalSessions = projects.reduce((acc, p) => acc + (p._count.sessions || 0), 0);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-brand-dark">Chatbots</h1>
          <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full leading-none flex items-center gap-1.5 ring-1 ring-primary/20">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
            Pro Plan Active
          </div>
        </div>
        
        <Link 
          to="/create-chatbot" 
          className="inline-flex items-center justify-center gap-2 bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-150 rounded-xl px-4 py-3 hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="h-4 w-4" />
          Create New Chatbot
        </Link>
      </div>

      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-brand-border shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-brand-dark">Aggregate Performance</h3>
                <p className="text-xs text-text-muted">Combined performance across all {projects.length} bots</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 text-[10px] font-bold text-brand-dark">
                  <div className="w-2 h-2 rounded-full bg-primary" /> Leads
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 text-[10px] font-bold text-brand-dark">
                  <div className="w-2 h-2 rounded-full bg-purple-400" /> Messages
                </div>
              </div>
            </div>
            
            <div className="h-[240px] w-full">
              {mounted && (
                <ResponsiveContainerAny width="100%" height="100%">
                  <AreaChartAny data={analyticsData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#155DEE" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#155DEE" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGridAny strokeDasharray="3 3" vertical={false} stroke="#F1F1F4" />
                    <XAxisAny 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#A1A1AA', fontSize: 10, fontWeight: 700}}
                      dy={10}
                    />
                    <YAxisAny 
                      hide 
                    />
                    <TooltipAny 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold'}}
                    />
                    <AreaAny 
                      type="monotone" 
                      dataKey="messages" 
                      stroke="#A78BFA" 
                      fillOpacity={1} 
                      fill="url(#colorLeads)" 
                      strokeWidth={3}
                    />
                    <AreaAny 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="#155DEE" 
                      fillOpacity={1} 
                      fill="url(#colorLeads)" 
                      strokeWidth={4}
                    />
                  </AreaChartAny>
                </ResponsiveContainerAny>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-col gap-6">
            <div className="flex-1 bg-brand-dark text-white p-8 rounded-[40px] shadow-xl relative overflow-hidden group">
              <TrendingUp className="absolute -right-8 -bottom-8 w-40 h-40 opacity-5 group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-6 h-6 text-brand-accent" />
                </div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">Total Leads</h4>
                <div className="text-4xl font-black mb-2">{totalLeads.toLocaleString()}</div>
                <div className="flex items-center gap-1.5 text-brand-online text-xs font-bold">
                  <Activity className="w-3 h-3" /> Real-time active
                </div>
              </div>
            </div>

            <div className="flex-1 bg-[#F8F9FA] p-8 rounded-[40px] border border-brand-border group">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gray mb-1">Total Sessions</h4>
              <div className="text-4xl font-black mb-6 text-brand-dark">{totalSessions.toLocaleString()}</div>
              <div className="h-[80px] w-full">
                {mounted && (
                  <ResponsiveContainerAny width="100%" height="100%">
                    <BarChartAny data={[
                      { name: 'Sales', val: 65 },
                      { name: 'Support', val: 45 },
                      { name: 'Pricing', val: 30 },
                      { name: 'Docs', val: 25 },
                    ]}>
                      <BarAny dataKey="val" radius={[4, 4, 0, 0]}>
                        { [0, 1, 2, 3].map((entry, index) => (
                          <CellAny key={`cell-${index}`} fill={index === 0 ? '#155DEE' : '#E4E4E7'} />
                        ))}
                      </BarAny>
                      <XAxisAny dataKey="name" hide />
                    </BarChartAny>
                  </ResponsiveContainerAny>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center animate-in fade-in zoom-in duration-700">
          <div className="relative mb-12">
            <svg width="400" height="240" viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="max-w-full h-auto">
              {/* Desk/Surface */}
              <rect x="100" y="160" width="240" height="12" rx="6" fill="#F3F4F6" />
              <rect x="130" y="172" width="8" height="40" rx="4" fill="#F3F4F6" />
              <rect x="302" y="172" width="8" height="40" rx="4" fill="#F3F4F6" />
              
              {/* Computer/Monitor */}
              <rect x="150" y="70" width="140" height="90" rx="12" stroke="#1A1A1A" strokeWidth="6" fill="white" />
              <rect x="165" y="85" width="80" height="6" rx="3" fill="#6366F1" fillOpacity="0.2" />
              <rect x="165" y="100" width="110" height="6" rx="3" fill="#6366F1" fillOpacity="0.1" />
              <rect x="165" y="115" width="110" height="6" rx="3" fill="#6366F1" fillOpacity="0.1" />
              <rect x="165" y="138" width="40" height="6" rx="3" fill="#6366F1" fillOpacity="0.3" />
              <circle cx="275" cy="85" r="4" fill="#10B981" />

              {/* Robot Character */}
              <g className="animate-bounce" style={{ animationDuration: '4s' }}>
                <rect x="60" y="100" width="60" height="50" rx="16" stroke="#6366F1" strokeWidth="5" fill="white" />
                <rect x="75" y="130" width="30" height="12" rx="4" fill="#1A1A1A" />
                <circle cx="80" cy="118" r="4" fill="#1A1A1A" />
                <circle cx="100" cy="118" r="4" fill="#1A1A1A" />
                <path d="M85 145H95" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
                <path d="M90 100V85" stroke="#6366F1" strokeWidth="3" />
                <circle cx="90" cy="85" r="4" fill="#F87171" />
                
                {/* Robot Body */}
                <rect x="65" y="155" width="50" height="60" rx="12" fill="#6366F1" />
                <rect x="75" y="165" width="30" height="20" rx="4" fill="#1A1A1A" />
                <circle cx="80" cy="172" r="2" fill="#FBBF24" />
                <circle cx="90" cy="172" r="2" fill="#10B981" />
                <circle cx="100" cy="172" r="2" fill="#F87171" />
                
                {/* Arm waving */}
                <path d="M50 160C40 150 30 160 40 170" stroke="#6366F1" strokeWidth="8" strokeLinecap="round" className="animate-pulse" />
              </g>
              
              {/* Floating thought bubbles */}
              <circle cx="130" cy="110" r="4" fill="#6366F1" fillOpacity="0.2" />
              <circle cx="138" cy="100" r="6" fill="#6366F1" fillOpacity="0.2" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-brand-dark mb-3">No agents yet</h2>
          <Link 
            to="/create-chatbot"
            className="text-brand-gray font-medium text-lg leading-relaxed underline underline-offset-8 decoration-brand-gray/30 hover:decoration-primary hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-primary hover:to-purple-500 transition-all duration-300"
          >
            Create your first chatbot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              to={`/dashboard/projects/${project.id}`}
              className="group block p-6 bg-white border border-brand-border rounded-[32px] hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ring-1 ring-brand-border">
                  <Bot className="text-primary w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-dark mb-1 group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-brand-online rounded-full"></div>
                    <span className="text-[11px] font-bold text-brand-gray uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="p-4 bg-brand-light/50 rounded-2xl border border-brand-border/50">
                  <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1 opacity-60">Knowledge</p>
                  <div className="flex items-center gap-2 text-brand-dark font-bold">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>{project._count.knowledgeSources} Items</span>
                  </div>
                </div>
                <div className="p-4 bg-brand-light/50 rounded-2xl border border-brand-border/50">
                  <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1 opacity-60">Sessions</p>
                  <div className="flex items-center gap-2 text-brand-dark font-bold">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>{project._count.sessions} Chats</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
