'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Product } from '@/lib/types';
import { BoostProduct } from './BoostProduct';
import Image from 'next/image';

interface VendorProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorProductDialog({ product, open, onOpenChange }: VendorProductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Product</DialogTitle>
          <DialogDescription>
            Edit, view stats, or boost your product listing.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
            <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-md object-cover aspect-square" data-ai-hint={product.imageHint} />
                <div>
                    <h4 className="font-semibold">{product.name}</h4>
                    <p className="text-lg font-bold">GH₵{product.price.toFixed(2)}</p>
                </div>
            </div>

            <BoostProduct product={product} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
