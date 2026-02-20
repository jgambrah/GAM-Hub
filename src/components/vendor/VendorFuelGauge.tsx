'use client';

import React from 'react';
import { Zap, AlertCircle, Fuel } from 'lucide-react';

interface VendorFuelGaugeProps {
  vendorData: any;
  onRefill: () => void;
}

export default function VendorFuelGauge({ vendorData, onRefill }: VendorFuelGaugeProps) {
  const trialLeads = vendorData?.trial_leads_count || 0;
  const fuelBalance = vendorData?.lead_credits || 0;
  const isTrial = trialLeads > 0;

  // Logic: Calculate "Health" percentage
  // If in trial, 5 leads = 100%. If in premium, we assume GHS 100 = 100% for the visual.
  const percentage = isTrial ? (trialLeads / 5) * 100 : Math.min((fuelBalance / 100) * 100, 100);

  // Dynamic Colors: Green -> Amber -> Red
  const getVibeColor = () => {
    if (percentage > 50) return 'bg-emerald-500';
    if (percentage > 20) return 'bg-amber-500';
    return 'bg-red-500 animate-pulse';
  };

  return (
    <div className="bg-white dark:bg-card rounded-[2.5rem] p-8 border border-slate-100 dark:border-border shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isTrial ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
            <Fuel size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-foreground">Lead Fuel Tank</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isTrial ? 'Free Trial Phase' : 'Premium Payout Account'}
            </p>
          </div>
        </div>
        {!isTrial && fuelBalance <= 10 && (
          <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
            <AlertCircle size={12} /> CRITICAL
          </div>
        )}
      </div>

      {/* THE GAUGE VISUAL */}
      <div className="space-y-3">
        <div className="flex justify-between items-end px-1">
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">
            {isTrial ? `${trialLeads} Leads` : `GHS ${fuelBalance.toFixed(2)}`}
          </span>
          <span className="text-xs font-bold text-slate-400">{Math.round(percentage)}% Full</span>
        </div>
        
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-50 dark:border-slate-900">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${getVibeColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* REFILL ACTION */}
      <div className="mt-8 flex flex-col gap-3">
        <p className="text-[10px] text-slate-400 leading-relaxed italic">
          {isTrial 
            ? "You are enjoying free leads from the Liaison. Refill once your trial hits 0."
            : "Your fuel is consumed every time a staff/student sends a service inquiry."}
        </p>
        
        <button 
          onClick={onRefill}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
        >
          <Zap size={16} className="fill-current" /> Top Up Lead Fuel
        </button>
      </div>
    </div>
  );
}