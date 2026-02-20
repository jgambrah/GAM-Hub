'use client';

import React, { useState } from 'react';
import { Landmark, Tv } from 'lucide-react';
import type { User } from '@/lib/types';
import RegistryCreator from '@/components/admin/RegistryCreator';
import LiveDirector from '@/components/src/LiveDirector';

export default function RegistryDashboard({ userProfile }: { userProfile: User }) {
  const [activeTool, setActiveTool] = useState<'registry' | 'live'>('registry');

  return (
    <div className="p-4 md:p-8 bg-muted/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 dark:text-foreground">Registry Command: {userProfile.campusId?.toUpperCase()}</h1>
        </header>

        {/* SELECTOR */}
        <div className="flex gap-4 mb-10">
          <button onClick={() => setActiveTool('registry')} className={`flex-1 p-6 rounded-[2.5rem] border-2 transition-all flex items-center gap-4 ${activeTool === 'registry' ? 'bg-card border-foreground shadow-xl' : 'bg-card/50 border-transparent text-muted-foreground'}`}>
            <div className="p-3 bg-foreground text-background rounded-2xl"><Landmark /></div>
            <div className="text-left"><p className="font-black text-sm">Registry Hub</p><p className="text-[10px]">Official Notices</p></div>
          </button>
          <button onClick={() => setActiveTool('live')} className={`flex-1 p-6 rounded-[2.5rem] border-2 transition-all flex items-center gap-4 ${activeTool === 'live' ? 'bg-red-600 border-red-700 text-white shadow-xl' : 'bg-card/50 border-transparent text-muted-foreground'}`}>
            <div className="p-3 bg-white text-red-600 rounded-2xl"><Tv /></div>
            <div className="text-left"><p className="font-black text-sm">Management TV</p><p className="text-[10px]">Live Town Halls</p></div>
          </button>
        </div>

        {/* TOOL VIEWS */}
        {activeTool === 'registry' ? (
          <div className="animate-in fade-in">
             <RegistryCreator userProfile={userProfile} />
          </div>
        ) : (
          <div className="animate-in fade-in">
             <LiveDirector userProfile={userProfile} />
          </div>
        )}
      </div>
    </div>
  );
}
