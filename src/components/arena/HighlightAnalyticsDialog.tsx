
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { HighlightStats, SocialPost } from '@/lib/types';
import { 
    BarChart3, Eye, ThumbsUp, Share2, UserPlus, 
    TrendingUp, Zap, Target, Loader2, Sparkles 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface HighlightAnalyticsDialogProps {
  post: SocialPost;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * HighlightAnalyticsDialog Component
 * ---------------------------------
 * Professional ROI dashboard for Arena creators.
 * Displays real-time results of paid highlight promotions.
 */
export function HighlightAnalyticsDialog({ post, isOpen, onClose }: HighlightAnalyticsDialogProps) {
  const { firestore } = useFirebase();

  // 1. Fetch persistent analytics document
  const statsRef = useMemoFirebase(() => {
    if (!firestore || !post.id) return null;
    return doc(firestore, 'highlight_stats', post.id);
  }, [firestore, post.id]);

  const { data: stats, isLoading } = useDoc<HighlightStats>(statsRef);

  // 2. ROI Calculations
  const delivered = post.promotionViewsDelivered || 0;
  const target = post.promotionViewsTarget || 1;
  const progress = Math.min((delivered / target) * 100, 100);
  
  const ctr = delivered > 0 ? (((stats?.likes || 0) + (stats?.shares || 0)) / delivered * 100).toFixed(1) : "0.0";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] sm:max-w-xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-10 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 pointer-events-none">
            <BarChart3 size={200} />
          </div>
          
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg">
              <TrendingUp size={28} />
            </div>
            <div>
              <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase">Highlight ROI</DialogTitle>
              <DialogDescription className="text-blue-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                Liaison Campaign Intelligence
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 bg-background space-y-10">
          {/* A. CAMPAIGN PROGRESS HUB */}
          <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deployment Status</p>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">
                        {progress >= 100 ? 'Campaign Complete' : 'Active Broadcast'}
                    </h4>
                </div>
                <span className="text-xs font-black text-blue-600 tabular-nums">{Math.round(progress)}%</span>
            </div>
            
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1 shadow-inner">
                <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <div className="flex justify-between items-center px-2">
                <p className="text-[9px] font-bold text-slate-500 italic">
                    Reached {delivered.toLocaleString()} of {target.toLocaleString()} guaranteed citizens.
                </p>
                <div className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase">
                    <Zap size={10} fill="currentColor" /> Priority Priority
                </div>
            </div>
          </div>

          {/* B. ENGAGEMENT MATRIX */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: 'Total Reach', value: stats?.views || delivered, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Yard Vibes', value: stats?.likes || 0, icon: ThumbsUp, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                { label: 'Viral Shares', value: stats?.shares || 0, icon: Share2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { label: 'New Links', value: stats?.followersGained || 0, icon: UserPlus, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' }
            ].map((metric) => (
                <div key={metric.label} className={cn("p-5 rounded-[2rem] border transition-all hover:scale-105 group", metric.bg, "border-transparent hover:border-current/10")}>
                    <metric.icon className={cn("mb-3", metric.color)} size={20} />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{metric.label}</p>
                    <p className="text-xl font-black text-foreground tabular-nums">
                        {isLoading ? '...' : metric.value.toLocaleString()}
                    </p>
                </div>
            ))}
          </div>

          {/* C. LIAISON INSIGHTS */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 p-6 opacity-10 rotate-12"><Sparkles size={80}/></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Target size={14}/></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Vibration Velocity</span>
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-black italic tracking-tighter">{ctr}%</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Conversion Score</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic font-medium">
                    "Liaison Audit: Your promotion is performing <b>{(parseFloat(ctr) > 5) ? 'above' : 'near'} average</b> for the {post.campusAcronym} hub. 
                    {parseFloat(ctr) > 5 ? ' Citizens are highly receptive to this content.' : ' Consider a more aggressive headline for your next boost.'}"
                </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-muted/20 border-t border-slate-100 dark:border-border text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Official Liaison Promotion Ledger • GH 🇬🇭</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
