'use client';

import React, { useMemo, useState } from 'react';
import { Wallet, ArrowUpRight, Clock, Landmark, History, CheckCircle, PackageX, AlertCircle, Zap, Loader2 } from 'lucide-react';
import type { User, Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, increment } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { VendorOrderDetailsDialog } from '../vendor/vendor-order-details-dialog';
import { RequestPayoutDialog } from '../vendor/RequestPayoutDialog';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePaystackPayment } from 'react-paystack';
import VendorFuelGauge from '../vendor/VendorFuelGauge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export default function VendorWallet({ vendorData }: { vendorData: User }) {
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const [selectedAmount, setSelectedRefillAmount] = useState<number>(50);

  // 1. Paystack Configuration for "Fuel Top Up"
  const paystackConfig = {
    reference: `FUEL_${auth?.currentUser?.uid}_${Date.now()}`,
    email: vendorData.email,
    amount: selectedAmount * 100, // GHS to Pesewas
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
    metadata: {
      custom_fields: [
        { display_name: "Type", variable_name: "type", value: "fuel_topup" },
        { display_name: "VendorID", variable_name: "vendor_id", value: auth?.currentUser?.uid }
      ]
    }
  };

  const initializeTopUp = usePaystackPayment(paystackConfig);

  const handleProcessPayment = () => {
    setShowRefillDialog(false);
    initializeTopUp({
        onSuccess: (reference: any) => {
            toast({
                title: "Fuel Refilled!",
                description: `GHS ${selectedAmount} has been added to your Lead Credits.`,
            });
            if (firestore && auth?.currentUser) {
                const vendorRef = doc(firestore, 'users', auth.currentUser.uid);
                updateDocumentNonBlocking(vendorRef, { 
                    lead_credits: increment(selectedAmount),
                    has_fuel: true,
                    adStatus: 'active'
                });
            }
        },
        onClose: () => {
            toast({ variant: "destructive", title: "Top-up Canceled" });
        }
    });
  };

  // Fetch recent orders for display
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('vendorId', '==', vendorData.id),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [firestore, vendorData.id]);

  // Fetch all orders that are PAID but not yet COMPLETED (This is the Escrow)
  const escrowQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('vendorId', '==', vendorData.id),
      where('status', '==', 'paid')
    );
  }, [firestore, vendorData.id]);
  
  const { data: recentOrders, isLoading: isLoadingRecent } = useCollection<Order>(ordersQuery);
  const { data: escrowOrders, isLoading: isLoadingEscrow } = useCollection<Order>(escrowQuery);

  const pendingEscrowBalance = useMemo(() => {
    if (!escrowOrders) return 0;
    return escrowOrders.reduce((acc, order) => acc + order.amount, 0);
  }, [escrowOrders]);

  const trialLeads = vendorData.trial_leads_count || 0;
  const paidCredits = vendorData.lead_credits || 0;
  const isOutOfFuel = trialLeads <= 0 && paidCredits <= 0;

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
        case 'paid': return 'default';
        case 'picked-up':
        case 'completed': return 'default';
        case 'disputed': return 'destructive';
        case 'inquiry_sent': return 'secondary';
        default: return 'secondary';
    }
  }

  return (
    <div className="space-y-6">
        
        {/* OUT OF FUEL WARNING */}
        {isOutOfFuel && (
          <div className="bg-red-600 text-white p-10 rounded-[3rem] text-center mb-8 shadow-2xl animate-in zoom-in duration-500 border-4 border-white/20">
            <AlertCircle className="mx-auto mb-4" size={48} />
            <h2 className="text-3xl font-black">OUT OF FUEL</h2>
            <p className="text-lg font-bold opacity-90 mt-2">Your services are currently hidden from the Yard.</p>
            <p className="text-sm mt-4 font-medium italic opacity-70">Top up your Lead Credits below to resume receiving professional inquiries.</p>
            <Button 
              onClick={() => setShowRefillDialog(true)}
              className="mt-8 bg-white text-red-600 hover:bg-slate-100 rounded-2xl px-10 py-6 h-auto font-black shadow-xl active:scale-95 transition-all"
            >
              <Zap size={20} fill="currentColor" /> Refill Tank Now
            </Button>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
              <Wallet className="text-primary" /> My Vendor Wallet
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage physical sales and professional lead generation</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. LEAD CREDITS (THE FUEL GAUGE) */}
          <VendorFuelGauge vendorData={vendorData} onRefill={() => setShowRefillDialog(true)} />

          {/* 2. MAIN ACCOUNT (AVAILABLE CASH) */}
          <Card className="bg-foreground text-background p-2 rounded-3xl shadow-xl relative overflow-hidden flex flex-col border-none">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Landmark size={100} />
             </div>
             <CardHeader>
                <CardTitle className="text-muted text-[10px] font-black uppercase tracking-widest">Available Payout</CardTitle>
             </CardHeader>
             <CardContent className="flex-1 flex flex-col justify-center">
                <h2 className="text-5xl font-black mt-2">GHS {vendorData.balance_available?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</h2>
                <p className="text-[10px] font-bold text-muted mt-2">Verified earnings ready for your MoMo</p>
             </CardContent>
             <div className="p-4">
                {vendorData.payoutAccountSetup ? (
                  <RequestPayoutDialog vendor={vendorData}>
                    <Button className="w-full py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-bold transition-all text-base h-auto shadow-lg">
                        <ArrowUpRight size={20} /> Request Payout
                    </Button>
                  </RequestPayoutDialog>
                ) : (
                  <div className="space-y-3">
                    <Button disabled className="w-full py-6 bg-muted text-muted-foreground rounded-2xl font-bold transition-all text-base h-auto">
                        <ArrowUpRight size={20} /> Request Payout
                    </Button>
                    <p className="text-[10px] text-red-400 font-bold text-center px-4 flex items-center justify-center gap-1">
                      <AlertCircle size={10} /> Complete MoMo setup in settings
                    </p>
                  </div>
                )}
             </div>
          </Card>

          {/* 3. ESCROW (LOCKED) */}
          <Card className="p-2 rounded-3xl border-2 border-slate-100 dark:border-border shadow-sm relative overflow-hidden flex flex-col">
             <CardHeader>
                <CardTitle className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Locked In Escrow</CardTitle>
             </CardHeader>
             <CardContent className="flex-1 flex flex-col justify-center">
                <h2 className="text-4xl font-black text-foreground">
                  {isLoadingEscrow ? <Skeleton className="h-12 w-3/4" /> : `GHS ${pendingEscrowBalance.toFixed(2)}`}
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground mt-2">Money awaiting Handshake confirmation</p>
             </CardContent>
             <div className="p-4">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg w-fit border border-amber-100">
                    <Clock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Digital Handshake</span>
                </div>
             </div>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="rounded-2xl shadow-sm border-slate-100 dark:border-border">
          <CardHeader className="flex-row justify-between items-center bg-slate-50/50 dark:bg-muted/20">
            <div className='space-y-1.5'>
                <CardTitle className="flex items-center gap-2">
                <History size={18} /> Recent Activity Ledger
                </CardTitle>
                <CardDescription>Real-time log of physical orders and digital service inquiries.</CardDescription>
            </div>
            <Button variant="ghost" className="text-primary font-black text-xs uppercase tracking-widest">Full Statement</Button>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y">
                {isLoadingRecent ? (
                    [...Array(3)].map((_, i) => <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>)
                ) : recentOrders && recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                        <VendorOrderDetailsDialog key={order.id} order={order}>
                            <div className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors cursor-pointer group">
                                <div className="flex gap-4 items-center">
                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110", 
                                        order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : 
                                        order.status === 'inquiry_sent' ? 'bg-blue-100 text-blue-600' : 'bg-secondary text-secondary-foreground'
                                    )}>
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">{order.productName}</p>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                          {order.status === 'inquiry_sent' ? 'Digital Service Lead' : 'Physical Sale'} • {order.buyerName}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-foreground">
                                      {order.status === 'inquiry_sent' ? 'Service Introduction' : `+ GHS ${order.amount.toFixed(2)}`}
                                    </p>
                                    <Badge variant={getStatusVariant(order.status)} className={cn('mt-1 font-black text-[8px] uppercase tracking-widest', order.status === 'completed' && 'bg-green-600 hover:bg-green-700 text-white')}>
                                        {order.status.replace('_', ' ')}
                                    </Badge>
                                </div>
                            </div>
                        </VendorOrderDetailsDialog>
                    ))
                ) : (
                    <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
                        <PackageX size={48} className="mb-4 opacity-20" />
                        <p className="font-black text-lg">Your Yard is Quiet</p>
                        <p className="text-xs max-w-xs mx-auto mt-2">No orders or leads found. Try boosting your products to capture more campus vibes!</p>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>

        {/* REFILL DIALOG */}
        <Dialog open={showRefillDialog} onOpenChange={setShowRefillDialog}>
          <DialogContent className="sm:max-w-md rounded-[2.5rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Refill Lead Fuel</DialogTitle>
              <DialogDescription className="font-medium">Choose a fuel amount to resume receiving inquiries from the Yard.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 py-6">
              {[50, 100, 200].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setSelectedRefillAmount(amt)}
                  className={cn(
                    "p-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                    selectedAmount === amt ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:border-primary/30 bg-muted/30"
                  )}
                >
                  <span className="text-[10px] font-black text-muted-foreground uppercase">GHS</span>
                  <span className="text-2xl font-black">{amt}</span>
                </button>
              ))}
            </div>
            <DialogFooter className="bg-muted/30 p-6 -mx-6 -mb-6 border-t">
              <Button variant="ghost" onClick={() => setShowRefillDialog(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button onClick={handleProcessPayment} className="rounded-xl font-black bg-slate-900 text-white px-8 h-12 shadow-xl active:scale-95 transition-all">
                Pay with MoMo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}