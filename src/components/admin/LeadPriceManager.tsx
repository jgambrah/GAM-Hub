
'use client';

import React, { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, setDoc } from 'firebase/firestore';
import type { LeadPrice } from '@/lib/types';
import { Plus, Loader2, Coins, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

export function LeadPriceManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [newCat, setNewCat] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const pricesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'lead_prices'), orderBy('category', 'asc'));
  }, [firestore]);

  const { data: prices, isLoading } = useCollection<LeadPrice>(pricesQuery);

  const handleAdd = async () => {
    if (!firestore || !newCat || !newPrice) return;
    setLoading(true);
    try {
      // Use the category name as the document ID for efficient Cloud Function lookup
      const priceRef = doc(firestore, 'lead_prices', newCat);
      await setDoc(priceRef, {
        category: newCat,
        price: parseFloat(newPrice),
        updatedAt: new Date().toISOString()
      });
      
      toast({ 
        title: "Price Tier Established", 
        description: `Leads for "${newCat}" now cost GHS ${newPrice}` 
      });
      setNewCat(''); 
      setNewPrice('');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add price tier.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, price: number) => {
    if (!firestore) return;
    try {
      const ref = doc(firestore, 'lead_prices', id);
      await setDoc(ref, { 
          price, 
          updatedAt: new Date().toISOString() 
      }, { merge: true });
      toast({ title: "Price Tier Updated" });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-2 border-primary/10 overflow-hidden shadow-xl">
      <CardHeader className="bg-primary/5 p-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-primary text-primary-foreground rounded-3xl">
            <Coins size={28} />
          </div>
          <div>
            <CardTitle className="text-2xl font-black">Lead Price Master</CardTitle>
            <CardDescription className="font-medium">Set the "Intellectual Tax" for every lead category in the Yard.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        
        {/* ADD NEW TIER */}
        <div className="flex flex-col md:flex-row gap-4 p-6 bg-muted rounded-[2rem]">
          <Input 
            placeholder="Category (e.g. Staff Loans)" 
            className="flex-[2] rounded-xl border-none font-bold"
            value={newCat} onChange={e => setNewCat(e.target.value)}
          />
          <Input 
            type="number" 
            placeholder="Price (GHS)" 
            className="flex-1 rounded-xl border-none font-bold"
            value={newPrice} onChange={e => setNewPrice(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={loading || !newCat || !newPrice} className="rounded-xl font-black px-8">
            {loading ? <Loader2 className="animate-spin" /> : <><Plus size={18}/> Add Tier</>}
          </Button>
        </div>

        {/* PRICE LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </>
          ) : prices?.map((p) => (
            <div key={p.id} className="p-6 bg-card border-2 rounded-[2rem] flex items-center justify-between hover:border-primary transition-all group">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Lead Category</p>
                <h4 className="font-black text-lg">{p.category}</h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">GHS</span>
                  <input 
                    type="number"
                    defaultValue={p.price}
                    onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val !== p.price) handleUpdate(p.id, val);
                    }}
                    className="w-24 pl-10 pr-3 py-2 rounded-xl bg-muted border-none font-black text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <TrendingUp size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
