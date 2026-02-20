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
import { Badge } from '@/components/ui/badge';
import type { Order, User } from '@/lib/types';
import { VendorDeliveryQR } from '../orders/vendor-delivery-qr';
import { MapPin, Building2, User as UserIcon, UserCheck, Phone, Navigation, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

interface VendorOrderDetailsDialogProps {
  order: Order;
  children: React.ReactNode;
}

export function VendorOrderDetailsDialog({ order, children }: VendorOrderDetailsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  // Fetch the buyer's profile to get their verified phone number
  const buyerRef = useMemoFirebase(() => {
    if (!firestore || !order.buyerId) return null;
    return doc(firestore, 'users', order.buyerId);
  }, [firestore, order.buyerId]);

  const { data: buyer, isLoading: isBuyerLoading } = useDoc<User>(buyerRef);

  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
        case 'paid': return 'default';
        case 'picked-up':
        case 'completed': return 'default';
        case 'disputed': return 'destructive';
        case 'inquiry_sent': return 'secondary';
        default: return 'secondary';
    }
  }

  const getDeliveryIcon = (mode: Order['deliveryMode']) => {
    if (mode === 'office_delivery') return <Building2 size={16} />;
    if (mode === 'service_inquiry') return <UserCheck size={16} />;
    return <MapPin size={16} />;
  }

  const getDeliveryLocationText = (order: Order) => {
    if (order.deliveryMode === 'office_delivery' && order.deliveryLocation) {
        return `${order.deliveryLocation.department}, Room ${order.deliveryLocation.roomNumber}`;
    }
    if (order.deliveryMode === 'service_inquiry' && order.deliveryLocation) {
        let text = `Preference: ${order.deliveryLocation.servicePreference || 'Consultation'}`;
        if (order.deliveryLocation.department) {
            text += ` (${order.deliveryLocation.department}, Room ${order.deliveryLocation.roomNumber})`;
        }
        return text;
    }
    return order.deliveryLocation?.pointName || 'N/A';
  }

  const handleMarkConsulted = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firestore) return;
    const orderRef = doc(firestore, 'orders', order.id);
    
    // Services transition directly to completed when marked as consulted
    updateDocumentNonBlocking(orderRef, { status: 'completed' });
    
    toast({ 
      title: "Lead Consulted", 
      description: "The service lead has been successfully closed." 
    });
    setOpen(false);
  };

  const isService = order.deliveryMode === 'service_inquiry';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-[3rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black text-3xl tracking-tight">
            {isService ? 'Digital Lead' : 'Order Intel'}
          </DialogTitle>
          <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
            {isService ? 'New prospective client inquiry' : `Ref: ${order.id.slice(-8).toUpperCase()}`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
            {isService ? (
                /* 🏦 THE DIGITAL SERVICE LEAD UI */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-8 rounded-[3rem] border-2 border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-5 text-blue-900">
                          <UserCheck size={150} />
                        </div>
                        
                        <h4 className="font-black text-blue-900 dark:text-blue-200 mb-4 flex items-center gap-2">
                            <div className="p-2 bg-blue-600 rounded-xl text-white"><UserCheck size={18} /></div>
                            New Prospect Inquiry
                        </h4>
                        
                        <div className="space-y-4 relative z-10">
                            <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                                <b>{order.buyerName}</b> has requested a <b>{order.deliveryLocation.servicePreference || 'consultation'}</b> regarding <b>{order.productName}</b>.
                            </p>
                            
                            <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Target Location</p>
                                <div className="flex items-center gap-3">
                                    <Building2 className="text-blue-600" size={18} />
                                    <p className="font-black text-sm text-slate-900 dark:text-slate-100">
                                        {order.deliveryLocation.department || 'The Yard'} • Room {order.deliveryLocation.roomNumber || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3 relative z-10 mt-8">
                            {isBuyerLoading ? (
                                <Skeleton className="h-14 w-full rounded-2xl" />
                            ) : (
                                <a 
                                    href={`tel:${buyer?.contactPhone}`} 
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                        "w-full py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm text-center flex items-center justify-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-95",
                                        !buyer?.contactPhone && "opacity-50 pointer-events-none"
                                    )}
                                >
                                    <Phone size={16} /> 
                                    {buyer?.contactPhone ? `Call Prospect (${buyer.contactPhone})` : 'No phone number provided'}
                                </a>
                            )}

                            {order.deliveryLocation.latitude && (
                                <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLocation.latitude},${order.deliveryLocation.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-sm text-center flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-100 dark:shadow-none"
                                >
                                    <Navigation size={16} /> Open Navigator
                                </a>
                            )}
                            
                            <Button 
                                onClick={handleMarkConsulted}
                                variant="outline" 
                                className="w-full py-6 border-2 border-blue-200 text-blue-600 dark:text-blue-400 dark:border-blue-800 rounded-[1.5rem] font-black text-sm h-auto bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
                            >
                                <CheckCircle size={18} /> Mark as Consulted
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* 📦 PHYSICAL PRODUCT FLOW */
                <div className="space-y-6">
                    {order.status === 'paid' ? (
                        <VendorDeliveryQR orderId={order.id} />
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-6 bg-muted rounded-[2.5rem] border shadow-inner">
                                <div>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Stock Request</p>
                                  <h4 className="font-black text-lg">{order.productName}</h4>
                                </div>
                                <p className="font-black text-2xl text-primary">GHS {order.amount.toFixed(2)}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-6 border rounded-[2.5rem] bg-card shadow-sm">
                                    <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Buyer Intel</h5>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center border shadow-sm">
                                            <UserIcon size={24} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground">{order.buyerName}</p>
                                            <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest border-primary/20 text-primary">{order.buyerType}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border">
                                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm text-primary">
                                            {getDeliveryIcon(order.deliveryMode)}
                                        </div>
                                        <p className="font-black text-xs text-foreground leading-tight">{getDeliveryLocationText(order)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center pt-6">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Workflow State</p>
                                <Badge variant={getStatusVariant(order.status)} className={cn("text-lg px-10 py-4 rounded-[1.5rem] font-black shadow-lg", order.status === 'completed' && 'bg-green-600 hover:bg-green-700 text-white')}>
                                    {order.status.replace(/_/g, ' ').toUpperCase()}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-8 italic px-10 leading-relaxed font-bold opacity-60">
                                   {order.status === 'awaiting_confirmation' ? 'Action Required: Please confirm you have stock to enable buyer payment.' : order.status === 'confirmed' ? 'Waiting for the buyer to authorize Escrow payment.' : 'The transaction phase for this request is complete.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
