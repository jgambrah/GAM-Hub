'use client';

import React, { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Banknote, AlertTriangle, CheckCircle, MessageSquare, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function LiaisonFinanceCenter() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // Store the ID of the order being actioned

  // 1. Listen for Payouts (Orders picked up but not yet finalized)
  const payoutsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), where('status', '==', 'picked-up'));
  }, [firestore]);
  const { data: pendingPayouts, isLoading: isLoadingPayouts } = useCollection<Order>(payoutsQuery);

  // 2. Listen for Active Disputes
  const disputesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), where('status', '==', 'disputed'));
  }, [firestore]);
  const { data: activeDisputes, isLoading: isLoadingDisputes } = useCollection<Order>(disputesQuery);

  const handleAction = (orderId: string, action: 'completed' | 'refunded') => {
    if (!firestore) return;
    setLoadingAction(orderId);
    
    const orderRef = doc(firestore, 'orders', orderId);
    
    updateDocumentNonBlocking(orderRef, {
      status: action,
      resolvedAt: new Date().toISOString(),
      liaisonDecision: action === 'completed' ? 'payout' : 'refund',
    });

    toast({
      title: `Order ${action}`,
      description: `The order #${orderId.slice(-6)} has been finalized.`,
    });
    
    // The component will disappear from the list on the next data snapshot,
    // so we don't need to manually reset loadingAction to null in a `finally` block.
  };

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
        <Banknote className="text-primary" /> Liaison Finance Center
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Section 1: Pending Payouts */}
        <Card className="flex flex-col">
          <CardHeader className="bg-green-50/50 dark:bg-green-900/20">
            <CardTitle className="flex justify-between items-center text-green-800 dark:text-green-300">
              <span className="flex items-center gap-2"><CheckCircle size={20} /> Ready for Payout</span>
               <Badge variant="secondary" className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100">
                {pendingPayouts?.length || 0} ORDERS
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {isLoadingPayouts ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
              ) : pendingPayouts && pendingPayouts.length > 0 ? (
                pendingPayouts.map(order => {
                  const isActing = loadingAction === order.id;
                  return (
                    <div key={order.id} className="p-6 hover:bg-muted/50 transition-colors space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-foreground">{order.productName}</p>
                          <p className="text-sm text-muted-foreground">Vendor: {order.vendorId.slice(-6)} • {order.campusId.toUpperCase()}</p>
                        </div>
                        <p className="font-bold text-lg text-green-600">GH₵{order.amount.toFixed(2)}</p>
                      </div>
                      <Button 
                        onClick={() => handleAction(order.id, 'completed')}
                        disabled={isActing}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                         {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Release Payout to Vendor
                      </Button>
                    </div>
                  )
                })
              ) : (
                <p className="p-10 text-center text-muted-foreground">No pending payouts.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Active Disputes */}
        <Card className="flex flex-col">
          <CardHeader className="bg-red-50/50 dark:bg-red-900/20">
            <CardTitle className="flex justify-between items-center text-red-800 dark:text-red-300">
              <span className="flex items-center gap-2"><AlertTriangle size={20} /> Active Disputes</span>
              <Badge variant="destructive" className="bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100">
                 {activeDisputes?.length || 0} FLAGGED
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[600px] overflow-y-auto">
               {isLoadingDisputes ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
              ) : activeDisputes && activeDisputes.length > 0 ? (
                activeDisputes.map(order => {
                   const isActing = loadingAction === order.id;
                  return (
                    <div key={order.id} className="p-6 bg-red-50/30 dark:bg-red-900/10 space-y-4">
                      <div className="flex justify-between items-start">
                         <p className="font-semibold text-foreground">{order.productName}</p>
                         <p className="font-bold text-lg text-red-600 underline">GH₵{order.amount.toFixed(2)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground italic">
                        "Order was flagged by buyer: {order.buyerName}"
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <MessageSquare size={14} />
                          View Chat
                        </Button>
                         <Button 
                          onClick={() => handleAction(order.id, 'refunded')}
                          disabled={isActing}
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                        >
                          {loadingAction === order.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Refund Student
                        </Button>
                        <Button 
                          onClick={() => handleAction(order.id, 'completed')}
                          disabled={isActing}
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {loadingAction === order.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Pay Vendor
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="p-10 text-center text-muted-foreground">No active disputes. Markets are clean!</p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
