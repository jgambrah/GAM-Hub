'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BuyerQRScanner } from './BuyerQRScanner';
import type { Order } from '@/lib/types';

interface ScanReceiptDialogProps {
  order: Order;
  children: React.ReactNode;
}

export function ScanReceiptDialog({ order, children }: ScanReceiptDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleSuccess = () => {
    setOpen(false); // Close dialog on successful scan
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 bg-transparent border-0 shadow-none">
        <DialogHeader className="hidden">
          <DialogTitle>Scan QR Code</DialogTitle>
        </DialogHeader>
        <BuyerQRScanner 
            expectedOrderId={order.id} 
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
