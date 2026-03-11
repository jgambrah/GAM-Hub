
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import CampusPulseFeed from '@/components/social/CampusPulseFeed';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Hash, TrendingUp, Info } from 'lucide-react';
import TrendingTags from '@/components/social/TrendingTags';
import UpNextPanel from '@/components/social/UpNextPanel';

/**
 * HashtagFeedPage Component
 * 
 * A professional-grade feed dedicated to a specific #hashtag.
 * Leverages the Blended Retrieval system with a mandatory tag constraint.
 */
export default function HashtagFeedPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isUserLoading } = useAuth();
  const tag = params.tag as string;

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
      <div className="max-w-7xl mx-auto pt-6 space-y-8 px-4">
        {/* HEADER */}
        <div className="flex flex-col gap-6">
            <Button 
                variant="ghost" 
                onClick={() => router.back()} 
                className="w-fit rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
            >
                <ChevronLeft size={16} className="mr-1" /> Back to Yard
            </Button>

            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 p-8 opacity-10 rotate-12">
                    <Hash size={150} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-blue-400" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hashtag Hub</span>
                    </div>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase">#{tag}</h1>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
                        Global vibrations from across the National Hub
                    </p>
                </div>
            </div>
        </div>

        {/* RELATED TAGS */}
        <TrendingTags activeTag={tag} useLinks={true} />

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full space-y-8">
            {/* THE FEED */}
            <CampusPulseFeed 
                activeCampusId={user.campusId} 
                activeTag={tag.toLowerCase()} 
            />
          </div>

          {/* SMART QUEUE SIDEBAR */}
          <aside className="hidden lg:block w-full max-w-[350px] sticky top-24 space-y-6">
            <UpNextPanel />
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2.5rem] border-2 border-dashed border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><Info size={18} /></div>
                <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest text-[10px]">Tag Intelligence</h4>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                This feed is strictly filtered for the <b>#{tag}</b> signal. Autoplay is currently optimized for this narrative thread. 📡🇬🇭
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
