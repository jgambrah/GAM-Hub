'use client';

import React from 'react';
import { BarChart3, MousePointer2, TrendingUp, Users, DollarSign, Target, ChevronLeft } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Button } from '../ui/button';

interface AdReportProps {
  adData: Product;
  onBack: () => void;
}

export default function AdReport({ adData, onBack }: AdReportProps) {
  // Calculations based on Liaison Protocol: GHS 0.20 per click
  const clicks = adData.clicks || 0;
  const conversions = adData.conversions || 0;
  const totalSpend = clicks * 0.2;
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";
  const costPerLead = conversions > 0 ? (totalSpend / conversions).toFixed(2) : "0.00";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={onBack} className="rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors h-12 w-12 p-0">
          <ChevronLeft size={24} />
        </Button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-foreground">Campaign Intelligence</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Performance Hub: {adData.name}</p>
        </div>
      </div>

      <div className="p-8 bg-white dark:bg-card rounded-[3rem] border border-slate-100 dark:border-border shadow-xl overflow-hidden relative">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 p-10 opacity-5 -mr-10 -mt-10 pointer-events-none">
          <BarChart3 size={200} className="text-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-10">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
              <TrendingUp size={14} /> ROI Tracking Active
            </div>
          </div>

          {/* TOP STATS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="p-6 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border shadow-inner">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Total Ad Spend</p>
               <h3 className="text-2xl font-black text-slate-900 dark:text-foreground">GHS {totalSpend.toFixed(2)}</h3>
               <p className="text-[10px] text-slate-500 mt-1 font-bold">@ GHS 0.20 per click</p>
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-950/20 rounded-3xl border border-blue-100 dark:border-blue-900 shadow-inner">
               <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest">Engaged Audience</p>
               <h3 className="text-2xl font-black text-blue-900 dark:text-blue-200">{clicks} Clicks</h3>
               <p className="text-[10px] text-blue-500/70 dark:text-blue-400/70 mt-1 font-bold">Direct interest from the Yard</p>
            </div>

            <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl border border-indigo-100 dark:border-indigo-900 shadow-inner">
               <p className="text-[9px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Conversion Rate</p>
               <h3 className="text-2xl font-black text-indigo-900 dark:text-indigo-200">{conversionRate}%</h3>
               <p className="text-[10px] text-indigo-500/70 dark:text-indigo-400/70 mt-1 font-bold">Clicks to Action Ratio</p>
            </div>
          </div>

          {/* PERFORMANCE BREAKDOWN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-sm uppercase px-2 tracking-widest">
               <Target size={16} className="text-red-500" /> Target Efficiency
            </div>
            
            <div className="bg-slate-900 dark:bg-slate-950 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12"><Target size={150}/></div>
               <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                      <p className="text-sm font-bold flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Targeted Major:</span> 
                        <span className="text-blue-400 font-black uppercase tracking-tight">{adData.sponsoredMajor}</span>
                      </p>
                      <div className="flex gap-1.5">
                        {[1,2,3,4,5].map(i => (
                          <div 
                            key={i} 
                            className={cn(
                              "w-2 h-2 rounded-full",
                              i <= 4 ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-slate-700"
                            )} 
                          />
                        ))}
                      </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "Liaison Insights: Your ad is performing <b>25% better</b> than the average {adData.category} product because your targeting is precise. The {adData.sponsoredMajor} demographic is currently highly active."
                    </p>
                  </div>
               </div>
            </div>
          </div>

          {/* FOOTER CTA */}
          <div className="mt-12 flex flex-col items-center gap-4">
             <button className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b-2 border-blue-600/30 dark:border-blue-400/30 pb-1 hover:text-blue-500 hover:border-blue-500 transition-all">
               Download Detailed PDF Audit
             </button>
             <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Powered by GAM Hub Liaison Intelligence</p>
          </div>
        </div>
      </div>
    </div>
  );
}