'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Order } from '@/lib/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface RaiseDisputeDialogProps {
  order: Order;
  children: React.ReactNode;
}

export function RaiseDisputeDialog({ order, children }: RaiseDisputeDialogProps) {
  const { auth, firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [files, setFiles] = React.useState<FileList | null>(null);
  const [refundNumber, setRefundNumber] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firestore || !storage || !auth.currentUser || !reason || !refundNumber) {
        toast({
            variant: 'destructive',
            title: 'Missing Information',
            description: 'Please provide a reason and a refund MoMo number.',
        });
        return;
    }
    setIsLoading(true);

    try {
        // 1. Upload evidence if provided
        const evidenceUrls: string[] = [];
        if (files) {
            for (const file of Array.from(files)) {
                const evidenceRef = ref(storage, `dispute_evidence/${order.id}/${Date.now()}_${file.name}`);
                await uploadBytes(evidenceRef, file);
                const url = await getDownloadURL(evidenceRef);
                evidenceUrls.push(url);
            }
        }
        
        // 2. Create the dispute document
        const disputeData = {
            orderId: order.id,
            buyerId: order.buyerId,
            vendorId: order.vendorId,
            reason: reason,
            evidenceUrls: evidenceUrls,
            status: 'pending',
            createdAt: new Date().toISOString(),
            refundNumber: refundNumber,
        };
        addDocumentNonBlocking(collection(firestore, 'disputes'), disputeData);

        // 3. Update the order status to 'disputed'
        updateDocumentNonBlocking(doc(firestore, 'orders', order.id), { status: 'disputed' });

        toast({
            title: 'Dispute Raised',
            description: 'The admin has been notified and will review your case.',
        });
        setOpen(false);
        setReason('');
        setFiles(null);
        setRefundNumber('');
    } catch (error: any) {
        console.error("Error raising dispute: ", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not raise dispute. Please try again.',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Raise a Dispute for Order</DialogTitle>
          <DialogDescription>
            For product: <strong>{order.productName}</strong>. Explain the issue below. An admin will investigate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Dispute</Label>
                <Textarea
                    id="reason"
                    placeholder="e.g., The item was not as described, it arrived damaged..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                />
            </div>
            <div className="space-y-2">
                 <Label htmlFor="evidence">Upload Evidence (Optional)</Label>
                 <Input 
                    id="evidence"
                    type="file" 
                    multiple
                    onChange={(e) => setFiles(e.target.files)}
                />
                <p className="text-xs text-muted-foreground">You can upload images or videos as proof.</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                <Label htmlFor="refundNumber" className="text-[10px] font-black text-red-600 dark:text-red-300 uppercase mb-2">Refund MoMo Details</Label>
                <Input 
                    id="refundNumber"
                    required 
                    type="tel" 
                    placeholder="Number for Refund (GHS)"
                    className="w-full mt-2 p-3 h-auto rounded-xl bg-white dark:bg-card border-none outline-none text-sm font-bold"
                    value={refundNumber}
                    onChange={(e) => setRefundNumber(e.target.value)}
                />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !reason || !refundNumber} variant="destructive" className="bg-amber-600 hover:bg-amber-700 text-white">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                Submit Dispute
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
