
'use client';

import React, { useEffect, useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId, limit, getDocs } from 'firebase/firestore';
import { getRelatedProducts } from '@/lib/market-intelligence';
import type { Product } from '@/lib/types';
import ProductCard from '../products/product-card';
import { Skeleton } from '../ui/skeleton';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface RelatedProductsProps {
  productId: string;
}

/**
 * RelatedProducts Component
 * 
 * Implements the "People Also Bought" recommendation layer.
 * Queries the purchase correlation graph to surface statistically relevant add-ons.
 */
export default function RelatedProducts({ productId }: RelatedProductsProps) {
  const { firestore } = useFirebase();
  const [related, setRelated] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCorrelations() {
      if (!firestore || !productId) return;
      setIsLoading(true);
      
      try {
        // 1. Get the top correlated IDs from the graph
        const correlations = await getRelatedProducts(firestore, productId);
        const ids = correlations.map(c => c.id);

        if (ids.length === 0) {
          setRelated([]);
          setIsLoading(false);
          return;
        }

        // 2. Fetch the actual product details for those IDs
        const q = query(
          collection(firestore, 'products'),
          where(documentId(), 'in', ids.slice(0, 10))
        );
        
        const snap = await getDocs(q);
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        
        // Sort them by the correlation weight retrieved in step 1
        const sortedProducts = products.sort((a, b) => {
            const countA = correlations.find(c => c.id === a.id)?.count || 0;
            const countB = correlations.find(c => c.id === b.id)?.count || 0;
            return countB - countA;
        });

        setRelated(sortedProducts);
      } catch (err) {
        console.error("Related Products Error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCorrelations();
  }, [firestore, productId]);

  if (isLoading) {
    return (
      <div className="space-y-6 mt-12 px-2">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="min-w-[280px] h-64 rounded-[2.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (related.length === 0) return null;

  return (
    <section className="mt-16 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <Sparkles className="text-amber-500" size={24} /> People Also Bought
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Verified Purchase Correlations</p>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-6 pb-6 px-2">
          {related.map((product) => (
            <div key={product.id} className="min-w-[280px] w-[280px] flex-shrink-0">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      <div className="flex justify-center opacity-30 pt-4">
         <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Commercial Intelligence Engine • GH 🇬🇭</p>
      </div>
    </section>
  );
}
