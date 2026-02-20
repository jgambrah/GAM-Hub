'use client';

import React, { useState } from 'react';
import { Zap, Target, MousePointer2, TrendingUp, BarChart3, ChevronRight, Edit3, Plus, ArrowLeft, ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/types';
import Image from 'next/image';
import AdReport from './AdReport';
import { BoostProduct } from './BoostProduct';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

interface AdManagerProps {
  vendorProducts: Product[];
  fuelBalance: number;
}

export default function AdManager({ vendorProducts, fuelBalance }: AdManagerProps) {
  const [selectedAd, setSelectedAd] = useState<Product | null>(null);
  const [editingAd, setEditingAd] = useState<Product | null>(null);
  const [showBoostNew, setShowBoostNew] = useState(false);

  // 1. Filter products for different views
  const boostedProducts = vendorProducts.filter((p) => p.isSponsored);
  const eligibleToBoost = vendorProducts.filter((p) => !p.isSponsored);

  const totalClicks = boostedProducts.reduce((acc, p) => acc + (p.clicks || 0), 0);
  const totalReach = totalClicks * 15 + boostedProducts.length * 100;

  // --- VIEW: EDITING AN AD ---
  if (editingAd) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setEditingAd(null)}
            className="rounded-xl h-12 w-12 p-0"
          >
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h2 className="text-2xl font-black">Manage Campaign</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
              Refining Targeting & Creative for {editingAd.name}
            </p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto">
          <BoostProduct product={editingAd} />
        </div>
      </div>
    );
  }

  // --- VIEW: AD PERFORMANCE REPORT ---
  if (selectedAd) {
    return (
      <div className="space-y-6">
        <AdReport adData={selectedAd} onBack={() => setSelectedAd(null)} />
        <div className="max-w-6xl mx-auto px-8">
           <Button 
             onClick={() => { setEditingAd(selectedAd); setSelectedAd(null); }}
             className="bg-slate-900 text-white rounded-2xl px-8 py-6 h-auto font-black flex items-center gap-2 shadow-xl"
           >
             <Edit3 size={18} /> Tweak Ad Creative
           </Button>
        </div>
      </div>
    );
  }

  // --- VIEW: BOOST NEW ITEM SELECTION ---
  if (showBoostNew) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowBoostNew(false)} className="rounded-xl h-12 w-12 p-0">
            <ArrowLeft size={24} />
          </Button>
          <h2 className="text-2xl font-black">Select Product to Boost</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eligibleToBoost.length > 0 ? (
            eligibleToBoost.map((product) => (
              <div 
                key={product.id} 
                className="bg-card p-6 rounded-[2.5rem] border border-border shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
                onClick={() => { setEditingAd(product); setShowBoostNew(false); }}
              >
                <div className="aspect-square relative rounded-2xl overflow-hidden mb-4 bg-muted">
                  <Image src={product.imageUrl} fill className="object-cover group-hover:scale-110 transition-transform duration-500" alt={product.name} />
                </div>
                <h4 className="font-bold text-lg mb-2">{product.name}</h4>
                <Button className="w-full bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">
                  Start Boost
                </Button>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed">
               <ShoppingBag className="mx-auto text-muted-foreground/20 mb-4" size={48} />
               <p className="font-bold text-muted-foreground">All your products are already boosted!</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- VIEW: MAIN DASHBOARD LIST ---
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. AD PERFORMANCE SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
              <Target size={100} />
           </div>
           <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Ad Reach</span>
              </div>
              <h3 className="text-4xl font-black">{totalReach.toLocaleString()}</h3>
              <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Impressions across the Yard</p>
           </div>
        </div>

        <div className="bg-white dark:bg-card p-8 rounded-[2.5rem] border border-slate-100 dark:border-border shadow-sm">
           <div className="flex items-center gap-2 text-blue-600 mb-2">
              <MousePointer2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Click-Throughs</span>
           </div>
           <h3 className="text-4xl font-black text-slate-800 dark:text-white">{totalClicks.toLocaleString()}</h3>
           <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Interested students & staff</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/50">
           <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <Zap size={16} className="fill-current" />
              <span className="text-[10px] font-black uppercase tracking-widest">Fuel Remaining</span>
           </div>
           <h3 className="text-4xl font-black text-blue-900 dark:text-blue-200">GHS {fuelBalance.toFixed(2)}</h3>
           <p className="text-[10px] text-blue-400 mt-2 uppercase font-bold">Lead Fuel Credits</p>
        </div>
      </div>

      {/* 2. ACTIVE CAMPAIGNS LIST */}
      <div className="bg-card rounded-[3rem] border border-border shadow-lg overflow-hidden">
        <div className="p-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20">
           <div>
              <h3 className="font-black text-xl text-foreground flex items-center gap-3">
                <Target className="text-red-500" /> Active Major Boosts
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Targeted ads currently visible in the Yard Pulse.</p>
           </div>
           <button 
             onClick={() => setShowBoostNew(true)}
             className="bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2"
           >
             <Plus size={14} /> Boost New Item
           </button>
        </div>

        <div className="divide-y divide-border">
          {boostedProducts.length > 0 ? (
            boostedProducts.map((ad) => {
              const clicks = ad.clicks || 0;
              const ctr = clicks > 0 ? ((clicks / (clicks * 12)) * 100).toFixed(1) : "0.0";
              
              return (
                <div 
                  key={ad.id} 
                  className="p-6 flex flex-col md:flex-row items-center justify-between hover:bg-muted/30 transition-all gap-6 group"
                >
                  <div className="flex items-center gap-6 flex-1 w-full" onClick={() => setSelectedAd(ad)}>
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border shadow-inner flex-shrink-0 group-hover:scale-105 transition-transform cursor-pointer">
                        <Image src={ad.imageUrl} fill className="object-cover" alt={ad.name} />
                    </div>
                    <div className="min-w-0 flex-1 cursor-pointer">
                       <p className="font-black text-foreground text-lg truncate group-hover:text-primary transition-colors">{ad.name}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="bg-blue-600 text-white text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter shadow-sm">
                            TARGET: {ad.sponsoredMajor}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase">{ad.category}</span>
                       </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 w-full md:w-auto px-4">
                     <div className="text-center cursor-pointer" onClick={() => setSelectedAd(ad)}>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Clicks</p>
                        <p className="text-xl font-black text-foreground">{clicks}</p>
                     </div>
                     <div className="text-center cursor-pointer" onClick={() => setSelectedAd(ad)}>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">CTR</p>
                        <p className="text-xl font-black text-emerald-500">{ctr}%</p>
                     </div>
                     <div className="flex gap-2">
                        <Button 
                          variant="ghost"
                          onClick={() => setSelectedAd(ad)}
                          className="p-3 bg-muted group-hover:bg-primary group-hover:text-white rounded-xl text-muted-foreground transition-all shadow-sm"
                        >
                          <BarChart3 size={20}/>
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={() => setEditingAd(ad)}
                          className="p-3 bg-muted hover:bg-indigo-600 hover:text-white rounded-xl text-muted-foreground transition-all shadow-sm"
                        >
                          <Edit3 size={20}/>
                        </Button>
                     </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-20 text-center flex flex-col items-center">
                <Target className="text-muted-foreground/20 mb-4" size={64} />
                <p className="text-lg font-black text-muted-foreground">No active campaigns</p>
                <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto mt-2">Increase your visibility in the Yard by boosting your best products to specific student majors.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
