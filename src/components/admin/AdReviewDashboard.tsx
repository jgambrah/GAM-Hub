'use client';

import React, { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import type { AdCampaign } from '@/lib/types';
import { 
    Megaphone, CheckCircle, XCircle, Clock, ExternalLink, 
    Video, ImageIcon, Loader2, Calendar, Target, Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function AdReviewDashboard() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'ad_campaigns'),
      where('status', '==', 'pending_review'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: pendingAds, isLoading } = useCollection<AdCampaign>(pendingQuery);

  const handleDecision = async (ad: AdCampaign, decision: 'approve' | 'reject') => {
    if (!firestore) return;
    setProcessingId(ad.id);

    try {
      const adRef = doc(firestore, 'ad_campaigns', ad.id);
      if (decision === 'approve') {
        const now = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(now.getDate() + 30);

        await updateDocumentNonBlocking(adRef, {
          status: 'active',
          startDate: serverTimestamp(),
          endDate: thirtyDaysLater.toISOString(),
          approvedAt: serverTimestamp()
        });
        toast({ title: "Ad Approved!", description: `${ad.advertiserName} is now live.` });
      } else {
        await updateDocumentNonBlocking(adRef, { status: 'rejected' });
        toast({ variant: 'destructive', title: "Ad Rejected" });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: "Decision failed" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end px-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Megaphone className="text-amber-500" /> Ad Approval Queue
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Review and launch self-serve advertiser campaigns</p>
        </div>
        <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Clock size={14} /> {pendingAds?.length || 0} Pending Review
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-[3rem]" />
          <Skeleton className="h-[400px] rounded-[3rem]" />
        </div>
      ) : pendingAds && pendingAds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pendingAds.map((ad) => (
            <Card key={ad.id} className="rounded-[3rem] overflow-hidden border-2 border-border hover:border-amber-500/30 transition-all shadow-xl">
              <div className="aspect-video relative bg-slate-950">
                {ad.mediaType === 'video' ? (
                  <video src={ad.mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  <img src={ad.mediaUrl} className="w-full h-full object-cover" alt="Ad visual" />
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-amber-500 text-white border-none">{ad.adType}</Badge>
                    <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-md border-white/10 uppercase text-[8px]">{ad.mediaType}</Badge>
                </div>
              </div>

              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden flex-shrink-0 border">
                        {ad.advertiserLogo ? <img src={ad.advertiserLogo} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-black">{ad.advertiserName[0]}</div>}
                    </div>
                    <div>
                        <h3 className="font-black text-lg leading-none">{ad.advertiserName}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{ad.submittedByEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-amber-600">GHS {ad.totalBudgetGHS}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Paid Total</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="p-4 bg-muted/50 rounded-2xl border border-border">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Headline</p>
                        <p className="font-bold text-foreground">"{ad.headline}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Globe size={10}/> Targeting</p>
                            <p className="text-xs font-black text-blue-700">{ad.campusIds.join(', ').toUpperCase()}</p>
                        </div>
                        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Target size={10}/> Goal</p>
                            <p className="text-xs font-black text-purple-700">{ad.impressionTarget ? `${ad.impressionTarget.toLocaleString()} IMP` : `${ad.clickTarget} CLICKS`}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        className="flex-1 rounded-2xl h-14 font-black text-xs uppercase"
                        onClick={() => handleDecision(ad, 'reject')}
                        disabled={processingId === ad.id}
                    >
                        {processingId === ad.id ? <Loader2 className="animate-spin" /> : <><XCircle className="mr-2 h-4 w-4" /> Reject</>}
                    </Button>
                    <Button 
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl h-14 font-black text-xs uppercase shadow-lg shadow-amber-200"
                        onClick={() => handleDecision(ad, 'approve')}
                        disabled={processingId === ad.id}
                    >
                        {processingId === ad.id ? <Loader2 className="animate-spin" /> : <><CheckCircle className="mr-2 h-4 w-4" /> Launch Campaign</>}
                    </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-32 text-center bg-card rounded-[4rem] border-4 border-dashed">
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
            <h2 className="text-xl font-black text-foreground">All Clear!</h2>
            <p className="text-muted-foreground italic">No campaigns are waiting for approval.</p>
        </div>
      )}
    </div>
  );
}
