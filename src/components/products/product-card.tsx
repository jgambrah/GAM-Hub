
'use client';

import Image from 'next/image';
import * as React from 'react';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShoppingCart, Wrench, Landmark, Video, Sparkles, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useView } from '@/context/ViewContext';
import { OrderConfirmationDialog } from '../orders/OrderConfirmationDialog';
import { VendorProductDialog } from '../vendor/VendorProductDialog';


type ProductCardProps = {
  product: Product;
  className?: string;
};

export default function ProductCard({ product, className }: ProductCardProps) {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { viewMode } = useView();
  const [isOrderDialogOpen, setIsOrderDialogOpen] = React.useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = React.useState(false);

  const hasVideo = !!(product.videoUrl || product.nativeVideoUrl);

  // Allow ownership if the user is the vendor OR if the Liaison is in Vendor ViewMode
  const isOwner = (user?.role === 'vendor' && user.id === product.vendorId) || (isAdmin && viewMode === 'vendor');

  const handleCardActionClick = () => {
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

  const isService = product.productType === 'service';

  return (
    <>
        <Card className={cn("flex flex-col overflow-hidden transition-all hover:shadow-xl group", className)}>
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Badge variant="destructive">OUT OF STOCK</Badge>
                </div>
            )}
            
            {hasVideo && (
                <>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-all">
                        <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white shadow-2xl group-hover:scale-110 transition-transform duration-300">
                            <Play fill="currentColor" size={28} className="ml-1" />
                        </div>
                    </div>
                    <div className="absolute bottom-3 left-3 z-10">
                        <Badge className="bg-black/60 text-white border-white/20 backdrop-blur-md font-black text-[8px] tracking-widest px-2 py-0.5 flex items-center gap-1">
                            <Video size={10} fill="white" /> VIDEO
                        </Badge>
                    </div>
                </>
            )}

            {isService && (
                <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-blue-600 text-white border-none font-black text-[10px] tracking-widest px-3 py-1">VERIFIED SERVICE</Badge>
                </div>
            )}
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
