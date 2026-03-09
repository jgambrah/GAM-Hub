'use client';

import React, { useState } from 'react';
import { Search, Globe, Users, ShoppingBag, Video, X, Sparkles } from 'lucide-react';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import TrendingTags from '@/components/social/TrendingTags';
import TrendingSearchTicker from '@/components/social/TrendingSearchTicker';
import UpNextPanel from '@/components/social/UpNextPanel';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'market' | 'vlogs'>('all');

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="p-8 bg-slate-950 text-white rounded-b-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <h1 className="text-4xl font-black tracking-tight italic uppercase">Explore the Yard</h1>
          
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400" size={22} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search majors, hashtags, or products..."
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
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
                { id: 'all', label: 'All Vibes', icon: Globe }, 
                { id: 'people', label: 'People', icon: Users }, 
                { id: 'market', label: 'Market', icon: ShoppingBag },
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
              <TrendingTags onTagSelect={(tag) => setSearchQuery(tag === 'All' ? '' : `#${tag.toLowerCase()}`)} />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="text-blue-600" size={20} /> Latest Discoveries
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Feed</span>
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
