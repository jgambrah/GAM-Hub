'use client';

import React, { useMemo } from 'react';
import { Map as MapIcon, GraduationCap, TrendingUp, Globe, Zap, ShieldCheck, BarChart3 } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, where } from 'firebase/firestore';
import type { Connection, Campus, User, SocialPost, Order } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Dynamically import the Vibration Map to prevent SSR Leaflet errors
const VibrationMap = dynamic(() => import('./VibrationMap'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 rounded-[2.5rem]">
            <Globe className="h-12 w-12 text-blue-500 animate-spin-slow mb-4" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calibrating Satellite Feed...</p>
        </div>
    )
});

// A simple mapping from city to region for display purposes
const locationToRegion: { [key: string]: string } = {
    'Accra': 'Greater Accra',
    'Kumasi': 'Ashanti',
    'Cape Coast': 'Central',
    'Tamale': 'Northern',
    'Ho': 'Volta',
    'Tarkwa': 'Western',
    'Winneba': 'Central',
    'Koforidua': 'Eastern',
    'Takoradi': 'Western',
    'Berekuso': 'Eastern',
    'Oyibi': 'Greater Accra',
};

export default function LiaisonAnalytics() {
  const { firestore } = useFirebase();

  // 1. DATA INFRASTRUCTURE: Fetch vibrations, economic trade, and networking links
  const pulseQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'campus_pulse'), limit(500), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), limit(200), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const connectionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'connections'), orderBy('createdAt', 'desc'), limit(300));
  }, [firestore]);
  
  const campusesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'campuses'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'), where('role', '==', 'student'), limit(500));
  }, [firestore]);

  const { data: pulsePosts, isLoading: isLoadingPulse } = useCollection<SocialPost>(pulseQuery);
  const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);
  const { data: connections, isLoading: isLoadingConnections } = useCollection<Connection>(connectionsQuery);
  const { data: campuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);
  const { data: students, isLoading: isLoadingStudents } = useCollection<User>(usersQuery);

  const isLoading = isLoadingPulse || isLoadingOrders || isLoadingConnections || isLoadingCampuses || isLoadingStudents;

  // 2. VIBRATION SCORING LOGIC (The Liaison Algorithm)
  const vibrationScores = useMemo(() => {
    const scores = new Map<string, number>();
    if (!campuses) return scores;

    // Initialize scores for all campuses
    campuses.forEach(c => scores.set(c.id, 0));

    // Social Weight: 5pts per post
    pulsePosts?.forEach(p => {
        if (!p.campusId) return;
        const current = scores.get(p.campusId) || 0;
        scores.set(p.campusId, current + 5);
    });

    // Economic Weight: 10pts per order
    orders?.forEach(o => {
        if (!o.campusId) return;
        const current = scores.get(o.campusId) || 0;
        scores.set(o.campusId, current + 10);
    });

    // Social Network Weight: 2pts per link-up (both parties gain vibe)
    connections?.forEach(c => {
        const fromScore = scores.get(c.fromCampusId) || 0;
        const toScore = scores.get(c.toCampusId) || 0;
        scores.set(c.fromCampusId, fromScore + 2);
        scores.set(c.toCampusId, toScore + 2);
    });

    return scores;
  }, [campuses, pulsePosts, orders, connections]);

  const campusMap = useMemo(() => {
      if (!campuses) return new Map<string, Campus>();
      return new Map(campuses.map(c => [c.id, c]));
  }, [campuses]);

  // 3. Process data for Trending Majors
  const trendingMajorsData = useMemo(() => {
      if (!students || !connections) return [];
      
      const studentMap = new Map(students.map(s => [s.id, s]));
      const majorCounts: { [key: string]: number } = {};

      connections.forEach(conn => {
          const fromStudent = studentMap.get(conn.fromUserId);
          const toStudent = studentMap.get(conn.toUserId);

          if (fromStudent?.major) {
              majorCounts[fromStudent.major] = (majorCounts[fromStudent.major] || 0) + 1;
          }
          if (toStudent?.major) {
              majorCounts[toStudent.major] = (majorCounts[toStudent.major] || 0) + 1;
          }
      });
      
      const maxCount = Math.max(...Object.values(majorCounts), 1);
      
      return Object.entries(majorCounts).map(([major, count]) => ({
          major,
          count,
          percentage: (count / maxCount) * 100,
      })).sort((a, b) => b.count - a.count).slice(0, 4);

  }, [students, connections]);
  
  const barColors = ['bg-white', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500'];

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            <Globe className="text-blue-500 animate-spin-slow" size={40} />
            NATIONAL LIAISON HUB
          </h1>
          <p className="text-slate-400 font-medium mt-2 uppercase tracking-[0.3em] text-xs">
            Real-time Ghana Campus Intelligence
          </p>
        </div>
        <div className="flex gap-3">
            <div className="bg-blue-500/10 border border-blue-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">Satellite Sync Active</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="text-emerald-500" size={16} />
                <span className="text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase">Fortress Secure</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SECTION A: NATIONAL VIBRATION MAP */}
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900/50 rounded-[3.5rem] border-4 border-slate-900 p-2 relative overflow-hidden h-[600px] shadow-2xl">
                <VibrationMap 
                    campuses={campuses || []} 
                    vibrationScores={vibrationScores} 
                />
                
                {/* Map Overlay HUD */}
                <div className="absolute top-8 left-8 z-[1000] pointer-events-none">
                    <div className="bg-slate-950/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-1">
                            <Zap className="text-amber-400 animate-pulse" size={20} fill="currentColor" />
                            <h2 className="text-xl font-black italic tracking-tight uppercase">Vibration Map</h2>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Geographic Pulse Indicator</p>
                    </div>
                </div>
            </div>

            {/* QUICK STATS HUD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Network Links', value: connections?.length || 0, icon: Globe, color: 'text-blue-400' },
                    { label: 'Campus Vibes', value: pulsePosts?.length || 0, icon: Zap, color: 'text-amber-400' },
                    { label: 'Gross Trade', value: orders?.length || 0, icon: BarChart3, color: 'text-emerald-400' },
                    { label: 'Active Yards', value: campuses?.length || 0, icon: MapIcon, color: 'text-indigo-400' }
                ].map((stat) => (
                    <div key={stat.label} className="p-6 bg-slate-900/50 rounded-[2rem] border border-white/5 shadow-inner group hover:border-white/10 transition-all">
                        <stat.icon className={cn("mb-3", stat.color)} size={20} />
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-black mt-1 tabular-nums">{isLoading ? '...' : stat.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* SECTION B: ACADEMIC HUB & RECENT LOGS */}
        <div className="space-y-8">
          {/* TRENDING MAJORS */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-10 shadow-2xl shadow-blue-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><GraduationCap size={150}/></div>
            <div className="relative z-10">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                <TrendingUp /> Academic Pulse
                </h2>
                {isLoading ? (
                    <div className="space-y-6">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800/50" />)}
                    </div>
                ): (
                    <div className="space-y-6">
                    {trendingMajorsData.map((m, i) => (
                        <div key={m.major}>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                            <span>{m.major}</span>
                            <span className="text-white/60">{m.count} Linked</span>
                        </div>
                        <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden p-0.5">
                            <div className={cn(barColors[i % barColors.length], 'h-full rounded-full transition-all duration-1000')} style={{ width: `${m.percentage}%` }} />
                        </div>
                        </div>
                    ))}
                    </div>
                )}
            </div>
          </div>

          {/* RECENT UNITY LOG */}
          <div className="bg-slate-900 rounded-[3rem] border border-slate-800 p-8 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Zap size={12} className="text-amber-400" /> Real-time Handshakes
            </h3>
            <div className="space-y-4">
              {isLoading ? (
                  [...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800 rounded-xl" />)
              ) : connections?.slice(0, 6).map((link: Connection) => (
                <div key={link.id} className="flex items-center gap-4 text-xs p-3 bg-slate-950/50 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-black text-white text-[10px] shadow-lg">
                    {campusMap.get(link.fromCampusId)?.acronym[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">
                        <span className="font-black text-white">{campusMap.get(link.fromCampusId)?.acronym || '??'}</span>
                        <span className="mx-1 text-[8px] opacity-50">🤝</span>
                        <span className="font-black text-white">{campusMap.get(link.toCampusId)?.acronym || '??'}</span>
                    </p>
                    <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 tracking-tighter">Handshake logged in National Hub</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
