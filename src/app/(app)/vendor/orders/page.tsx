'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import type { Order, User } from '@/lib/types';
import {
  Package, MapPin, Building2, QrCode,
  CheckCircle2, Clock, ShieldCheck, X, Download, Phone, Inbox, UserCheck, Trash2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { VendorOrderDetailsDialog } from '@/components/vendor/vendor-order-details-dialog';
import { cn } from '@/lib/utils';

function QRHandshakeModal({ order, onClose }: { order: Order, onClose: () => void }) {
  const { toast } = useToast();

  const downloadQR = () => {
    const canvas = document.getElementById('handshake-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
        const imageUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = imageUrl;
        downloadLink.download = `Handshake_Order_${order.id.slice(-6)}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast({
            title: "QR Code Downloading",
            description: "The QR code image is being saved to your device.",
        });
    } else {
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: "Could not find the QR code canvas to download.",
        });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3rem] p-10 max-w-sm w-full relative animate-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-black text-foreground">Digital Handshake</h2>
          <p className="text-sm text-muted-foreground mt-2 italic">
            "Ask the buyer to scan this code to confirm delivery and release your GHS {order.amount.toFixed(2)}"
          </p>
        </div>

        {/* THE QR CODE */}
        <div className="bg-white p-6 rounded-[2.5rem] border-4 border-card shadow-inner flex justify-center">
          <QRCodeCanvas
            id="handshake-qr-canvas"
            value={`GAMHUB_CONFIRM_${order.id}`}
            size={220}
            level="H"
            includeMargin={true}
            fgColor="#000000"
            bgColor="#FFFFFF"
          />
        </div>

        <button 
          onClick={downloadQR}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          <Download size={14} /> Download QR to Send via WhatsApp
        </button>

        <div className="mt-8 pt-8 border-t border-border flex flex-col gap-2">
           <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest text-center">Security Hash</p>
           <p className="text-[10px] font-mono text-center text-muted-foreground/70 break-all">{order.id}</p>
        </div>
      </div>
    </div>
  );
}


function OrderCard({ order, onShowQR }: { order: Order, onShowQR: () => void }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  // Fetch buyer for phone number (Service leads need to call)
  const buyerRef = useMemoFirebase(() => {
    if (!firestore || !order.buyerId) return null;
    return doc(firestore, 'users', order.buyerId);
  }, [firestore, order.buyerId]);
  const { data: buyer } = useDoc<User>(buyerRef);

  const isStaff = order.buyerType === 'staff';
  const isPaid = order.status === 'paid';
  const isCompleted = order.status === 'completed' || order.status === 'archived';
  const isAwaitingConfirmation = order.status === 'awaiting_confirmation';
  const isInquiry = order.status === 'inquiry_sent';

  const handleConfirmStock = (e: React.MouseEvent, orderId: string, isAvailable: boolean) => {
    e.stopPropagation();
    if (!firestore) return;
    const orderRef = doc(firestore, 'orders', orderId);
    
    if (isAvailable) {
        updateDocumentNonBlocking(orderRef, { status: 'confirmed' });
        toast({
            title: "Stock Confirmed!",
            description: "The buyer has been notified and can now proceed with payment.",
        });
    } else {
        deleteDocumentNonBlocking(orderRef);
        toast({
            title: "Order Rejected",
            description: "You have marked the item as out of stock. The request has been removed.",
            variant: "destructive"
        });
    }
  };

  // --- SPECIAL SERVICE LEAD CARD VIEW ---
  if (isInquiry) {
    return (
      <VendorOrderDetailsDialog order={order}>
        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100 dark:border-blue-900 hover:shadow-lg transition-all cursor-pointer group">
          <div className="flex justify-between items-start mb-4">
            <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              {order.deliveryLocation.servicePreference || 'Liaison Consultation'}
            </span>
            <p className="font-black text-blue-900 dark:text-blue-200">
              {order.amount > 0 ? `GHS ${order.amount.toFixed(2)}` : 'Service Lead'}
            </p>
          </div>
          
          <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
            {order.buyerName}
          </h3>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
               <Building2 size={16} className="text-blue-500" />
               <span className="font-bold">{order.deliveryLocation.department || 'General Yard'}</span>
            </div>
            {order.deliveryLocation.roomNumber && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                 <MapPin size={16} className="text-blue-500" />
                 <span className="font-bold">Room {order.deliveryLocation.roomNumber}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <a 
              href={`tel:${buyer?.contactPhone}`} 
              className={cn(
                "flex-1 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95",
                !buyer?.contactPhone && "opacity-50 pointer-events-none"
              )}
            >
              <Phone size={14} /> {isStaff ? 'Call Professor' : 'Call Prospect'}
            </a>
          </div>
        </div>
      </VendorOrderDetailsDialog>
    );
  }

  // --- STANDARD PHYSICAL PRODUCT CARD VIEW ---
  return (
    <VendorOrderDetailsDialog order={order}>
      <div className="bg-card p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-center gap-6 flex-1 w-full">
          {/* Buyer Image/Initials */}
          <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-2xl bg-muted text-muted-foreground">
            {order.buyerName?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="w-full min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-black text-foreground truncate">{order.productName}</h3>
              {isStaff ? (
                <span className="bg-foreground text-background text-[8px] font-black px-2 py-0.5 rounded-full uppercase flex-shrink-0">Staff Order</span>
              ) : (
                <span className="bg-primary/10 text-primary text-[8px] font-black px-2 py-0.5 rounded-full uppercase flex-shrink-0">Student Order</span>
              )}
            </div>
            
            <p className="text-sm font-bold text-muted-foreground mb-3">Buyer: {order.buyerName}</p>

            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              {order.deliveryMode === 'office_delivery' ? (
                <>
                  <Building2 size={14} className="text-primary" />
                  <span>{order.deliveryLocation.department} • Room {order.deliveryLocation.roomNumber}</span>
                </>
              ) : (
                <>
                  <MapPin size={14} className="text-amber-500" />
                  <span>Safe Zone: {order.deliveryLocation.pointName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 min-w-[200px] w-full md:w-auto" onClick={(e) => e.stopPropagation()}>
          <p className="text-xl font-black text-foreground">GHS {order.amount.toFixed(2)}</p>
          
          {isAwaitingConfirmation && (
            <div className="flex gap-2 w-full">
              <Button
                onClick={(e) => handleConfirmStock(e, order.id, true)}
                className="flex-1 h-auto py-3 bg-blue-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 dark:shadow-blue-900/50"
              >
                Confirm Stock
              </Button>
              <Button
                onClick={(e) => handleConfirmStock(e, order.id, false)}
                variant="outline"
                className="h-auto py-3 px-6 rounded-2xl text-xs font-bold"
              >
                Out of Stock
              </Button>
            </div>
          )}

          {isPaid && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowQR(); }}
              className="w-full py-3 bg-primary text-primary-foreground rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <QrCode size={16} /> Show Handshake QR
            </button>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600 font-black text-xs bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl">
              <CheckCircle2 size={16} /> Completed & Paid
            </div>
          )}

          {!isPaid && !isCompleted && !isAwaitingConfirmation && (
            <div className="flex items-center gap-2 text-amber-600 font-black text-xs bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-xl">
              <Clock size={16} /> Awaiting Payment
            </div>
          )}
        </div>
      </div>
    </VendorOrderDetailsDialog>
  );
}

export default function VendorOrdersPage() {
  const { user, isUserLoading: isAuthLoading } = useAuth();
  const { firestore } = useFirebase();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'orders'),
      where('vendorId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

  const isLoading = isAuthLoading || isOrdersLoading;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <Package className="text-primary" /> Vendor Flow Manager
        </h1>
        <p className="text-muted-foreground font-medium mt-1">Manage physical deliveries or institutional service leads</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-[2.5rem]" />
            <Skeleton className="h-40 w-full rounded-[2.5rem]" />
          </>
        ) : orders?.length === 0 ? (
          <div className="bg-card p-20 rounded-[3rem] text-center border-2 border-dashed border-border">
             <Package className="mx-auto text-muted-foreground/30 mb-4" size={64} />
             <p className="text-muted-foreground font-bold">No activity found yet. Keep vibing!</p>
          </div>
        ) : (
          orders?.map((order: Order) => (
            <OrderCard
              key={order.id}
              order={order}
              onShowQR={() => setSelectedOrder(order)}
            />
          ))
        )}
      </div>

      {/* QR HANDSHAKE MODAL */}
      {selectedOrder && (
        <QRHandshakeModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
