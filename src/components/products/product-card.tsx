
'use client';

import Image from 'next/image';
import * as React from 'react';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShoppingCart, Wrench, Landmark, Video, Sparkles, Play, Heart, Share2, TrendingUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useView } from '@/context/ViewContext';
import { OrderConfirmationDialog } from '../orders/OrderConfirmationDialog';
import { VendorProductDialog } from '../vendor/VendorProductDialog';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { recordMarketSignal, toggleFavoriteProduct } from '@/lib/market-intelligence';
import type { MarketProfile } from '@/lib/types';

type ProductCardProps = {
  product: Product;
  className?: string;
};

export default function ProductCard({ product, className }: ProductCardProps) {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { viewMode } = useView();
  const { firestore } = useFirebase();
  
  const [isOrderDialogOpen, setIsOrderDialogOpen] = React.useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = React.useState(false);
  const [isSyncingFavorite, setIsSyncingFavorite] = React.useState(false);

  // FETCH: Market Profile to check if favorited
  const marketProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'user_market_profiles', user.id);
  }, [firestore, user?.id]);
  const { data: profile } = useDoc<MarketProfile>(marketProfileRef);

  const isFavorited = profile?.favoriteProducts?.includes(product.id) || false;
  const hasVideo = !!(product.videoUrl || product.nativeVideoUrl);
  const isTrending = product.trendScore && product.trendScore > 10;

  // Allow ownership if the user is the vendor OR if the Liaison is in Vendor ViewMode
  const isOwner = (user?.role === 'vendor' && user.id === product.vendorId) || (isAdmin && viewMode === 'vendor');

  const handleCardActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Not Logged In',
            description: 'You must be logged in to place an order.',
        });
        return;
    }
    if (isOwner) {
        setIsVendorDialogOpen(true);
    } else {
        setIsOrderDialogOpen(true);
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !firestore) return;
    setIsSyncingFavorite(true);
    try {
        await toggleFavoriteProduct(firestore, user.id, product, isFavorited);
        toast({
            title: isFavorited ? "Removed from Favorites" : "Added to Favorites!",
            description: isFavorited ? "The product is no longer in your yard list." : "This signal helps the Yard understand your tastes.",
        });
    } finally {
        setIsSyncingFavorite(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firestore || !user) return;
    recordMarketSignal(firestore, user.id, product, 'share');
    
    if (navigator.share) {
        navigator.share({
            title: product.name,
            text: `Check out this vibe on GAM Hub: ${product.name}`,
            url: window.location.href + `/products/${product.id}`
        });
    } else {
        navigator.clipboard.writeText(window.location.origin + `/products/${product.id}`);
        toast({ title: "Link Copied!", description: "Share the vibe with your group." });
    }
  };

  const isService = product.productType === 'service';

  return (
    <>
        <Card className={cn("flex flex-col overflow-hidden transition-all hover:shadow-xl group relative", className)}>
        
        {/* TRENDING OVERLAY */}
        {isTrending && (
            <div className="absolute top-3 left-3 z-30 animate-in zoom-in duration-500">
                <div className="bg-red-600 text-white px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 border-2 border-white dark:border-slate-900">
                    <TrendingUp size={10} className="animate-pulse" /> TRENDING
                </div>
            </div>
        )}

        <CardHeader className="p-0">
            <div className="relative aspect-[3/2] w-full bg-muted">
            <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                data-ai-hint={product.imageHint}
            />
            {product.stock === 0 && !isService && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <Badge variant="destructive">OUT OF STOCK</Badge>
                </div>
            )}
            
            {hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-all z-10 pointer-events-none">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white shadow-2xl group-hover:scale-110 transition-transform duration-300">
                        <Play fill="currentColor" size={28} className="ml-1" />
                    </div>
                </div>
            )}

            {/* ACTION BUTTONS (FAVORITE / SHARE) */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-300">
                <button 
                    onClick={handleToggleFavorite}
                    disabled={isSyncingFavorite}
                    className={cn(
                        "p-3 rounded-2xl shadow-xl transition-all active:scale-90 border-2",
                        isFavorited ? "bg-red-500 border-red-400 text-white" : "bg-white/80 backdrop-blur-md border-white/20 text-slate-900"
                    )}
                >
                    {isSyncingFavorite ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />}
                </button>
                <button 
                    onClick={handleShare}
                    className="p-3 bg-white/80 backdrop-blur-md border-2 border-white/20 rounded-2xl shadow-xl text-slate-900 transition-all active:scale-90"
                >
                    <Share2 size={18} />
                </button>
            </div>

            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
                {hasVideo && (
                    <Badge className="bg-black/60 text-white border-white/20 backdrop-blur-md font-black text-[8px] tracking-widest px-2 py-0.5 flex items-center gap-1">
                        <Video size={10} fill="white" /> VIDEO
                    </Badge>
                )}
                {isService && (
                    <Badge className="bg-blue-600 text-white border-none font-black text-[8px] tracking-widest px-2 py-0.5">SERVICE</Badge>
                )}
            </div>
            </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-2">
                {!isService ? (
                    <>
                        <div className={cn("w-2 h-2 rounded-full", product.stock > 0 ? 'bg-green-500' : 'bg-red-500')} />
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            {product.stock > 0 ? `${product.stock} Units Left` : 'Out of Stock'}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                            {product.category}
                        </p>
                    </>
                )}
            </div>
            <CardTitle className="mb-2 text-lg font-semibold font-headline line-clamp-1">{product.name}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>

            {/* AI RESULT EXPLANATION PANEL */}
            {product.aiReason && product.aiReason.length > 0 && (
                <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900 animate-in fade-in slide-in-from-top-2 duration-500">
                    <p className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                        <Sparkles size={10} fill="currentColor" /> Why this matches
                    </p>
                    <ul className="space-y-1.5">
                        {product.aiReason.map((reason, i) => (
                            <li key={i} className="text-[10px] text-slate-600 dark:text-slate-300 flex items-start gap-2 font-medium leading-tight italic">
                                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                                {reason}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </CardContent>
        <CardFooter className="flex items-center justify-between p-4 pt-0">
            {isService ? (
                <div className="flex flex-col">
                    {product.interestRate ? (
                        <p className="text-sm font-black text-blue-600">{product.interestRate}</p>
                    ) : (
                        <p className="text-sm font-black text-muted-foreground italic">Terms apply</p>
                    )}
                </div>
            ) : (
                <p className="text-xl font-bold">GH₵{product.price.toFixed(2)}</p>
            )}
            
            <Button 
                size="sm" 
                variant={isOwner ? "secondary" : "default"} 
                className={cn(
                    "rounded-xl font-black text-xs h-9 px-4",
                    !isOwner && isService && "bg-blue-600 hover:bg-blue-700 text-white",
                    !isOwner && !isService && "bg-slate-900 hover:bg-slate-800 text-white"
                )}
                disabled={!isService && product.stock <= 0 && !isOwner} 
                onClick={handleCardActionClick}
            >
                {isOwner ? (
                    <>
                        <Wrench className="mr-2 h-4 w-4" /> Manage
                    </>
                ) : (
                    isService ? (
                        <>
                            <Landmark className="mr-2 h-4 w-4" /> {product.actionLabel || 'Apply'}
                        </>
                    ) : (
                        <>
                            <ShoppingCart className="mr-2 h-4 w-4" /> Buy Now
                        </>
                    )
                )}
            </Button>
        </CardFooter>
        </Card>
        {user && !isOwner && (
            <OrderConfirmationDialog 
                product={product}
                open={isOrderDialogOpen}
                onOpenChange={setIsOrderDialogOpen}
            />
        )}
        {user && isOwner && (
            <VendorProductDialog
                product={product}
                open={isVendorDialogOpen}
                onOpenChange={setIsVendorDialogOpen}
            />
        )}
    </>
  );
}
