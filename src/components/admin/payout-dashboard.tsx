'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, doc, writeBatch, serverTimestamp, increment, orderBy } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { Landmark, Download, Send, Calculator, Users, Loader2, Wallet, User as UserIcon, CheckCircle, XCircle } from 'lucide-react';
import type { Order, User, PayoutRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// --- BATCH PAYOUTS (EXISTING LOGIC) ---
function BatchPayoutsTab() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingOrdersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'completed'),
      where('payoutStatus', '==', 'pending')
    );
  }, [firestore]);

  const { data: pendingOrders, isLoading: isLoadingOrders } = useCollection<Order>(pendingOrdersQuery);
  
  const vendorsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'), where('role', '==', 'vendor'));
  }, [firestore]);

  const { data: vendors, isLoading: isLoadingVendors } = useCollection<User>(vendorsQuery);

  const vendorsMap = useMemo(() => {
      if (!vendors) return new Map<string, User>();
      return new Map(vendors.map(v => [v.id, v]));
  }, [vendors]);

  const { payoutList, totalBatchAmount } = useMemo(() => {
    if (!pendingOrders) return { payoutList: [], totalBatchAmount: 0 };
    
    const vendorPayouts = pendingOrders.reduce((acc: any, order) => {
      const vendorId = order.vendorId;
      const vendorInfo = vendorsMap.get(vendorId);

      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendorId,
          vendorName: vendorInfo?.name || 'Unknown Vendor',
          momoNumber: vendorInfo?.momoNumber || 'N/A',
          momoName: vendorInfo?.momoName || 'N/A',
          momoBankCode: vendorInfo?.momoBankCode || 'N/A',
          totalAmount: 0,
          orderCount: 0,
          orderIds: []
        };
      }
      acc[vendorId].totalAmount += order.amount;
      acc[vendorId].orderCount += 1;
      acc[vendorId].orderIds.push(order.id);
      return acc;
    }, {});
    
    const list = Object.values(vendorPayouts);
    const total = list.reduce((sum: any, p: any) => sum + p.totalAmount, 0);

    return { payoutList: list, totalBatchAmount: total };
  }, [pendingOrders, vendorsMap]);

  const downloadPayoutCSV = () => {
    if (payoutList.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    };
    const headers = ["Vendor Name", "Account Name", "MoMo Number", "Provider", "Total Amount (GHS)", "Orders Count"];
    const rows = payoutList.map((p: any) => [p.vendorName, p.momoName, p.momoNumber, p.momoBankCode, p.totalAmount, p.orderCount]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GAM_Hub_Payout_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleMarkAllPaid = async () => {
    if (!firestore || !pendingOrders || pendingOrders.length === 0) return;
    
    setIsProcessing(true);
    const batch = writeBatch(firestore);
    const payoutBatchId = `BATCH_${Date.now()}`;
    
    pendingOrders.forEach(order => {
        const orderRef = doc(firestore, 'orders', order.id);
        batch.update(orderRef, { 
            payoutStatus: 'paid',
            payoutDate: new Date().toISOString(),
            payoutBatchId: payoutBatchId,
            status: 'archived'
        });
    });
    
    try {
        await batch.commit();
        toast({
            title: "Batch Processed!",
            description: `${pendingOrders.length} orders have been marked as paid and archived.`
        });
    } catch (err) {
        console.error(err);
        toast({
            variant: 'destructive',
            title: 'Error processing batch',
            description: 'Could not mark all orders as paid. Please try again.'
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const isLoading = isLoadingOrders || isLoadingVendors;

  return (
    <Card>
        <CardHeader>
            <CardTitle>Automatic Payouts from Completed Orders</CardTitle>
            <CardDescription>These are funds released from escrow after a successful Digital Handshake.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Batch Payout</CardTitle>
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-4/5" /> : `GH₵ ${totalBatchAmount.toLocaleString()}`}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendors in Batch</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoading ? <Skeleton className="h-8 w-1/3" /> : payoutList.length}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="flex gap-3 flex-shrink-0">
                <Button onClick={downloadPayoutCSV} variant="outline" disabled={isProcessing || payoutList.length === 0}><Download size={18} /><span>Export for Bank</span></Button>
                <Button onClick={handleMarkAllPaid} disabled={isProcessing || payoutList.length === 0}>{isProcessing ? <Loader2 className="animate-spin" /> : <Send size={18} />}<span>Mark All as Paid</span></Button>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow><TableHead>Vendor / Account Name</TableHead><TableHead>MoMo Number / Provider</TableHead><TableHead>Orders</TableHead><TableHead>Total (GHS)</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {isLoading ? ([...Array(2)].map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full"/></TableCell></TableRow>))) : 
                     payoutList.length > 0 ? (payoutList.map((p: any) => (
                        <TableRow key={p.vendorId}>
                        <TableCell><p className="font-medium">{p.vendorName}</p><p className="text-xs text-muted-foreground">{p.momoName}</p></TableCell>
                        <TableCell><p className="font-mono">{p.momoNumber}</p><p className="text-xs text-muted-foreground">{p.momoBankCode}</p></TableCell>
                        <TableCell><Badge variant="secondary">{p.orderCount} Orders</Badge></TableCell>
                        <TableCell className="font-semibold">{p.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right"><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">Pending Payout</Badge></TableCell>
                        </TableRow>
                     ))) : 
                     (<TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No pending payouts from completed orders.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  )
}

// --- VENDOR WITHDRAWAL REQUESTS (NEW LOGIC) ---
function WithdrawalRequestsTab() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'payout_requests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    }, [firestore]);
    
    const { data: requests, isLoading } = useCollection<PayoutRequest>(requestsQuery);

    const handleProcessRequest = async (request: PayoutRequest, action: 'paid' | 'rejected') => {
        if (!firestore) return;
        setProcessingId(request.id);
        
        const requestRef = doc(firestore, 'payout_requests', request.id);
        const vendorRef = doc(firestore, 'users', request.vendorId);
        
        try {
            if (action === 'paid') {
                const batch = writeBatch(firestore);
                batch.update(requestRef, { status: 'paid', processedAt: serverTimestamp() });
                batch.update(vendorRef, { balance_available: increment(-request.amount) });
                await batch.commit();
                toast({ title: 'Payout Marked as Paid', description: `GHS ${request.amount.toFixed(2)} has been deducted from ${request.vendorName}'s balance.`});
            } else { // 'rejected'
                updateDocumentNonBlocking(requestRef, { status: 'rejected', processedAt: serverTimestamp() });
                toast({ variant: 'destructive', title: 'Payout Rejected', description: 'The request has been marked as rejected.' });
            }
        } catch(e: any) {
            console.error("Error processing payout request:", e);
            toast({ variant: 'destructive', title: 'Transaction Error', description: e.message || "Could not process the request."});
        } finally {
            setProcessingId(null);
        }
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Vendor Withdrawal Requests</CardTitle>
                <CardDescription>Vendors manually requesting to withdraw their available balance.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>MoMo Details</TableHead><TableHead className="text-right">Amount (GHS)</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {isLoading ? ([...Array(3)].map((_, i) => (<TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>))) :
                         requests && requests.length > 0 ? (
                            requests.map((req) => {
                                const isProcessing = processingId === req.id;
                                return (
                                <TableRow key={req.id}>
                                    <TableCell><div className="font-medium">{req.vendorName}</div><div className="text-xs text-muted-foreground font-mono">{req.vendorId.slice(-6)}</div></TableCell>
                                    <TableCell><div className="font-mono">{req.momoNumber}</div><div className="text-xs text-muted-foreground">{req.momoBankCode}</div></TableCell>
                                    <TableCell className="text-right font-bold text-lg">{req.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex gap-2 justify-center">
                                            <Button size="sm" variant="destructive" disabled={isProcessing} onClick={() => handleProcessRequest(req, 'rejected')}><XCircle size={16}/>Reject</Button>
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={isProcessing} onClick={() => handleProcessRequest(req, 'paid')}>
                                                {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle size={16} />}
                                                Mark as Paid
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                         ) : 
                         (<TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No pending withdrawal requests.</TableCell></TableRow>)}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// --- MAIN COMPONENT ---
export function PayoutDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Vendor Payouts</h1>
        <p className="text-muted-foreground">Manage automatic batch payouts and manual withdrawal requests.</p>
      </div>
      
      <Tabs defaultValue="withdrawals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="withdrawals"><Wallet className="mr-2"/>Withdrawal Requests</TabsTrigger>
            <TabsTrigger value="batch"><Landmark className="mr-2"/>Order Batch Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="withdrawals" className="mt-6">
            <WithdrawalRequestsTab />
        </TabsContent>
        <TabsContent value="batch" className="mt-6">
            <BatchPayoutsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
