
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
import { Sparkles, ShoppingBag, Zap, Search, X, Loader2, Bot, Trophy, Mic, TrendingUp, Star, Flame, Tag, Megaphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import RequestItemDialog from '@/components/market/RequestItemDialog';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const { user, isUserLoading, isAdmin } = useAuth();
  const { viewMode } = useView();
  const { viewAsCampus } = useCampusView();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isListening, setIsListening] = React.useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = React.useState(false);

  // 🏎️ Rank Engine with structured discovery layers
  const { 
    products: rankedProducts, 
    trending, 
    deals, 
    topRated,
    isLoading: isRanking, 
    isParsing, 
    hasProfile, 
    intent, 
    isExplaining 
  } = useMarketRecommendations(searchQuery);

  // 🎙️ VOICE SHOPPING PROTOCOL
  const startVoiceSearch = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Search Unsupported', description: 'Please use Chrome or Safari.' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GH';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => setSearchQuery(e.results[0][0].transcript);
    recognition.onerror = (e: any) => {
        setIsListening(false);
        if (e.error === 'not-allowed') {
            toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Enable permissions in your browser.' });
        }
    };
    recognition.onend = () => setIsListening(false);
    try { recognition.start(); } catch (e) { setIsListening(false); }
  };

  const campusProducts = React.useMemo(() => {
    if (!rankedProducts) return [];
    return rankedProducts;
  }, [rankedProducts]);

  const isLoading = isUserLoading || isRanking;
  const isBrowsing = !searchQuery.trim();

  return (
    <div className="space-y-10 pb-32">
      {/* HEADER: COMMAND SIGNAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 gap-6">
        <div className="space-y-1">
            <h1 className="font-headline text-4xl font-black tracking-tight text-foreground italic uppercase">Marketplace</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">Verified Campus Commerce</p>
        </div>
        
        <div className="relative w-full max-w-md group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isListening ? (
                    <div className="relative flex items-center justify-center">
                        <div className="absolute h-8 w-8 bg-red-500/20 rounded-full animate-ping" />
                        <Mic className="text-red-600 animate-pulse" size={18} />
                    </div>
                ) : (
                    <Search className="text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                )}
            </div>
            
            <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isListening ? "Listening..." : "Ask Liaison Assistant..."}
                className={cn(
                    "pl-12 pr-24 h-14 rounded-2xl bg-white border-2 border-slate-100 shadow-sm focus:ring-2 focus:ring-primary transition-all font-bold",
                    isListening && "border-red-200 ring-red-100"
                )}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-2 hover:bg-muted rounded-xl text-slate-400"><X size={16} /></button>
                )}
                <button onClick={startVoiceSearch} disabled={isListening} className={cn("p-2.5 rounded-xl transition-all shadow-sm", isListening ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                    {isListening ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}
                </button>
            </div>
        </div>

        {viewMode === 'vendor' && <AddProductDialog />}
      </div>

      {/* INTELLIGENCE HUB: DISCOVERY SECTIONS */}
      {isBrowsing && !isLoading && (
        <div className="space-y-12 animate-in fade-in duration-700">
          
          <SponsoredMajorAd userMajor={user?.major} />

          {/* 🔥 TRENDING SECTION */}
          {trending.length > 0 && (
            <section className="space-y-4">
              <div className="px-6 flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-600 rounded-xl shadow-inner"><Flame size={18} /></div>
                <h3 className="text-xl font-black italic tracking-tight uppercase">Trending Now</h3>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-6 pb-6 px-6">
                  {trending.map(p => (
                    <div key={p.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* 📉 HOT DEALS SECTION */}
          {deals.length > 0 && (
            <section className="space-y-4">
              <div className="px-6 flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner"><Tag size={18} /></div>
                <h3 className="text-xl font-black italic tracking-tight uppercase">Hot Deals</h3>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-6 pb-6 px-6">
                  {deals.map(p => (
                    <div key={p.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* ⭐ TOP RATED VENDORS SECTION */}
          {topRated.length > 0 && (
            <section className="space-y-4">
              <div className="px-6 flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shadow-inner"><Star size={18} /></div>
                <h3 className="text-xl font-black italic tracking-tight uppercase">Elite Merchants</h3>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-6 pb-6 px-6">
                  {topRated.map(p => (
                    <div key={p.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}
        </div>
      )}

      {/* AI SEARCH RESULTS */}
      <div className="px-4">
        {intent && searchQuery && !isLoading && (
            <div className="mb-8 animate-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-500 rounded-[1.5rem] shadow-xl text-slate-950">
                        <Trophy size={28} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter uppercase leading-none">
                            Top Picks For {intent.intent?.toUpperCase() || intent.category?.toUpperCase() || 'You'}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                            <Sparkles size={12} className="text-indigo-500" /> AI-Orchestrated Match Protocol
                        </p>
                    </div>
                </div>
            </div>
        )}

        <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                <ShoppingBag className="text-primary" /> {isBrowsing ? 'Recommended For You' : 'Search Discoveries'}
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                <Zap size={14} className="text-blue-600 fill-blue-600 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Hybrid Discovery Active</span>
            </div>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-[2.5rem]"/>
                <div className="space-y-2 px-4"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /></div>
                </div>
            ))}
            </div>
        ) : campusProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in duration-500">
            {campusProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center rounded-[3rem] border-4 border-dashed border-muted-foreground/10 py-32 text-center bg-muted/5">
                <ShoppingBag className="mx-auto text-muted-foreground/20 mb-6" size={64} />
                <h2 className="text-xl font-black text-slate-400 uppercase tracking-widest">No matching supply found</h2>
                <p className="text-sm text-muted-foreground mt-2 italic font-medium max-w-sm mx-auto">
                    Looks like the Yard doesn't have what you need yet. Request it below and we'll alert vendors!
                </p>
                <Button 
                    onClick={() => setIsRequestDialogOpen(true)}
                    className="mt-8 rounded-2xl font-black bg-slate-900 text-white px-8 h-14 flex items-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                    <Megaphone size={18} /> Broadcast Request to Vendors
                </Button>
            </div>
        )}
      </div>

      {isRequestDialogOpen && (
          <RequestItemDialog 
            initialQuery={searchQuery}
            open={isRequestDialogOpen}
            onOpenChange={setIsRequestDialogOpen}
          />
      )}
    </div>
  );
}
