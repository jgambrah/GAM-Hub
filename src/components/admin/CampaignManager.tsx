
'use client';

import React, { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { 
    Megaphone, Plus, Trash2, Globe, Zap, 
    Calendar, Target, CreditCard, Image as ImageIcon, 
    Video, Loader2, Save, X, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { AdCampaign } from '@/components/social/vibeAdsSchema';
import type { Campus } from '@/lib/types';

export function CampaignManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const campaignsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'ad_campaigns'), orderBy('startDate', 'desc'));
  }, [firestore]);

  const campusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'campuses'), orderBy('name', 'asc'));
  }, [firestore]);

  const { data: campaigns, isLoading } = useCollection<AdCampaign>(campaignsQuery);
  const { data: campuses } = useCollection<Campus>(campusesQuery);

  const [formData, setFormData] = useState<Partial<AdCampaign>>({
    advertiserName: '',
    headline: '',
    ctaLabel: 'Learn More',
    ctaUrl: '',
    mediaType: 'image',
    mediaUrl: '',
    thumbnailUrl: '',
    status: 'active',
    campusIds: ['all'],
    targetTags: [],
    targetMoods: ['all'],
    priority: 5,
    perUserDailyCap: 3,
    billingModel: 'cpm',
    rateGHS: 5.00
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);

    try {
      const data = {
        ...formData,
        startDate: serverTimestamp(),
        endDate: null, // Perpetual for now
        impressions: 0,
        clicks: 0,
        createdAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'ad_campaigns'), data);
      toast({ title: "Campaign Launched!", description: "The sponsored vibe is now active in the Yard." });
      setIsCreating(false);
      setFormData({});
    } catch (err) {
      toast({ variant: 'destructive', title: "Launch Failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!firestore || !confirm("Retract this campaign from the Yard?")) return;
    deleteDocumentNonBlocking(doc(firestore, 'ad_campaigns', id));
    toast({ title: "Campaign Retracted" });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="rounded-2xl font-black bg-slate-900 text-white shadow-xl">
            <Plus className="mr-2" /> Architect New Campaign
          </Button>
        )}
      </div>

      {isCreating && (
        <Card className="rounded-[3rem] border-2 border-primary/10 shadow-2xl animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="p-10 border-b bg-muted/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary text-white rounded-3xl">
                  <Megaphone size={28} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black">Campaign Architect</CardTitle>
                  <CardDescription className="font-bold uppercase tracking-widest text-[10px]">Liaison Sponsored Vibe Placement</CardDescription>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setIsCreating(false)}><X /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Identity */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-2">Advertiser Detail</h4>
                  <Input placeholder="Advertiser Name (e.g. Campus Bites)" required value={formData.advertiserName} onChange={e => setFormData({...formData, advertiserName: e.target.value})} className="rounded-2xl h-14 font-bold" />
                  <Input placeholder="Headline / Hook" required value={formData.headline} onChange={e => setFormData({...formData, headline: e.target.value})} className="rounded-2xl h-14 font-bold" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="CTA Label (e.g. Order Now)" value={formData.ctaLabel} onChange={e => setFormData({...formData, ctaLabel: e.target.value})} className="rounded-2xl h-14 font-bold" />
                    <Input placeholder="CTA URL (Link)" required value={formData.ctaUrl} onChange={e => setFormData({...formData, ctaUrl: e.target.value})} className="rounded-2xl h-14 font-bold" />
                  </div>
                </div>

                {/* 2. Creative */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest px-2">Creative Asset</h4>
                  <div className="flex gap-2 p-1.5 bg-muted rounded-2xl">
                    <button type="button" onClick={() => setFormData({...formData, mediaType: 'image'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.mediaType === 'image' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground'}`}>Image</button>
                    <button type="button" onClick={() => setFormData({...formData, mediaType: 'video'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.mediaType === 'video' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground'}`}>Video</button>
                  </div>
                  <Input placeholder={formData.mediaType === 'image' ? "Image URL" : "Video URL"} required value={formData.mediaUrl} onChange={e => setFormData({...formData, mediaUrl: e.target.value})} className="rounded-2xl h-14 font-bold" />
                  <Input placeholder="Thumbnail / Poster URL" required value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} className="rounded-2xl h-14 font-bold" />
                </div>
              </div>

              {/* 3. Targeting */}
              <div className="p-8 bg-slate-50 dark:bg-muted/30 rounded-[2.5rem] border-2 border-primary/5 space-y-6">
                <div className="flex items-center gap-2 text-primary">
                  <Target size={18} />
                  <h4 className="text-xs font-black uppercase tracking-widest">Precision Targeting</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase px-2">Campus Scope</label>
                    <Select onValueChange={val => setFormData({...formData, campusIds: [val]})}>
                      <SelectTrigger className="mt-2 rounded-2xl border-none bg-white dark:bg-slate-900 font-bold"><SelectValue placeholder="All Campuses" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Global (All)</SelectItem>{campuses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase px-2">Target Tags (Comma separated)</label>
                    <Input placeholder="food, deals, fashion" className="mt-2 rounded-2xl border-none bg-white dark:bg-slate-900 font-bold" onChange={e => setFormData({...formData, targetTags: e.target.value.split(',').map(t => t.trim())})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase px-2">Priority Weight (1-10)</label>
                    <Input type="number" min="1" max="10" defaultValue="5" className="mt-2 rounded-2xl border-none bg-white dark:bg-slate-900 font-bold" onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} />
                  </div>
                </div>
              </div>

              <Button disabled={loading} type="submit" className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" /> Deploy Campaign</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-[2.5rem]" />
        ) : campaigns?.map(camp => (
          <Card key={camp.id} className="rounded-[2.5rem] overflow-hidden border-border hover:shadow-lg transition-all group">
            <div className="flex flex-col md:flex-row">
              <div className="relative w-full md:w-64 aspect-video md:aspect-square bg-slate-900">
                <img src={camp.thumbnailUrl} alt={camp.headline} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  {camp.mediaType === 'video' ? <Video className="text-white" size={32} /> : <ImageIcon className="text-white" size={32} />}
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[8px] font-black tracking-widest">{camp.status}</Badge>
                      <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest">{camp.campusIds[0] === 'all' ? 'GLOBAL' : camp.campusIds[0]}</Badge>
                    </div>
                    <button onClick={() => handleDelete(camp.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                  <h3 className="text-2xl font-black text-foreground">{camp.headline}</h3>
                  <p className="text-sm font-bold text-muted-foreground mt-1">{camp.advertiserName}</p>
                  
                  <div className="flex gap-4 mt-6">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Impressions</p>
                      <p className="text-xl font-black">{camp.impressions?.toLocaleString() || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Clicks</p>
                      <p className="text-xl font-black text-blue-600">{camp.clicks?.toLocaleString() || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">CTR</p>
                      <p className="text-xl font-black text-emerald-500">{camp.impressions ? ((camp.clicks / camp.impressions) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex items-center justify-between border-t pt-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                    <Target size={12} />
                    <span>Tags: {camp.targetTags?.join(', ') || 'Global Run'}</span>
                  </div>
                  <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest h-auto py-2 group-hover:text-primary transition-colors">
                    View Data Audit <ExternalLink size={12} className="ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
