
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
import { addDocumentNonBlocking, useFirestore } from '@/firebase';
import { Loader2, Megaphone, Sparkles, Send, ShoppingBag } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { parseMarketIntent } from '@/ai/flows/market-intent-parser';

const requestSchema = z.object({
  query: z.string().min(3, 'Please describe what you are looking for.'),
  category: z.string().min(2, 'Select a category so vendors can find you.'),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface RequestItemDialogProps {
  initialQuery?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * RequestItemDialog Component
 * 
 * Part of the Supply-Demand Engine.
 * Allows students to broadcast their needs to vendors when supply is missing.
 */
export default function RequestItemDialog({ initialQuery, open, onOpenChange }: RequestItemDialogProps) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAiParsing, setIsAiParsing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      query: initialQuery || '',
      category: 'General',
    },
  });

  // 🧠 AI Category Auto-Detect
  React.useEffect(() => {
    if (open && initialQuery && initialQuery.length > 5) {
        const detectCategory = async () => {
            setIsAiParsing(true);
            try {
                const intent = await parseMarketIntent({ query: initialQuery });
                if (intent.category) {
                    form.setValue('category', intent.category.charAt(0).toUpperCase() + intent.category.slice(1));
                }
            } catch (e) {
                console.warn("AI Intent Parser busy...");
            } finally {
                setIsAiParsing(false);
            }
        };
        detectCategory();
    }
  }, [open, initialQuery, form]);

  const onSubmit = async (data: RequestFormValues) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    const requestData = {
      userId: user.id,
      userName: user.name || "Campus Member",
      query: data.query,
      category: data.category.toLowerCase(),
      campusId: user.campusId,
      status: 'open',
      createdAt: serverTimestamp(),
      matchCount: 0
    };

    try {
        await addDocumentNonBlocking(collection(firestore, 'market_requests'), requestData);
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
                        Alerting Verified Campus Vendors
                    </DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-start gap-3">
                <Sparkles className="text-amber-600 shrink-0 mt-1" size={16} />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium italic">
                    "Liaison Logic: If you can't find it, request it! Vendors will be notified to source this item for you."
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="query" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">What are you looking for?</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="e.g. Scientific Calculator for Exam" 
                                    className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold text-lg shadow-inner" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>

                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-14 rounded-2xl border-none bg-slate-50 dark:bg-muted font-bold shadow-inner">
                                        <div className="flex items-center gap-2">
                                            {isAiParsing ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
                                            <SelectValue placeholder="Select Category" />
                                        </div>
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

                    <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Broadcast to Vendors</>}
                    </Button>
                </form>
            </Form>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-muted/30 border-t border-slate-100 dark:border-border text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">National Hub Demand Engine • GH 🇬🇭</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
