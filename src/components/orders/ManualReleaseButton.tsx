'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Order } from '@/lib/types';

interface ManualReleaseButtonProps {
    order: Order;
}

export function ManualReleaseButton({ order }: ManualReleaseButtonProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);

    const handleConfirm = async () => {
        if (!firestore) return;
        setIsLoading(true);

        const orderRef = doc(firestore, 'orders', order.id);
        
        try {
            updateDocumentNonBlocking(orderRef, {
                status: 'picked-up',
                receivedAt: new Date().toISOString(),
            });

            toast({
                title: 'Item Received!',
                description: 'You have manually confirmed receipt of your order.',
            });
            setOpen(false);

        } catch(error) {
            console.error("Manual release failed:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not update your order. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-amber-100 h-auto hover:bg-amber-600">
                    Confirm Receipt Manually
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will confirm you have received your item, <span className="font-bold">{order.productName}</span>. This action cannot be undone and will release the payment to the vendor.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, I have my item
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
