
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { Loader2, Megaphone, Sparkles, Send, MapPin, BadgeCheck } from 'lucide-react';
import { createMarketRequest } from '@/lib/market-intelligence';
import { parseDemandRequest, type DemandOutput } from '@/ai/flows/parse-demand-request';
import { Badge } from '../ui/badge';

const requestSchema = z.object({
  query: z.string().min(3, 'Please describe what you are looking for.'),
  category: z.string().min(2, 'Select a category so vendors can find you.'),
  condition: z.enum(['new', 'used', 'any']),
  location: z.string().min(2, 'Specify your Hall or Faculty for delivery vibes.'),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface RequestItemDialogProps {
  initialQuery?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RequestItemDialog({ initialQuery, open, onOpenChange }: RequestItemDialogProps) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isAiParsing, setIsAiParsing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [aiMetadata, setAiMetadata] = React.useState<DemandOutput | null>(null);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      query: initialQuery || '',
      category: 'General',
      condition: 'any',
      location: ''
    },
  });

  React.useEffect(() => {
    const currentQuery = form.watch('query');
    if (open && currentQuery && currentQuery.length > 8) {
        const timer = setTimeout(async () => {
            setIsAiParsing(true);
            try {
                const intent = await parseDemandRequest({ query: currentQuery });
                setAiMetadata(intent);
                form.setValue('category', intent.category.charAt(0).toUpperCase() + intent.category.slice(1));
                form.setValue('condition', intent.condition);
            } catch (e) {
                console.warn("AI Intent Parser busy...");
            } finally {
                setIsAiParsing(false);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [open, form.watch('query'), form]);

  const onSubmit = async (data: RequestFormValues) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    try {
        await createMarketRequest(
            firestore,
            user.id,
            user.name || "Campus Member",
            data.query,
            user.campusId,
            {
                category: data.category.toLowerCase(),
                tags: aiMetadata?.tags || [],
                condition: data.condition,
                location: data.location
            }
        );

        toast({
            title: "Demand Signal Sent! 📡",
            description: "Vendors on your campus have been notified of your request.",
        });
        onOpenChange(false);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Broadcast Failed' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-8 bg-slate-900 text-white flex-shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950 animate-pulse">
                    <Megaphone size={24} />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black italic tracking-tight">Demand Broadcast</DialogTitle>
                    <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">
                        AI-Powered Supply Signal
                    </DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <Sparkles className="text-amber-600 shrink-0 mt-1" size={16} />
                <div className="space-y-1">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-black uppercase">Liaison AI Intelligence</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium italic">
                        The Brain will automatically tag your request so vendors find you.
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="query" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Describe Your Need</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input placeholder="e.g. used scientific calculator" className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold text-lg shadow-inner pr-12" {...field} />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        {isAiParsing ? <Loader2 className="animate-spin text-primary" size={18} /> : aiMetadata && <BadgeCheck className="text-emerald-500" size={18} />}
                                    </div>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>

                    {aiMetadata && (
                        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                            {aiMetadata.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-black text-[9px] uppercase tracking-widest px-3">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold shadow-inner">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {['General', 'Electronics', 'Fashion', 'Stationery', 'Services', 'Food'].map(cat => (
                                            <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>

                        <FormField control={form.control} name="condition" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Condition</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold shadow-inner">
                                            <SelectValue placeholder="Condition" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {['any', 'new', 'used'].map(c => (
                                            <SelectItem key={c} value={c} className="font-bold uppercase text-[10px]">{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>

                    <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Your Yard Spot (Hall/Faculty)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input placeholder="e.g. Republic Hall" className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold shadow-inner pl-12" {...field} />
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>

                    <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Broadcast Demand Signal</>}
                    </Button>
                </form>
            </Form>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-muted/30 border-t border-slate-100 dark:border-border text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Liaison Supply-Demand Engine • GH 🇬🇭</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
