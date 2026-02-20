'use client';

import { QRCodeSVG } from 'qrcode.react';
import { PackageCheck } from 'lucide-react';

export function VendorDeliveryQR({ orderId }: { orderId: string }) {
  // We encode a unique string that includes the Order ID
  const qrValue = `GAMHUB_CONFIRM_${orderId}`;

  return (
    <div className="flex flex-col items-center p-8 bg-card rounded-[2.5rem] shadow-xl border">
      <div className="bg-primary/10 p-4 rounded-2xl text-primary mb-6">
        <PackageCheck size={32} />
      </div>
      <h3 className="text-xl font-black text-foreground mb-2">Delivery Handshake</h3>
      <p className="text-sm text-muted-foreground text-center mb-8">
        Ask the student or staff to scan this code <br/> using their GAM Hub app to confirm receipt.
      </p>
      
      <div className="p-6 bg-white border-4 border-foreground rounded-3xl shadow-inner">
        <QRCodeSVG 
          value={qrValue} 
          size={200} 
          level="H" // High error correction (good for phone screens)
          bgColor="#FFFFFF" // Keep QR background white for max contrast
          fgColor="#000000"  // Keep QR code black for max contrast
        />
      </div>
      
      <p className="mt-8 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
        Order ID: {orderId.slice(-8)}
      </p>
    </div>
  );
}
