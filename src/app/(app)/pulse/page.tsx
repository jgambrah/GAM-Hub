'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Plus, Video, Camera, Type, Info, Sparkles, Search, X } from 'lucide-react';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import ShareVibeModal from '@/components/social/ShareVibeModal';
import { VictoryTakeover } from '@/components/politics/VictoryTakeover';
import { Skeleton } from '@/components/ui/skeleton';
import TrendingSearchTicker from '@/components/social/TrendingSearchTicker';

/**
 * ElectionWinnerWatcher Component (Internal to Pulse)
 * Triggers the Victory Takeover overlay if a result is active.
 */
function ElectionWinnerWatcher() {
  const { user, isTokenReady } = useAuth();
  const { firestore } = useFirebase();
  const [winner, setWinner] = useState<any>(null);

  const winnerQuery = useMemoFirebase(() => {
    if (!firestore || !user?.campusId || !isTokenReady) return null;
    return query(
      collection(firestore, 'campus_pulse'),
      where('campusId', '==', user.campusId),
      where('type', '==', 'election_winner'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [firestore, user?.campusId, user?.id, isTokenReady]);

  const { data } = useCollection(winnerQuery);

  React.useEffect(() => {
    if (data && data.length > 0) {
      const post = data[0];
      const dismissed = localStorage.getItem(`dismissed_winner_${post.id}`);
      if (!dismissed) {
        setWinner({
          id: post.id,
          name: post.winnerName,
          image: post.winnerPhoto,
          position: post.position,
          campusId: post.campusId.toUpperCase(),
          victoryMessage: post.content
        });
      }
    }
  }, [data]);

  if (!winner) return null;

  return (
    <VictoryTakeover 
      winner={winner} 
      onDismiss={() => {
        localStorage.setItem(`dismissed_winner_${winner.id}`, 'true');
        setWinner(null);
      }} 
    />
  );
}

export default function PulsePage() {
  const { user, isUserLoading } = useAuth();
  const [isVibeModalOpen, setVibeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (isUserLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <Skeleton className="h-40 w-full rounded-[3rem]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-[2.5rem]" />
          <Skeleton className="h-96 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <ElectionWinnerWatcher />

      <div className="max-w-4xl mx-auto pt-6 space-y-8 px-4">
        {/* HEADER: THE CAMPUS HEARTBEAT */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 p-8 opacity-10"><MessageSquare size={150} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-blue-400" size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Live Vibration</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">Campus Pulse</h1>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
              Live from {user.campusAcronym || 'The Yard'}
            </p>
          </div>
        </div>

        {/* SEARCH & TRENDS */}
        <div className="space-y-4">
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search vibes, hashtags, or people..."
                    className="w-full bg-white border border-slate-200 p-6 pl-16 rounded-[2.5rem] outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm font-bold text-lg text-slate-900 transition-all"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-all"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
            <TrendingSearchTicker onSelect={setSearchQuery} />
        </div>

        {/* FEATURE NARRATIVE: THE LIAISON DECREE */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2.5rem] border-2 border-dashed border-blue-200 dark:border-blue-800 flex items-start gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
            <Info size={24} />
          </div>
          <div>
            <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest text-xs">The Pulse Protocol</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
              This is the heartbeat of your campus. While <b>The Arena</b> is for national competition, the <b>Pulse</b> is for internal vibes, SRC news, and local community updates. Share your frequency! 📡🇬🇭
            </p>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg border-2 border-white"><Video size={18} /></div>
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg border-2 border-white"><Camera size={18} /></div>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg border-2 border-white"><Type size={18} /></div>
            </div>
            <p className="text-sm font-black text-slate-900">Broadcasting to the Yard</p>
          </div>
          
          <button 
            onClick={() => setVibeModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Share Vibe
          </button>
        </div>

        {/* THE FEED */}
        <CampusPulseFeed activeCampusId={user.campusId} searchQuery={searchQuery} />
      </div>

      {isVibeModalOpen && (
        <ShareVibeModal 
          userProfile={user} 
          onClose={() => setVibeModalOpen(false)} 
        />
      )}
    </div>
  );
}
