'use client';

/**
 * AdvertiseOnYard
 * ---------------
 * Self-serve advertiser portal. Any business can:
 *   1. Fill in their campaign details + upload creative
 *   2. Choose a tier and budget
 *   3. Pay via Paystack (uses the existing payment architecture)
 *   4. Campaign is created in Firestore with status: 'pending_review'
 *   5. Liaison reviews and approves via the AdReviewDashboard
 *   6. On approval, status flips to 'active' and the ad goes live
 */

import React, { useState, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { usePaystackPayment } from 'react-paystack';
import { cn } from '@/lib/utils';
import {
  Megaphone, Image as ImageIcon, Video, ChevronRight,
  CheckCircle2, Upload, Loader2, Info, Zap, Star, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// ─── Pricing tiers ────────────────────────────────────────────────────────────
const TIERS = [
  {
    id:          'standard',
    name:        'Standard',
    icon:        Star,
    color:       'border-slate-200 bg-slate-50 dark:bg-slate-900',
    activeColor: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
    description: 'Image ad in the vibe feed',
    mediaTypes:  ['image'] as const,
    rateLabel:   'GHS 3 per 1,000 impressions',
    packages: [
      { impressions: 5_000,  priceGHS: 15,   label: '5K impressions'  },
      { impressions: 20_000, priceGHS: 50,   label: '20K impressions' },
      { impressions: 50_000, priceGHS: 110,  label: '50K impressions' },
    ],
  },
  {
    id:          'premium',
    name:        'Premium',
    icon:        Zap,
    color:       'border-slate-200 bg-slate-50 dark:bg-slate-900',
    activeColor: 'border-purple-500 bg-purple-50 dark:bg-purple-950',
    description: 'Autoplay video ad in the vibe feed',
    mediaTypes:  ['video'] as const,
    rateLabel:   'GHS 8 per 1,000 impressions',
    packages: [
      { impressions: 5_000,  priceGHS: 40,  label: '5K impressions'  },
      { impressions: 20_000, priceGHS: 140, label: '20K impressions' },
      { impressions: 50_000, priceGHS: 320, label: '50K impressions' },
    ],
  },
  {
    id:          'sponsored_vibe',
    name:        'Sponsored Vibe',
    icon:        Crown,
    color:       'border-slate-200 bg-slate-50 dark:bg-slate-900',
    activeColor: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
    description: 'Your video plays IN the vibe queue between songs',
    mediaTypes:  ['video'] as const,
    rateLabel:   'GHS 1.50 per click — high-intent students',
    packages: [
      { clicks: 100,  priceGHS: 150,  label: '100 clicks'  },
      { clicks: 500,  priceGHS: 650,  label: '500 clicks'  },
      { clicks: 1000, priceGHS: 1200, label: '1,000 clicks' },
    ],
  },
] as const;

type TierId = typeof TIERS[number]['id'];

const CAMPUSES = [
  { id: 'all',   label: 'All Campuses' },
  { id: 'ug',    label: 'University of Ghana' },
  { id: 'knust', label: 'KNUST' },
  { id: 'ucc',   label: 'UCC' },
  { id: 'uds',   label: 'UDS' },
  { id: 'uew',   label: 'UEW' },
];

export default function AdvertiseOnYard() {
  const { firestore, storage } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<'details' | 'targeting' | 'budget' | 'review' | 'done'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [advertiserName, setAdvertiserName] = useState('');
  const [headline, setHeadline]             = useState('');
  const [body, setBody]                     = useState('');
  const [ctaLabel, setCtaLabel]             = useState('Learn More');
  const [ctaUrl, setCtaUrl]                 = useState('');
  const [selectedTier, setSelectedTier]     = useState<TierId>('standard');
  const [selectedPackageIdx, setSelectedPackageIdx] = useState(0);
  const [selectedCampuses, setSelectedCampuses]     = useState<string[]>(['all']);
  const [mediaFile, setMediaFile]           = useState<File | null>(null);
  const [logoFile, setLogoFile]             = useState<File | null>(null);
  const [mediaPreview, setMediaPreview]     = useState<string | null>(null);
  const [logoPreview, setLogoPreview]       = useState<string | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef  = useRef<HTMLInputElement>(null);

  const tier = TIERS.find(t => t.id === selectedTier)!;
  const pkg  = (tier.packages as any[])[selectedPackageIdx];

  const paystackConfig = {
    reference: `AD_${Date.now()}`,
    email: user?.email || 'advertiser@example.com',
    amount: pkg.priceGHS * 100,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
    metadata: {
      custom_fields: [
        { display_name: 'Advertiser',  variable_name: 'advertiser',  value: advertiserName },
        { display_name: 'Ad Tier',     variable_name: 'tier',        value: selectedTier },
        { display_name: 'Package',     variable_name: 'package',     value: pkg.label },
      ],
    }
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const toggleCampus = (id: string) => {
    if (id === 'all') { setSelectedCampuses(['all']); return; }
    setSelectedCampuses(prev => {
      const withoutAll = prev.filter(c => c !== 'all');
      if (withoutAll.includes(id)) {
        const next = withoutAll.filter(c => c !== id);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, id];
    });
  };

  const createCampaignAfterPayment = async (reference: string) => {
    if (!firestore || !storage) return;
    setIsSubmitting(true);

    try {
      let mediaUrl = '';
      let thumbnailUrl = '';
      if (mediaFile) {
        const mediaRef = ref(storage, `ad_creatives/${Date.now()}_${mediaFile.name}`);
        await uploadBytes(mediaRef, mediaFile);
        mediaUrl = await getDownloadURL(mediaRef);
        thumbnailUrl = mediaUrl; 
      }

      let advertiserLogo = '';
      if (logoFile) {
        const logoRef = ref(storage, `ad_logos/${Date.now()}_${logoFile.name}`);
        await uploadBytes(logoRef, logoFile);
        advertiserLogo = await getDownloadURL(logoRef);
      }

      const billingModel = selectedTier === 'sponsored_vibe' ? 'cpc' : 'cpm';
      const adType = selectedTier === 'standard' ? 'feed_image' : selectedTier === 'premium' ? 'feed_video' : 'vibe_slot';

      const dailyCap = billingModel === 'cpm' ? Math.ceil(pkg.impressions / 30) : Math.ceil((pkg.clicks ?? 0) / 30);

      await addDoc(collection(firestore, 'ad_campaigns'), {
        advertiserName,
        advertiserLogo,
        submittedByUserId: user?.id ?? null,
        submittedByEmail:  user?.email ?? null,
        headline,
        body,
        ctaLabel,
        ctaUrl,
        mediaType:     tier.mediaTypes[0],
        mediaUrl,
        thumbnailUrl,
        adType,
        campusIds:   selectedCampuses,
        targetTags:  [],
        targetMoods: [],
        status: 'pending_review',
        billingModel,
        rateGHS:           tier.id === 'sponsored_vibe' ? 1.5 : tier.id === 'premium' ? 0.008 : 0.003,
        totalBudgetGHS:    pkg.priceGHS,
        totalSpendGHS:     0,
        impressionTarget:  pkg.impressions ?? null,
        clickTarget:       pkg.clicks ?? null,
        dailyImpressionCap: dailyCap,
        perUserDailyCap:   3,
        priority:          5,
        startDate:   null,
        endDate:     null,
        impressions: 0,
        clicks:      0,
        paystackReference: reference,
        paidAt:  serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setStep('done');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Submission failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = () => {
    if (!user?.email) {
      toast({ variant: 'destructive', title: 'Please log in to advertise.' });
      return;
    }
    initializePayment({
        onSuccess: (response: any) => {
            createCampaignAfterPayment(response.reference);
        },
        onClose: () => {
            toast({ title: 'Payment cancelled' });
        }
    });
  };

  if (step === 'done') return <SuccessScreen advertiserName={advertiserName} />;

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-2xl">
            <Megaphone size={20} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="font-black text-lg text-foreground">Advertise on The Yard</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Reach students across campus</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 pb-4">
          <StepBar current={step} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {step === 'details' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <SectionHeading icon={<ImageIcon size={18} />} title="Your Ad Creative" />
            <Field label="Business / Brand name *">
              <Input value={advertiserName} onChange={e => setAdvertiserName(e.target.value)} placeholder="e.g. Campus Bites" />
            </Field>
            <Field label="Headline *" hint="Keep it punchy — 60 chars max">
              <Input value={headline} onChange={e => setHeadline(e.target.value.slice(0, 60))} placeholder="25% off all burgers this week 🍔" />
            </Field>
            <Field label="Supporting copy (optional)">
              <Textarea value={body} onChange={e => setBody(e.target.value.slice(0, 120))} placeholder="Valid at all locations until Sunday." rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CTA Button label *"><Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} /></Field>
              <Field label="Destination URL *"><Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://yourbrand.com" /></Field>
            </div>
            <Field label="Ad creative (image or video) *">
              <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaPick} />
              {!mediaPreview ? (
                <button type="button" onClick={() => mediaInputRef.current?.click()} className="w-full aspect-video rounded-2xl border-2 border-dashed border-border hover:border-amber-400 bg-muted/40 flex flex-col items-center justify-center gap-2 transition-all">
                  <Upload size={28} className="text-muted-foreground" />
                  <span className="text-sm font-bold text-muted-foreground">Upload visual</span>
                </button>
              ) : (
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 cursor-pointer" onClick={() => mediaInputRef.current?.click()}>
                  {mediaFile?.type.startsWith('video') ? <video src={mediaPreview} className="w-full h-full object-cover" muted /> : <img src={mediaPreview} alt="preview" className="w-full h-full object-cover" />}
                </div>
              )}
            </Field>
            <Button className="w-full" size="lg" disabled={!advertiserName || !headline || !ctaUrl || !mediaFile} onClick={() => setStep('targeting')}>Continue <ChevronRight size={16} /></Button>
          </section>
        )}

        {step === 'targeting' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <SectionHeading icon={<Megaphone size={18} />} title="Audience Targeting" />
            <Field label="Campus targeting">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPUSES.map(c => (
                  <button key={c.id} onClick={() => toggleCampus(c.id)} className={cn('px-3 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all text-left', selectedCampuses.includes(c.id) ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-border bg-muted/40 text-muted-foreground')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">Back</Button>
              <Button onClick={() => setStep('budget')} className="flex-1">Continue <ChevronRight size={16} /></Button>
            </div>
          </section>
        )}

        {step === 'budget' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <SectionHeading icon={<Zap size={18} />} title="Tier & Budget" />
            <div className="space-y-3">
              {TIERS.map(t => (
                <button key={t.id} onClick={() => { setSelectedTier(t.id); setSelectedPackageIdx(0); }} className={cn('w-full text-left p-4 rounded-2xl border-2 transition-all', selectedTier === t.id ? t.activeColor : t.color)}>
                  <div className="flex items-center gap-3">
                    <t.icon size={18} className={selectedTier === t.id ? 'text-amber-500' : 'text-muted-foreground'} />
                    <div className="flex-1 text-sm font-black">{t.name}</div>
                    <span className="text-[10px] font-bold">{t.rateLabel}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {tier.packages.map((p, i) => (
                <button key={i} onClick={() => setSelectedPackageIdx(i)} className={cn('p-3 rounded-2xl border-2 text-center transition-all', selectedPackageIdx === i ? 'border-amber-500 bg-amber-50' : 'border-border')}>
                  <p className="font-black">GHS {p.priceGHS}</p>
                  <p className="text-[8px] uppercase font-bold">{p.label}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-6">
              <Button variant="outline" onClick={() => setStep('targeting')} className="flex-1">Back</Button>
              <Button onClick={() => setStep('review')} className="flex-1">Review Order <ChevronRight size={16} /></Button>
            </div>
          </section>
        )}

        {step === 'review' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <SectionHeading icon={<CheckCircle2 size={18} />} title="Finalize & Pay" />
            <div className="rounded-3xl border overflow-hidden bg-card">
                {mediaPreview && (
                    <div className="aspect-video relative bg-slate-900">
                        {mediaFile?.type.startsWith('video') ? <video src={mediaPreview} className="w-full h-full object-cover" muted /> : <img src={mediaPreview} alt="" className="w-full h-full object-cover" />}
                    </div>
                )}
                <div className="p-6">
                    <p className="font-black text-lg">{headline}</p>
                    <p className="text-sm text-muted-foreground mt-1">{advertiserName} • {tier.name}</p>
                </div>
            </div>
            <Button onClick={handlePay} disabled={isSubmitting} className="w-full h-16 rounded-2xl font-black text-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xl">
                {isSubmitting ? <Loader2 className="animate-spin" /> : `Pay GHS ${pkg.priceGHS} with Paystack`}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function StepBar({ current }: { current: string }) {
  const steps = ['details', 'targeting', 'budget', 'review'];
  const idx = steps.indexOf(current);
  return (
    <div className="flex gap-1">
      {steps.map((s, i) => (
        <div key={s} className={cn('h-1 rounded-full flex-1 transition-all duration-500', i <= idx ? 'bg-amber-500' : 'bg-muted')} />
      ))}
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2"><div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600">{icon}</div><h2 className="font-black text-xl">{title}</h2></div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="font-bold text-sm">{label}</Label>{hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}{children}</div>;
}

function SuccessScreen({ advertiserName }: { advertiserName: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">✨</div>
        <h1 className="font-black text-3xl">Payment Confirmed!</h1>
        <p className="text-muted-foreground">Your campaign for <span className="font-bold text-foreground">{advertiserName}</span> has been submitted. Liaison will approve it within 24 hours.</p>
        <Button asChild className="rounded-2xl px-10 h-14 font-black"><a href="/dashboard">Back to the Yard</a></Button>
      </div>
    </div>
  );
}
