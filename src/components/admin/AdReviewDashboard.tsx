'use client';

/**
 * AdReviewDashboard
 * -----------------
 * Liaison-only admin panel. Accessible only to users where isAdmin === true.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AdCampaign } from '@/components/social/vibeAdsSchema';
import {
  Clock, CheckCircle2, XCircle, PauseCircle, PlayCircle,
  BarChart2, Eye, MousePointerClick, Megaphone, Calendar,
  ChevronDown, ChevronUp, Tag, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type CampaignWithId = AdCampaign & { id: string };
type StatusFilter = 'all' | 'pending_review' | 'active' | 'paused' | 'ended' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  active:         'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  paused:         'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ended:          'bg-slate-100 text-slate-500',
  rejected:       'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function AdReviewDashboard() {
  const { firestore } = useFirebase();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [campaigns, setCampaigns]     = useState<CampaignWithId[]>([]);
  const [filter, setFilter]           = useState<StatusFilter>('pending_review');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const q = query(collection(firestore, 'ad_campaigns'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignWithId)));
      setIsLoading(false);
    });
    return () => unsub();
  }, [firestore, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground font-bold">Access denied.</p>
      </div>
    );
  }

  const filtered = campaigns.filter(c => filter === 'all' || c.status === filter);
  const pendingCount = campaigns.filter(c => c.status === 'pending_review').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-6 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 rounded-2xl shadow-lg">
            <Megaphone size={24} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Ad Campaign Manager</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Liaison National Hub</p>
          </div>
        </div>
        <div className="flex gap-2 bg-muted p-1 rounded-2xl overflow-x-auto scrollbar-none max-w-md">
          {(['pending_review','active','paused','all'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all',
                filter === s ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:bg-muted/80'
              )}
            >
              {s.replace('_', ' ')}
              {s === 'pending_review' && pendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-white rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground font-bold italic animate-pulse">Synchronizing with Hub…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground font-bold italic bg-muted/20 rounded-[3rem] border-2 border-dashed">No campaigns found.</div>
        ) : (
          filtered.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedId === campaign.id}
              onToggleExpand={() => setExpandedId(prev => prev === campaign.id ? null : campaign.id)}
              firestore={firestore}
              toast={toast}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CampaignCard({ campaign, isExpanded, onToggleExpand, firestore, toast }: any) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState(String(campaign.priority || 5));
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const campRef = doc(firestore, 'ad_campaigns', campaign.id);

  const handleApprove = async () => {
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: 'Schedule Required', description: 'Please set start and end dates.' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(campRef, {
        status: 'active',
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        priority: Number(priority),
        approvedAt: serverTimestamp(),
      });
      toast({ title: "Campaign Launched! 🚀" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Approval Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ variant: 'destructive', title: 'Reason Required' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(campRef, { status: 'rejected', rejectionReason, rejectedAt: serverTimestamp() });
      toast({ title: "Campaign Rejected", variant: "destructive" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Rejection Failed' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(
      'bg-card border-2 rounded-[2.5rem] overflow-hidden transition-all duration-300',
      campaign.status === 'pending_review' ? 'border-amber-300 shadow-xl shadow-amber-50' : 'border-border'
    )}>
      <div className="flex items-center gap-6 p-6 cursor-pointer" onClick={onToggleExpand}>
        <div className="w-20 h-20 rounded-2xl bg-slate-900 overflow-hidden flex-shrink-0 border-4 border-white shadow-md relative">
          <img src={campaign.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          {campaign.mediaType === 'video' && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle className="text-white" size={24} /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-black text-lg truncate">{campaign.advertiserName}</h3>
            <Badge className={cn('uppercase text-[8px] tracking-widest', STATUS_COLORS[campaign.status])}>
              {campaign.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm font-bold text-foreground line-clamp-1">{campaign.headline}</p>
          <div className="flex items-center gap-4 mt-2">
             <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <Eye size={12}/> {campaign.impressions || 0}
             </div>
             <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <MousePointerClick size={12}/> {campaign.clicks || 0}
             </div>
             <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                GHS {campaign.totalBudgetGHS} • {campaign.campusIds?.join(', ').toUpperCase()}
             </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="text-muted-foreground" /> : <ChevronDown className="text-muted-foreground" />}
      </div>

      {isExpanded && (
        <div className="p-8 border-t bg-muted/10 space-y-8 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Creative Review</p>
              <div className="aspect-video rounded-[2rem] overflow-hidden bg-slate-950 border-4 border-white shadow-xl">
                {campaign.mediaType === 'video' ? <video src={campaign.mediaUrl} className="w-full h-full object-cover" controls muted /> : <img src={campaign.mediaUrl} className="w-full h-full object-cover" />}
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border text-xs space-y-2 font-medium">
                <p><b>Package:</b> {campaign.adType?.toUpperCase()} @ GHS {campaign.rateGHS}/unit</p>
                <p><b>Budget:</b> GHS {campaign.totalBudgetGHS}</p>
                <p><b>Paystack Ref:</b> <span className="font-mono text-[10px]">{campaign.paystackReference}</span></p>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Liaison Control Panel</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl border-2" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Priority (1-10)</Label>
                <Input type="number" min={1} max={10} value={priority} onChange={e => setPriority(e.target.value)} className="rounded-xl border-2" />
              </div>

              {campaign.status === 'pending_review' ? (
                <div className="space-y-4 pt-4 border-t">
                  <Button onClick={handleApprove} disabled={isSaving} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-lg">
                    {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 className="mr-2" /> Approve & Deploy</>}
                  </Button>
                  <div className="flex gap-2">
                    <Input placeholder="Rejection reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="rounded-xl border-none bg-red-50 dark:bg-red-900/20" />
                    <Button onClick={handleReject} disabled={isSaving} variant="destructive" className="rounded-xl font-black">Reject</Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-100 dark:border-blue-800 text-center">
                   <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Active Intelligence</p>
                   <p className="text-xs font-bold text-blue-800 dark:text-blue-200 mt-1">This campaign is managed by the automated Hub scheduler.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
