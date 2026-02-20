'use client';
import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useView } from '@/context/ViewContext';
import ProductCard from '@/components/products/product-card';
import { AddProductDialog } from '@/components/products/add-product-dialog';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, DocumentData, Query } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampusView } from '@/hooks/use-campus-view';
import SponsoredMajorAd from '@/components/market/SponsoredMajorAd';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const { user, isUserLoading, isAdmin, isTokenReady } = useAuth();
  const { viewMode } = useView();
  const { firestore } = useFirebase();
  const { viewAsCampus } = useCampusView();

  const productsQuery = useMemoFirebase(() => {
    // ✅ QUERY GUARD: Wait for token readiness to prevent permission poisoning
    if (!firestore || !isTokenReady) return null;

    const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;
    if (!activeCampusId) return null;

    const productsRef = collection(firestore, 'products');
    let q: Query<DocumentData>;

    if (viewMode === 'student' || viewMode === 'staff') {
      q = query(
        productsRef,
        where('campusId', '==', activeCampusId),
        where('targetAudience', 'in', ['all', viewMode]),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        productsRef,
        where('campusId', '==', activeCampusId),
        orderBy('createdAt', 'desc')
      );
    }
    
    return q;
  }, [firestore, user, isAdmin, viewAsCampus, viewMode, isTokenReady]);

  const { data: allCampusProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  
  const campusProducts = React.useMemo(() => {
    if (!allCampusProducts) return [];
    if (viewMode === 'vendor' || isAdmin) return allCampusProducts;
    
    return allCampusProducts.filter(p => {
        if (p.productType === 'service') {
            return p.has_fuel !== false;
        }
        return true;
    });
  }, [allCampusProducts, viewMode, isAdmin]);

  const isLoading = isUserLoading || isLoadingProducts;
  
  const getEmptyStateMessage = () => {
    if (isAdmin) {
      return viewAsCampus
        ? `There are no products listed for ${viewAsCampus.name} yet.`
        : 'Select a campus from the switcher to see its products.';
    }
    return 'There are no products available for your campus right now.';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Marketplace</h1>
        {viewMode === 'vendor' && <AddProductDialog />}
      </div>

      {viewMode === 'student' && <SponsoredMajorAd userMajor={user?.major} />}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-lg"/>
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : campusProducts && campusProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {campusProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-24 text-center">
            <h2 className="text-xl font-semibold tracking-tight">No products found</h2>
            <p className="text-sm text-muted-foreground">
              {getEmptyStateMessage()}
            </p>
        </div>
      )}
    </div>
  );
}