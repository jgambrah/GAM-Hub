
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { addDocumentNonBlocking, useFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { User } from '@/lib/types';

const payoutSchema = z.object({
  amount: z.coerce.number().positive('Please enter a valid amount.'),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;

interface RequestPayoutDialogProps {
  vendor: User;
  children: React.ReactNode;
}

export function RequestPayoutDialog({ vendor, children }: RequestPayoutDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const availableBalance = vendor.balance_available || 0;

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema.refine(data => data.amount <= availableBalance, {
        message: "Amount cannot exceed available balance.",
        path: ["amount"],
    })),
    defaultValues: { amount: 0 },
  });

  async function onSubmit(data: PayoutFormValues) {
    if (!firestore || !vendor.momoNumber || !vendor.momoBankCode) {
        toast({ variant: 'destructive', title: 'Profile Incomplete', description: 'Please ensure your MoMo details are set up in your profile.' });
        return;
    }
    setIsLoading(true);

    const newRequest = {
      vendorId: vendor.id,
      vendorName: vendor.name,
      amount: data.amount,
      momoNumber: vendor.momoNumber,
      momoBankCode: vendor.momoBankCode,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    try {
        await addDocumentNonBlocking(collection(firestore, 'payout_requests'), newRequest);
        toast({ title: 'Request Sent!', description: `Your request to withdraw GHS ${data.amount.toFixed(2)} is pending.` });
        setOpen(false);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your request.' });
    } finally {
        setIsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) {
        form.reset({ amount: 0 });
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
          <DialogDescription>Withdraw funds from your available balance to your registered MoMo account.</DialogDescription>
        </DialogHeader>
        <div className="p-4 my-4 bg-muted rounded-lg border">
            <p className="text-xs font-bold text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold text-foreground">GHS {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount to Withdraw (GHS)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
