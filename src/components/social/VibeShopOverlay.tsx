
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import Image from 'next/image';
import { ShoppingCart, ChevronRight, Sparkles, Star } from 'lucide-react';
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
 * Displays a premium floating "Featured Products" shelf over vibrations.
 */
export default function VibeShopOverlay({ productIds, isActive }: VibeShopOverlayProps) {
  const { firestore } = useFirebase();
  const router = useRouter();

  // 🏎️ COMMERCE HANDSHAKE: Fetch all tagged products in one efficient query
  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !productIds || productIds.length === 0) return null;
    // Note: Firestore 'in' queries are restricted to 10 items, 
    // but our creator policy restricts tagging to 3 items per vibe.
    return query(
        collection(firestore, 'products'), 
        where(documentId(), 'in', productIds.slice(0, 10))
    );
  }, [firestore, productIds]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  if (isLoading || !products || products.length === 0) return null;

  return (
    <div className={cn(
        "absolute bottom-6 left-4 right-4 z-40 transition-all duration-700 pointer-events-none",
        isActive ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
    )}>
      <div className="flex flex-col gap-3 max-w-[320px] md:max-w-[400px]">
        {/* Authority Badge */}
        <div className="bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl w-fit flex items-center gap-2 animate-bounce border-2 border-white/20">
            <Sparkles size={12} fill="currentColor" /> Featured Products
        </div>
        
        {/* The Scrollable Shelf */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-3 px-1 pointer-events-auto">
            {products.map((product) => (
                <button
                    key={product.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${product.id}`);
                    }}
                    className="flex-shrink-0 flex items-center gap-4 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-3 rounded-[2rem] border-2 border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all text-left group"
                >
                    {/* Product Thumbnail */}
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-muted flex-shrink-0 shadow-inner border border-black/5">
                        <Image src={product.imageUrl} fill className="object-cover" alt={product.name} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>

                    {/* Product Details */}
                    <div className="min-w-0 pr-4">
                        <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight truncate group-hover:text-blue-600 transition-colors">
                            {product.name}
                        </p>
                        <div className="flex items-center gap-1 mt-1 mb-1.5">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={8} className="fill-amber-400 text-amber-400" />
                            ))}
                            <span className="text-[8px] font-bold text-slate-400 ml-1">Elite Vibe</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-amber-600">GHS {product.price.toFixed(2)}</span>
                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400">
                                <span className="text-[8px] font-black uppercase">View</span>
                                <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}
