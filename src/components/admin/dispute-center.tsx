'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, doc, where, getDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { 
    ShieldAlert, CheckCircle, XCircle, MessageSquare, ExternalLink, 
    Image as ImageIcon, Scale, Loader2, Phone, CreditCard, User as UserIcon, Store 
} from 'lucide-react';
import type { Dispute, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';


export function DisputeCenter() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [buyerProfile, setBuyerProfile] = useState<User | null>(null);
  const [vendorProfile, setVendorProfile] = useState<User | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // 1. Listen for all pending/investigating disputes
  const disputesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'disputes'), where('status', 'in', ['pending', 'investigating']));
  }, [firestore]);

  const { data: disputes, isLoading: isLoadingDisputes } = useCollection<Dispute>(disputesQuery);

  // 2. Fetch profiles when a dispute is selected
  useEffect(() => {
    async function fetchParties() {
      if (!selectedDispute || !firestore) return;
      setIsLoadingContacts(true);
      try {
        const buyerSnap = await getDoc(doc(firestore, 'users', selectedDispute.buyerId));
        const vendorSnap = await getDoc(doc(firestore, 'users', selectedDispute.vendorId));
        setBuyerProfile(buyerSnap.exists() ? buyerSnap.data() as User : null);
        setVendorProfile(vendorSnap.exists() ? vendorSnap.data() as User : null);
      } catch (err) {
        console.error("Liaison Error fetching contact data:", err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch party details.' });
      } finally {
        setIsLoadingContacts(false);
      }
    }
    fetchParties();
  }, [selectedDispute, firestore, toast]);

  const handleResolve = async (decision: 'refund' | 'payout') => {
    if (!selectedDispute || !firestore) return;
    setIsResolving(true);

    try {
      const orderRef = doc(firestore, 'orders', selectedDispute.orderId);
      const disputeRef = doc(firestore, 'disputes', selectedDispute.id);

      const finalOrderStatus = decision === 'refund' ? 'refunded' : 'completed';
      const finalDisputeStatus = decision === 'refund' ? 'resolved_refund' : 'resolved_payout';
      
      const orderUpdatePayload: any = {
        status: finalOrderStatus,
        liaisonDecision: decision,
        resolvedAt: new Date().toISOString(),
      };
      
      if (decision === 'payout') {
        orderUpdatePayload.payoutStatus = 'pending';
      }
      
      updateDocumentNonBlocking(orderRef, orderUpdatePayload);

      updateDocumentNonBlocking(disputeRef, {
        status: finalDisputeStatus,
        liaisonNotes: `Resolved by Liaison: ${decision}`,
        resolvedAt: new Date().toISOString()
      });

      toast({
          title: "Justice Served!",
          description: `The dispute has been resolved. The order is now '${finalOrderStatus}'.`,
      });
      setSelectedDispute(null);
    } catch (err) {
      console.error(err);
      toast({
          variant: 'destructive',
          title: "Error",
          description: "Could not resolve the dispute."
      })
    } finally {
      setIsResolving(false);
    }
  };
  
  const SkeletonQueueItem = () => (
      <div className="p-4">
          <div className="flex justify-between items-start mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-24 mt-2" />
      </div>
  );

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-muted/30 border-t">
      {/* Sidebar: The Queue */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold font-headline flex items-center gap-2">
            <ShieldAlert className="text-destructive" />
            Dispute Queue
          </h2>
        </div>
        <div className="divide-y">
          {isLoadingDisputes ? (
            <>
                <SkeletonQueueItem />
                <SkeletonQueueItem />
                <SkeletonQueueItem />
            </>
          ) : disputes && disputes.length > 0 ? (
            disputes.map((d) => (
              <div 
                key={d.id} 
                onClick={() => setSelectedDispute(d)}
                className={cn('p-4 cursor-pointer hover:bg-muted transition-colors', selectedDispute?.id === d.id ? 'bg-primary/10 border-l-4 border-primary' : '')}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Order #{d.orderId.slice(-6)}</span>
                   <Badge variant={d.status === 'pending' ? 'destructive' : 'secondary'}>{d.status}</Badge>
                </div>
                <p className="font-bold text-foreground truncate">{d.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">Buyer ID: <span className="font-mono">{d.buyerId.slice(-6)}</span></p>
              </div>
            ))
          ) : (
             <div className="p-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <p className="font-semibold">All disputes are settled!</p>
                <p className="text-sm">The queue is empty.</p>
             </div>
          )}
        </div>
      </div>

      {/* Main Content: The Evidence & Decision */}
      <div className="flex-1 overflow-y-auto">
        {selectedDispute ? (
          <div className="p-6 md:p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-4">
              <div>
                 <h1 className="text-3xl font-black text-slate-900 dark:text-white">Case #D-{selectedDispute.id.slice(-6)}</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Liaison Arbitration in Progress</p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <Button 
                  onClick={() => handleResolve('refund')}
                  disabled={isResolving}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 font-black"
                >
                  {isResolving ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle size={18} />}
                  Refund Student
                </Button>
                <Button 
                  onClick={() => handleResolve('payout')}
                  disabled={isResolving}
                  className="bg-green-600 hover:bg-green-700 text-white font-black"
                >
                  {isResolving ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle size={18} />}
                  Payout Vendor
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* THE PARTIES: CONTACT PANEL */}
              <div className="space-y-6">
                {/* BUYER (STUDENT/STAFF) */}
                <div className="bg-white dark:bg-card p-6 rounded-[2.5rem] border border-slate-100 dark:border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-2xl"><UserIcon size={20}/></div>
                    <h3 className="font-black text-slate-800 dark:text-foreground">Buyer Information</h3>
                  </div>
                  {isLoadingContacts ? <Skeleton className="h-24 w-full" /> : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase">Name</span>
                          <span className="font-bold text-slate-900 dark:text-foreground">{buyerProfile?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase">Contact Phone</span>
                          <a href={`tel:${buyerProfile?.contactPhone}`} className="flex items-center gap-2 text-blue-600 font-black underline">
                            <Phone size={14} /> {buyerProfile?.contactPhone || 'No number'}
                          </a>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase">Refund MoMo</span>
                          <span className="flex items-center gap-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                            <CreditCard size={14} className="text-slate-300 dark:text-slate-500" /> {selectedDispute.refundNumber || buyerProfile?.momoNumber}
                          </span>
                        </div>
                      </div>
                  )}
                </div>

                {/* VENDOR (THE SHOP) */}
                <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-white/10 text-blue-400 rounded-2xl"><Store size={20}/></div>
                    <h3 className="font-black text-white">Vendor Information</h3>
                  </div>
                  {isLoadingContacts ? <Skeleton className="h-24 w-full bg-slate-800" /> : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Business</span>
                          <span className="font-bold text-white">{vendorProfile?.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Business Line</span>
                          <a href={`tel:${vendorProfile?.contactPhone}`} className="flex items-center gap-2 text-blue-400 font-black underline">
                            <Phone size={14} /> {vendorProfile?.contactPhone}
                          </a>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase">Payout MoMo</span>
                          <span className="font-mono font-bold text-slate-300">{vendorProfile?.momoNumber}</span>
                        </div>
                      </div>
                  )}
                </div>
              </div>

              {/* EVIDENCE & CONTEXT */}
              <div className="bg-card p-6 rounded-[2.5rem] border shadow-sm">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert size={18} /> The Complaint
                </h3>
                <p className="text-muted-foreground leading-relaxed italic mb-6">"{selectedDispute.reason}"</p>

                 <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <ImageIcon size={18} /> Submitted Evidence
                  </h3>
                  {selectedDispute.evidenceUrls && selectedDispute.evidenceUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {selectedDispute.evidenceUrls?.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <Image src={url} width={200} height={150} className="rounded-lg border hover:scale-105 transition-transform object-cover aspect-video" alt={`evidence ${i+1}`} />
                        </a>
                        ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4 mb-6">No evidence was uploaded.</p>}
                  
                <Button variant="secondary" className="w-full">
                  <ExternalLink size={16} /> Open Chat History
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Scale size={64} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a dispute to begin resolution</p>
          </div>
        )}
      </div>
    </div>
  );
}
