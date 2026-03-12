
'use client';
import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useView } from '@/context/ViewContext';
import ProductCard from '@/components/products/product-card';
import { AddProductDialog } from '@/components/products/add-product-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampusView } from '@/hooks/use-campus-view';
import SponsoredMajorAd from '@/components/market/SponsoredMajorAd';
import { useMarketRecommendations } from '@/hooks/use-market-recommendations';
import { Sparkles, ShoppingBag, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const { user, isUserLoading, isAdmin } = useAuth();
  const { viewMode } = useView();
  const { viewAsCampus } = useCampusView();

  // 🏎️ Use the new Ranking Engine for personalized discovery
  const { products: rankedProducts, isLoading: isRanking, hasProfile } = useMarketRecommendations();

  const campusProducts = React.useMemo(() => {
    if (!rankedProducts) return [];
    if (viewMode === 'vendor' || isAdmin) return rankedProducts;
    
    // Safety Filter: Ensure services are hidden if vendor is out of fuel
    return rankedProducts.filter(p => {
        if (p.productType === 'service') {
            return p.has_fuel !== false;
        }
        return true;
    });
  }, [rankedProducts, viewMode, isAdmin]);

  const isLoading = isUserLoading || isRanking;
  
  const getEmptyStateMessage = () => {
    if (isAdmin) {
      return viewAsCampus
        ? `There are no products listed for ${viewAsCampus.name} yet.`
        : 'Select a campus from the switcher to see its products.';
    }
    return 'There are no products available for your campus right now.';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
            <h1 className="font-headline text-4xl font-black tracking-tight text-foreground italic uppercase">Marketplace</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">Verified Campus Commerce</p>
        </div>
        {viewMode === 'vendor' && <AddProductDialog />}
      </div>

      {viewMode === 'student' && <SponsoredMajorAd userMajor={user?.major} />}

      {/* INTELLIGENCE STATUS BAR */}
      {hasProfile && !isLoading && (
          <div className="px-4 animate-in slide-in-from-top-2 duration-500">
              <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-3 rounded-[1.5rem] border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200/50"><Sparkles size={14} /></div>
                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Personalized Intelligence Active</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <Zap size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Synced with Vibe Profile</span>
                  </div>
              </div>
          </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-[2.5rem]"/>
              <div className="space-y-2 px-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : campusProducts && campusProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-2">
          {campusProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[3rem] border-4 border-dashed border-muted-foreground/10 py-32 text-center bg-muted/5">
            <ShoppingBag className="mx-auto text-muted-foreground/20 mb-6" size={64} />
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">No products found</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto italic font-medium">
              {getEmptyStateMessage()}
            </p>
        </div>
      )}
    </div>
  );
}
