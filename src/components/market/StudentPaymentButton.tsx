'use client';

import React from 'react';
import { usePaystackPayment } from 'react-paystack';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CreditCard } from 'lucide-react';
import type { Order, User } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CommunityPaymentButtonProps {
    order: Order;
    userProfile: User;
    onSuccessAction?: (reference?: any) => void;
}

export default function CommunityPaymentButton({ order, userProfile, onSuccessAction }: CommunityPaymentButtonProps) {
    const { toast } = useToast();
    const isStaff = userProfile?.role === 'staff';

    const config = {
        reference: `GAM_${order.id}_${new Date().getTime()}`,
        email: userProfile.email,
        amount: Math.round(order.amount * 100), // GHS to Pesewas
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY as string,
        currency: 'GHS',
        channels: ['mobile_money'], // Force MoMo only
    };

    const initializePayment = usePaystackPayment(config);

    const onSuccess = (reference: any) => {
        toast({
            title: isStaff ? "Payment Authorized" : "Payment Successful!",
            description: isStaff ? "Your order is now secured in Escrow, Professor." : "Your GHS is safe with the Liaison. We'll confirm the transaction shortly.",
        });

        if (onSuccessAction) {
            onSuccessAction(reference);
        } else {
            window.location.reload();
        }
    };

    const onClose = () => {
        toast({
            variant: "destructive",
            title: "Payment Canceled",
            description: "The payment process was not completed.",
        });
    }

    return (
        <Button
            onClick={() => initializePayment({ onSuccess, onClose })}
            className={cn(
                "w-full py-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl",
                isStaff
                ? 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800' // Professional Staff Vibe
                : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'   // Energetic Student Vibe
            )}
        >
            <CreditCard size={20} />
            {isStaff ? `Authorize Escrow: GHS ${order.amount.toFixed(2)}` : `Confirm & Pay GHS ${order.amount.toFixed(2)}`}
        </Button>
    );
}
