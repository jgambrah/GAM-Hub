'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Plus, Video, Camera, Type, Info, Sparkles, Search, X, Hash, Share2, Loader2 } from 'lucide-react';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import ShareVibeModal from '@/components/social/ShareVibeModal';
import UpNextPanel from '@/components/social/UpNextPanel';
import { VictoryTakeover } from '@/components/politics/VictoryTakeover';
import { Skeleton } from '@/components/ui/skeleton';
import TrendingSearchTicker from '@/components/social/TrendingSearchTicker';
import { searchHashtags } from '@/lib/hashtag-utils';
import { cn } from '@/lib/utils';

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
      const post = data[0] as any;
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
  const { firestore } = useFirebase();
  const [isVibeModalOpen, setVibeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hashtagResults, setHashtagResults] = useState<any[]>([]);
  const [isSearchingTags, setIsSearchingTags] = useState(false);

  // 🏷️ HASHTAG AUTOCOMPLETE ENGINE
  useEffect(() => {
    if (searchQuery.startsWith('#') && searchQuery.length > 1 && firestore) {
        setIsSearchingTags(true);
        const timer = setTimeout(async () => {
            // GRAPH UPGRADE: Set includeRelated to true for smarter suggestions
            const results = await searchHashtags(firestore, searchQuery, true);
            setHashtagResults(results);
            setIsSearchingTags(false);
        }, 300);
        return () => clearTimeout(timer);
    } else {
        setHashtagResults([]);
        setIsSearchingTags(false);
    }
  }, [searchQuery, firestore]);

  if (isUserLoading || !user) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <Skeleton className="h-40 w-full rounded-[3rem]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96 rounded-[2.5rem]" />
            <Skeleton className="h-96 rounded-[2.5rem]" />
          </div>
          <Skeleton className="h-[600px] rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <ElectionWinnerWatcher />

      <div className="max-w-7xl mx-auto pt-6 space-y-8 px-4">
        {/* HEADER */}
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

        {/* SEARCH & AUTOCOMPLETE */}
        <div className="space-y-4 relative">
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

            {/* AUTOCOMPLETE DROPDOWN */}
            {hashtagResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 z-[100] bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {hashtagResults[0].isRelated ? 'Topic Expansion suggestions' : 'Hashtag Suggestions'}
                        </span>
                        {isSearchingTags && <Loader2 className="animate-spin text-slate-300" size={12} />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {hashtagResults.map((tag) => (
                            <button
                                key={tag.tag}
                                onClick={() => setSearchQuery(`#${tag.tag}`)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-indigo-600 rounded-2xl transition-all active:scale-95 group border border-transparent hover:border-indigo-100"
                            >
                                {tag.isRelated ? <Share2 size={12} className="text-indigo-400" /> : <Hash size={14} className="text-slate-400 group-hover:text-indigo-500" />}
                                <span className="font-black text-xs uppercase tracking-widest">{tag.tag}</span>
                                <span className="text-[10px] font-bold opacity-40">
                                    {tag.isRelated ? `${tag.weight}` : tag.postCount.toLocaleString()}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <TrendingSearchTicker onSelect={setSearchQuery} />
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-8">
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

          {/* SMART QUEUE SIDEBAR */}
          <aside className="hidden lg:block w-full max-w-[350px] sticky top-24 space-y-6">
            <UpNextPanel />
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2.5rem] border-2 border-dashed border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><Info size={18} /></div>
                <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest text-[10px]">Pulse Protocol</h4>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                The smart queue finds similar vibrations based on your campus, interests, and hashtags. 📡🇬🇭
              </p>
            </div>
          </aside>
        </div>
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
