
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import Image from 'next/image';
import { ShoppingCart, ExternalLink, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface VibeShopOverlayProps {
  productIds: string[];
  isActive: boolean;
}

/**
 * VibeShopOverlay Component
 * 
 * Part of the Creator-Commerce Engine.
 * Displays floating product pills over vibes to drive marketplace conversions.
 */
export default function VibeShopOverlay({ productIds, isActive }: VibeShopOverlayProps) {
  const { firestore } = useFirebase();
  const router = useRouter();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !productIds || productIds.length === 0) return null;
    return query(collection(firestore, 'products'), where(documentId(), 'in', productIds));
  }, [firestore, productIds]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  if (isLoading || !products || products.length === 0) return null;

  return (
    <div className={cn(
        "absolute bottom-4 left-4 right-4 z-40 transition-all duration-700 pointer-events-none",
        isActive ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
    )}>
      <div className="flex flex-col gap-2 max-w-[280px]">
        <div className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg w-fit flex items-center gap-1.5 animate-bounce">
            <Sparkles size={10} fill="currentColor" /> Shop this Vibe
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 pointer-events-auto">
            {products.map((product) => (
                <button
                    key={product.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${product.id}`);
                    }}
                    className="flex-shrink-0 flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all text-left group"
                >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-sm border border-black/5">
                        <Image src={product.imageUrl} fill className="object-cover" alt={product.name} />
                    </div>
                    <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-black text-slate-900 dark:text-white leading-tight truncate group-hover:text-amber-600 transition-colors">
                            {product.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-black text-amber-600">GHS {product.price.toFixed(2)}</span>
                            <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}
