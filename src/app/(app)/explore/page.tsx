
'use client';

import React, { useState, useEffect } from 'react';
import { Search, Globe, Users, ShoppingBag, Video, X, Sparkles, Hash, Loader2, Share2, Zap, ShoppingCart } from 'lucide-react';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import TrendingTags from '@/components/social/TrendingTags';
import TrendingSearchTicker from '@/components/social/TrendingSearchTicker';
import UpNextPanel from '@/components/social/UpNextPanel';
import { searchHashtags } from '@/lib/hashtag-utils';
import { useFirebase } from '@/firebase';

export default function ExplorePage() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'market' | 'vlogs' | 'shoppable'>('all');
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

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="p-8 bg-slate-950 text-white rounded-b-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-black tracking-tight italic uppercase">Explore the Yard</h1>
            <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                <Zap size={14} className="text-blue-400" fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Hybrid Search</span>
            </div>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400" size={22} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, hashtags, or people..."
              className="w-full bg-white/5 border border-white/10 p-6 pl-16 rounded-[2.5rem] outline-none focus:bg-white focus:text-slate-900 transition-all font-bold text-lg text-white"
            />
            {searchQuery && (
                <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all"
                >
                    <X size={16} />
                </button>
            )}

            {/* AUTOCOMPLETE DROPDOWN */}
            {hashtagResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-4 z-[100] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-2 mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {hashtagResults[0].isRelated ? 'Discover Related Vibes' : 'Matching Hashtags'}
                        </span>
                        {isSearchingTags && <Loader2 className="animate-spin text-indigo-500" size={14} />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {hashtagResults.map((tag) => (
                            <button
                                key={tag.tag}
                                onClick={() => { setSearchQuery(`#${tag.tag}`); setHashtagResults([]); }}
                                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all active:scale-95 group text-slate-900"
                            >
                                <div className="flex items-center gap-3">
                                    {tag.isRelated ? <Share2 size={12} className="text-indigo-400" /> : <Hash size={16} className="text-indigo-500 group-hover:text-white" />}
                                    <span className="font-black text-sm uppercase tracking-wide">{tag.tag}</span>
                                    {tag.isRelated && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">Related</span>}
                                </div>
                                <span className="text-[10px] font-bold opacity-40 group-hover:opacity-80">
                                    {tag.isRelated ? `${tag.weight} links` : `${tag.postCount.toLocaleString()} posts`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
                { id: 'all', label: 'All Vibes', icon: Globe }, 
                { id: 'shoppable', label: 'Shop From Videos', icon: ShoppingBag }, 
                { id: 'people', label: 'People', icon: Users }, 
                { id: 'market', label: 'Market', icon: ShoppingCart },
                { id: 'vlogs', label: 'Vlogs', icon: Video }
            ].map(t => (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id as any)} 
                className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 px-4">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-12">
            <TrendingSearchTicker onSelect={setSearchQuery} />
            
            <section className="space-y-8">
              <TrendingTags onTagSelect={(tag) => setSearchQuery(tag === 'All' ? '' : `#${tag.toLowerCase()}`)} activeTag={searchQuery} />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        {activeTab === 'shoppable' ? <ShoppingBag className="text-blue-600" size={20} /> : <Sparkles className="text-blue-600" size={20} />}
                        {activeTab === 'shoppable' ? 'Shoppable Videos' : 'Latest Discoveries'}
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {activeTab === 'shoppable' ? 'Commerce Engine Active' : 'Hybrid Discovery Engine Active'}
                    </span>
                </div>
                
                <CampusPulseFeed 
                    activeCampusId="all" 
                    searchQuery={searchQuery} 
                    tab={activeTab as any} 
                />
              </div>
            </section>
          </div>

          <aside className="hidden lg:block w-full max-w-[350px] sticky top-24">
            <UpNextPanel />
          </aside>
        </div>
      </div>
    </div>
  );
}
