
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
import { Sparkles, ShoppingBag, Zap, Search, X, Loader2, Bot, Trophy, Mic, MicOff, Volume2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  const { user, isUserLoading, isAdmin } = useAuth();
  const { viewMode } = useView();
  const { viewAsCampus } = useCampusView();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isListening, setIsListening] = React.useState(false);

  // 🏎️ Rank Engine with AI Intent Parsing & Result Explanation
  const { products: rankedProducts, isLoading: isRanking, isParsing, hasProfile, intent, isExplaining } = useMarketRecommendations(searchQuery);

  // 🎙️ VOICE SHOPPING PROTOCOL
  const startVoiceSearch = () => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({ 
        variant: 'destructive', 
        title: 'Voice Search Unsupported', 
        description: 'Your browser does not support speech recognition. Please try Chrome or Safari.' 
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GH'; // Tune for Ghanaian accent
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      toast({
        title: "Voice Captured",
        description: `Searching for: "${transcript}"`,
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast({ variant: 'destructive', title: 'Mic Access Denied', description: 'Please enable microphone permissions in your browser settings.' });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const campusProducts = React.useMemo(() => {
    if (!rankedProducts) return [];
    if (viewMode === 'vendor' || isAdmin) return rankedProducts;
    
    return rankedProducts.filter(p => {
        if (p.productType === 'service') {
            return p.has_fuel !== false;
        }
        return true;
    });
  }, [rankedProducts, viewMode, isAdmin]);

  const isLoading = isUserLoading || isRanking;
  
  const getEmptyStateMessage = () => {
    if (searchQuery) return `No results found for "${searchQuery}". Try a different keyword.`;
    if (isAdmin) {
      return viewAsCampus
        ? `There are no products listed for ${viewAsCampus.name} yet.`
        : 'Select a campus from the switcher to see its products.';
    }
    return 'There are no products available for your campus right now.';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-6">
        <div className="space-y-1">
            <h1 className="font-headline text-4xl font-black tracking-tight text-foreground italic uppercase">Marketplace</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">Verified Campus Commerce</p>
        </div>
        
        {/* AI SEARCH BAR + VOICE COMMAND */}
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
                placeholder={isListening ? "Listening to the Yard..." : "Ask Liaison Assistant..."}
                className={cn(
                    "pl-12 pr-24 h-14 rounded-2xl bg-white border-2 border-slate-100 shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-bold",
                    isListening && "border-red-200 ring-2 ring-red-100 bg-red-50/10"
                )}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="p-2 hover:bg-muted rounded-xl transition-colors text-slate-400"
                    >
                        <X size={16} />
                    </button>
                )}
                <button 
                    onClick={startVoiceSearch}
                    disabled={isListening}
                    className={cn(
                        "p-2.5 rounded-xl transition-all active:scale-90 shadow-sm",
                        isListening ? "bg-red-600 text-white shadow-red-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                    title="Voice Shopping"
                >
                    {isListening ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}
                </button>
            </div>
        </div>

        {viewMode === 'vendor' && <AddProductDialog />}
      </div>

      {/* AI INTELLIGENCE STATUS BAR */}
      <div className="px-4">
          {(hasProfile || isParsing || intent) && !isLoading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-3 rounded-[1.5rem] border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200/50">
                        {isParsing ? <Loader2 className="animate-spin" size={14}/> : <Bot size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                            {isParsing ? 'Analyzing Intent...' : intent ? `Searching for ${intent.category || 'items'} ${intent.intent ? `for ${intent.intent}` : ''}` : 'Personalized Discovery Active'}
                        </p>
                        {intent?.priceMax && (
                            <p className="text-[8px] font-bold text-slate-400 uppercase">Budget Cap: GHS {intent.priceMax}</p>
                        )}
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {isExplaining && <Loader2 className="animate-spin text-amber-500" size={12}/>}
                      <Zap size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase hidden sm:inline">Liaison Assistant Active</span>
                  </div>
              </div>
          )}
      </div>

      {!searchQuery && viewMode === 'student' && <SponsoredMajorAd userMajor={user?.major} />}

      <div className="px-2">
        {intent && searchQuery && !isLoading && (
            <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-500 rounded-[1.5rem] shadow-xl shadow-amber-200/50 text-slate-950">
                        <Trophy size={28} />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2 italic tracking-tighter uppercase leading-none">
                            Top Picks For {intent.intent?.toUpperCase() || intent.category?.toUpperCase() || 'You'}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                            <Sparkles size={12} className="text-indigo-500" /> AI-Orchestrated Match Protocol
                        </p>
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in duration-500">
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
    </div>
  );
}
