'use client';

import React, { useState } from 'react';
import { Search, Hash, TrendingUp, Sparkles, ShoppingBag, Users, Video, Globe } from 'lucide-react';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import TrendingTags from '@/components/social/TrendingTags';
import TrendingSearchTicker from '@/components/social/TrendingSearchTicker';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'market' | 'vlogs'>('all');

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="p-8 bg-slate-950 text-white rounded-b-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <h1 className="text-4xl font-black tracking-tight">Explore the Yard</h1>
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400" size={22} />
            <input 
              placeholder="Search majors, hashtags, or products..."
              className="w-full bg-white/5 border border-white/10 p-6 pl-16 rounded-[2.5rem] outline-none focus:bg-white focus:text-slate-900 transition-all font-bold text-lg text-white"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* TAB SELECTOR */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[{ id: 'all', label: 'All Vibes', icon: Globe }, { id: 'people', label: 'People', icon: Users }, { id: 'market', label: 'Market', icon: ShoppingBag }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-12 space-y-12">
        <TrendingSearchTicker onSelect={(keyword: string) => setSearchQuery(keyword)} />
        <section className="px-6">
          <TrendingTags />
          <CampusPulseFeed searchQuery={searchQuery} tab={activeTab} />
        </section>
      </div>
    </div>
  );
}
