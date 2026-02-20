'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { LeaveReviewForm } from './LeaveReviewForm';
import type { Order } from '@/lib/types';

interface LeaveReviewDialogProps {
  order: Order;
  children: React.ReactNode;
}

export function LeaveReviewDialog({ order, children }: LeaveReviewDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <DialogTitle>Rate Your Purchase</DialogTitle>
          <DialogDescription>
            Your feedback helps other students make better choices.
          </DialogDescription>
        </DialogHeader>
        <LeaveReviewForm order={order} onReviewSubmitted={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
