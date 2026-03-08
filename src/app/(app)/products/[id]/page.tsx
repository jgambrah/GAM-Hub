'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ShieldCheck, Video, PlayCircle, Star, ShoppingBag, Youtube } from 'lucide-react';
import Image from 'next/image';
import ReactPlayer from 'react-player';
import { OrderConfirmationDialog } from '@/components/orders/OrderConfirmationDialog';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const id = params.id as string;
  const [isOrderDialogOpen, setIsOrderDialogOpen] = React.useState(false);

  const productRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'products', id);
  }, [firestore, id]);

  const { data: product, isLoading } = useDoc<Product>(productRef);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Skeleton className="aspect-square w-full rounded-[3rem]" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="p-6 bg-muted rounded-full mb-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Listing not found</h2>
        <p className="text-muted-foreground mt-2 max-w-xs">The item you are looking for may have been removed or sold out.</p>
        <Button variant="link" onClick={() => router.push('/products')} className="mt-4 font-bold text-primary">Browse Marketplace</Button>
      </div>
    );
  }

  const isService = product.productType === 'service';
  const hasVideo = !!(product.videoUrl || product.nativeVideoUrl);
  const isYoutube = !!product.videoUrl && (product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be'));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24">
      <Button variant="ghost" onClick={() => router.back()} className="mb-8 rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors">
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Market
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* LEFT SIDE: MEDIA SUITE */}
        <div className="space-y-8">
          <div className="relative aspect-square rounded-[3.5rem] overflow-hidden border-8 border-white shadow-2xl bg-muted group">
            <Image 
              src={product.imageUrl} 
              alt={product.name} 
              fill 
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              priority
              data-ai-hint={product.imageHint}
            />
            {isService && (
                <div className="absolute top-8 left-8 z-10">
                    <div className="bg-blue-600 text-white font-black text-xs tracking-widest px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-white/20 backdrop-blur-sm uppercase">VERIFIED SERVICE</div>
                </div>
            )}
          </div>

          {hasVideo && (
            <div className="bg-slate-950 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <PlayCircle size={150} />
               </div>
               
               <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl border border-white/5"><Video size={20} className="text-blue-400" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Official Showcase</p>
                      <h4 className="font-bold text-sm">Product Walkthrough</h4>
                    </div>
                  </div>
                  {isYoutube && product.videoUrl && (
                    <a 
                      href={product.videoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-red-700 transition-all active:scale-95"
                    >
                      <Youtube size={14} fill="white" /> Watch on YouTube
                    </a>
                  )}
               </div>

               <div className="aspect-video rounded-[2rem] overflow-hidden bg-black border-4 border-white/5 shadow-inner relative z-10">
                  <ReactPlayer 
                    url={product.nativeVideoUrl || product.videoUrl || ''} 
                    width="100%" 
                    height="100%" 
                    controls 
                    className="absolute top-0 left-0"
                  />
               </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: PRODUCT INTEL */}
        <div className="flex flex-col gap-10">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/5">{product.category}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 rounded-full border border-slate-100 bg-slate-50">{product.campusAcronym}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tighter">{product.name}</h1>
              
              <div className="mt-6 flex flex-wrap items-center gap-6">
                {isService ? (
                    <div className="text-4xl font-black text-blue-600 tracking-tight">{product.interestRate || 'Consultation Req.'}</div>
                ) : (
                    <div className="text-4xl font-black text-slate-900 tracking-tight">GHS {product.price.toFixed(2)}</div>
                )}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                    <ShieldCheck size={16} /> Liaison Verified
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-100 dark:bg-muted/30 rounded-[3rem] border border-slate-200 dark:border-border shadow-inner relative">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 <ShoppingBag size={12}/> Merchant Narrative
               </h3>
               <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-lg italic">
                 "{product.description}"
               </p>
            </div>

            <div className="p-6 bg-white dark:bg-card rounded-[2.5rem] border border-slate-100 dark:border-border shadow-sm flex items-center gap-5 transition-all hover:border-primary/20">
                <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-slate-200 dark:shadow-none">
                    {product.vendorName?.charAt(0).toUpperCase() || 'V'}
                </div>
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Verified Vendor</p>
                    <p className="font-black text-xl text-slate-900 dark:text-foreground">{product.vendorName || 'Campus Merchant'}</p>
                    <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => <Star key={i} size={10} className="fill-amber-400 text-amber-400" />)}
                        <span className="text-[10px] font-bold text-slate-400 ml-1">Elite Rating</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button 
                onClick={() => setIsOrderDialogOpen(true)}
                className="w-full py-10 rounded-[2.5rem] font-black text-2xl bg-slate-900 text-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] hover:scale-[1.02] hover:bg-slate-800 active:scale-95 transition-all"
            >
                {isService ? (product.actionLabel || 'Apply for Service') : 'Buy Now: Authorization Required'}
            </Button>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <ShieldCheck size={14} className="text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Secured by Liaison Escrow Protocol</p>
            </div>
          </div>
        </div>
      </div>

      {isOrderDialogOpen && (
        <OrderConfirmationDialog 
            product={product}
            open={isOrderDialogOpen}
            onOpenChange={setIsOrderDialogOpen}
        />
      )}
    </div>
  );
}
