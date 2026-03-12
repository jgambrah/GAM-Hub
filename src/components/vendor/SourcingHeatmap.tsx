
'use client';

import React, { useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { MapPin, ShoppingBag, Flame, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import type { MarketRequest } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface Hotspot {
    location: string;
    totalRequests: number;
    topCategory: string;
    items: string[];
}

/**
 * SourcingHeatmap Component
 * 
 * Advanced Supply-Demand visualization for vendors.
 * Groups active requests by location to show "Commercial Hotspots" on campus.
 */
export default function SourcingHeatmap({ campusId }: { campusId: string }) {
  const { firestore } = useFirebase();

  // 1. Fetch active requests for this campus
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !campusId) return null;
    return query(
      collection(firestore, "market_requests"),
      where("campusId", "==", campusId),
      where("status", "==", "open"),
      limit(200)
    );
  }, [firestore, campusId]);

  const { data: requests, isLoading } = useCollection<MarketRequest>(requestsQuery);

  // 2. 🧠 HEATMAP ALGORITHM: Group by Location
  const hotspots = useMemo(() => {
    if (!requests) return [];

    const groups: Record<string, { count: number, categories: Record<string, number>, items: Set<string> }> = {};

    requests.forEach(req => {
        const loc = req.location || 'Yard General';
        if (!groups[loc]) {
            groups[loc] = { count: 0, categories: {}, items: new Set() };
        }
        groups[loc].count += 1;
        groups[loc].categories[req.category] = (groups[loc].categories[req.category] || 0) + 1;
        groups[loc].items.add(req.query);
    });

    return Object.entries(groups).map(([loc, data]) => {
        const topCat = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0][0];
        return {
            location: loc,
            totalRequests: data.count,
            topCategory: topCat,
            items: Array.from(data.items).slice(0, 3)
        } as Hotspot;
    }).sort((a, b) => b.totalRequests - a.totalRequests);

  }, [requests]);

  if (isLoading) {
      return (
          <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 space-y-6">
              <Skeleton className="h-8 w-48 bg-white/5" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-40 w-full rounded-3xl bg-white/5" />
                  <Skeleton className="h-40 w-full rounded-3xl bg-white/5" />
              </div>
          </div>
      );
  }

  if (hotspots.length === 0) return null;

  return (
    <div className="bg-slate-950 rounded-[3.5rem] p-8 md:p-10 border-4 border-slate-900 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <TrendingUp size={200} className="text-blue-500" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Flame size={18} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sourcing Hotspots</span>
            </div>
            <h2 className="text-3xl font-black text-white italic tracking-tight uppercase">Demand Heatmap</h2>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2">
             <MapPin size={16} className="text-red-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campus Density</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotspots.map((spot, i) => (
            <div key={spot.location} className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 hover:border-blue-500/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <MapPin size={24} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white tabular-nums">{spot.totalRequests}</p>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Needs</p>
                </div>
              </div>

              <h3 className="font-black text-lg text-white mb-2 truncate uppercase tracking-tight">{spot.location}</h3>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">
                Primary Need: {spot.topCategory}
              </p>

              <div className="space-y-2 mb-6">
                {spot.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-400 italic">
                    <Zap size={10} className="text-amber-500" />
                    <span className="truncate">"{item}"</span>
                  </div>
                ))}
              </div>

              <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-white/10 transition-all flex items-center justify-center gap-2">
                Deploy Stock Here <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-white/5 flex justify-center">
         <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Advanced Demand Intelligence • GH 🇬🇭</p>
      </div>
    </div>
  );
}
