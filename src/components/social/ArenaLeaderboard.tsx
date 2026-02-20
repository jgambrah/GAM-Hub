'use client';

import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Swords, Trophy } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export default function ArenaLeaderboard() {
  const { firestore } = useFirebase();

  const rankDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'platform_stats', 'arena_rankings');
  }, [firestore]);
  
  const { data: rankings, isLoading } = useDoc(rankDocRef);

  if (isLoading || !rankings) {
      return (
          <div className="mx-4 mb-10">
              <Skeleton className="h-40 w-full rounded-[3.5rem] bg-slate-900" />
          </div>
      );
  }

  const scores = rankings.scores || {};
  
  // 1. THE FILTER: Only accept valid numbers and ignore system fields
  const sortedStats = Object.entries(scores)
    .filter(([id, burns]) => {
        const isSystemField = ['lastUpdate', 'name', 'type', 'value'].includes(id.toLowerCase());
        return typeof burns === 'number' && !isSystemField;
    })
    .map(([id, burns]: any) => ({ 
      id: id.toUpperCase(), 
      burns: burns,
      color: id === 'gh' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-blue-600' 
    }))
    .sort((a, b) => b.burns - a.burns);

  const maxValue = sortedStats[0]?.burns || 1;

  return (
    <div className="mx-4 mb-10 p-1 bg-gradient-to-br from-red-600 via-orange-500 to-amber-400 rounded-[3.5rem] shadow-2xl">
      <div className="bg-slate-950 rounded-[3.3rem] p-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-white italic">VIBE WAR: LIVE</h2>
            {sortedStats[0] && (
              <div className="bg-white/10 p-3 rounded-2xl border border-white/10 text-white flex items-center gap-3">
                 <Trophy className="text-amber-400" />
                 <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">King of the Yard</p>
                    <p className="text-lg font-black uppercase text-amber-400">{sortedStats[0].id}</p>
                 </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {sortedStats.map((item, i) => (
              <div key={item.id} className="space-y-1">
                <div className="flex justify-between items-end px-2">
                  <span className="text-white font-black uppercase text-[10px] tracking-widest">
                    {item.id} {item.id === 'GH' ? '🇬🇭 (Liaison)' : '🛡️'}
                  </span>
                  <span className="text-amber-400 font-mono text-xs font-bold">{item.burns.toLocaleString()} BURNS</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                   <div 
                     className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out`} 
                     style={{ width: `${(item.burns / maxValue) * 100}%` }}
                   />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
