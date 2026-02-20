'use client';

import React, { useMemo } from 'react';
import { Map as MapIcon, GraduationCap, TrendingUp, Globe } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, where } from 'firebase/firestore';
import type { Connection, Campus, User } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

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

  // 1. Fetch all necessary data
  const connectionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'connections'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  
  const campusesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'campuses'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'), where('role', '==', 'student'));
  }, [firestore]);

  const { data: connections, isLoading: isLoadingConnections } = useCollection<Connection>(connectionsQuery);
  const { data: campuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);
  const { data: students, isLoading: isLoadingStudents } = useCollection<User>(usersQuery);

  const isLoading = isLoadingConnections || isLoadingCampuses || isLoadingStudents;

  const recentLinks = useMemo(() => connections?.slice(0, 5) || [], [connections]);
  
  const campusMap = useMemo(() => {
      if (!campuses) return new Map<string, Campus>();
      return new Map(campuses.map(c => [c.id, c]));
  }, [campuses]);


  // 2. Process data for Geographic Pulse
  const geoPulseData = useMemo(() => {
    if (!campuses || !connections) return [];

    const regionStats: { [key: string]: { name: string, campuses: string[], count: number } } = {};

    campuses.forEach(campus => {
        const regionName = locationToRegion[campus.location] || 'Other';
        if (!regionStats[regionName]) {
            regionStats[regionName] = { name: regionName, campuses: [], count: 0 };
        }
        regionStats[regionName].campuses.push(campus.acronym);
    });

    connections.forEach(connection => {
        const fromCampus = campusMap.get(connection.fromCampusId);
        if (fromCampus) {
            const regionName = locationToRegion[fromCampus.location] || 'Other';
            if (regionStats[regionName]) {
                regionStats[regionName].count += 1;
            }
        }
    });

    const maxCount = Math.max(...Object.values(regionStats).map(r => r.count), 1);

    return Object.values(regionStats).map(region => ({
        ...region,
        campuses: region.campuses.join(', '),
        active: Math.round((region.count / maxCount) * 100),
    })).sort((a,b) => b.count - a.count);

  }, [campuses, connections, campusMap]);

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
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            <Globe className="text-blue-500 animate-spin-slow" size={40} />
            NATIONAL LIAISON HUB
          </h1>
          <p className="text-slate-400 font-medium mt-2 uppercase tracking-[0.3em] text-xs">
            Real-time Ghana Campus Intelligence
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm font-black tracking-widest text-blue-400 uppercase">Live Network Feed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SECTION A: GEOGRAPHIC ACTIVITY (The Map View) */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-[3rem] border border-slate-800 p-10 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
              <MapIcon className="text-blue-500" /> Geographic Pulse
            </h2>
            
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {[...Array(6)].map((_,i) => <Skeleton key={i} className="h-36 bg-slate-800/50 rounded-3xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {geoPulseData.map((region) => (
                    <div key={region.name} className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1 truncate">{region.campuses}</p>
                    <h4 className="font-bold text-lg">{region.name}</h4>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-2xl font-black text-blue-500">{region.active}%</span>
                        <div className="w-16 h-8 flex items-end gap-1">
                            {[0.4, 0.7, 0.5, 0.9].map((h, i) => (
                                <div key={i} className="flex-1 bg-blue-500/20 group-hover:bg-blue-500 transition-all" style={{ height: `${Math.random() * 100}%` }} />
                            ))}
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
          {/* Subtle Map Watermark Background */}
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
            <MapIcon size={400} />
          </div>
        </div>

        {/* SECTION B: TRENDING MAJORS (Academic Hub) */}
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-10 shadow-2xl shadow-blue-900/20">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
              <TrendingUp /> Trending Majors
            </h2>
             {isLoading ? (
                <div className="space-y-6">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800/50" />)}
                </div>
            ): (
                <div className="space-y-6">
                {trendingMajorsData.map((m, i) => (
                    <div key={m.major}>
                    <div className="flex justify-between text-sm font-bold mb-2">
                        <span>{m.major}</span>
                        <span>{m.count} Links</span>
                    </div>
                    <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                        <div className={cn(barColors[i % barColors.length], 'h-full')} style={{ width: `${m.percentage}%` }} />
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>

          {/* SECTION C: LIVE UNITY FEED */}
          <div className="bg-slate-900 rounded-[3rem] border border-slate-800 p-8">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Recent Unity Handshakes</h3>
            <div className="space-y-4">
              {isLoading ? (
                  [...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800" />)
              ) : recentLinks?.map((link: Connection) => (
                <div key={link.id} className="flex items-center gap-4 text-xs">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-500 border border-slate-700">
                    {campusMap.get(link.fromCampusId)?.acronym[0] || '?'}
                  </div>
                  <p className="text-slate-300">
                    <span className="font-bold text-white">{campusMap.get(link.fromCampusId)?.acronym || 'N/A'}</span> linked with <span className="font-bold text-white">{campusMap.get(link.toCampusId)?.acronym || 'N/A'}</span>
                  </p>
                  <span className="ml-auto text-[10px] text-slate-600">Just now</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
