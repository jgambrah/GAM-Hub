'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { QrCode, CameraOff, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

interface BuyerQRScannerProps {
  expectedOrderId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BuyerQRScanner({ expectedOrderId, onSuccess, onCancel }: BuyerQRScannerProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // This timeout ensures the DOM is ready before the scanner initializes,
    // preventing the "Element not found" race condition.
    const startTimeout = setTimeout(() => {
      const onScanSuccess = async (decodedText: string) => {
        if (decodedText === `GAMHUB_CONFIRM_${expectedOrderId}`) {
          if (scannerRef.current) {
            await scannerRef.current.clear().catch(e => console.warn("Scanner cleanup on success failed."));
          }
          
          const orderRef = doc(firestore, 'orders', expectedOrderId);
          // Status transitions from 'paid' to 'picked-up' upon buyer confirmation
          updateDocumentNonBlocking(orderRef, {
            status: 'picked-up',
            receivedAt: new Date().toISOString(),
          });
          toast({
            title: "Handshake Complete!",
            description: "You've confirmed receipt of your order.",
          });
          onSuccess();
        } else {
          toast({
              variant: 'destructive',
              title: "Incorrect QR Code",
              description: "This QR code doesn't match your order. Please try again.",
          })
        }
      };

      const onScanFailure = (error: string) => {
        // Handle permission errors from the library
        if (error.includes('NotAllowedError') || error.includes('Permission denied')) {
          setHasPermission(false);
          if (scannerRef.current) {
            scannerRef.current.clear().catch(e => console.warn("Scanner cleanup on permission failure failed."));
          }
        }
      };
      
      // CHECK PERMISSIONS & INITIALIZE
      Html5Qrcode.getCameras().then(cameras => {
          if (cameras && cameras.length) {
              setHasPermission(true);
              const container = document.getElementById('reader');
              if (container) {
                container.innerHTML = "";
              }
              const scanner = new Html5QrcodeScanner(
                "reader", 
                { 
                  fps: 10, 
                  qrbox: { width: 250, height: 250 },
                  rememberLastUsedCamera: true,
                  supportedScanTypes: [0] // Force camera only
                }, 
                false
              );
              scannerRef.current = scanner;
              scanner.render(onScanSuccess, onScanFailure);
          } else {
              setHasPermission(false);
          }
      }).catch(err => {
          setHasPermission(false);
          console.error("Camera permissions error:", err);
      });
    }, 200);


    // GRACEFUL UNMOUNT
    return () => {
      clearTimeout(startTimeout);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {
          // This error is expected if the component unmounts while the scanner is active.
          // We can safely ignore it.
        });
      }
    };
  }, [expectedOrderId, onSuccess, onCancel, firestore, toast]);

  return (
    <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-xl">
            <QrCode className="text-blue-400" size={20} />
        </div>
        <div>
            <h3 className="font-bold text-sm">Release Payout</h3>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Digital Handshake</p>
        </div>
      </div>
      
      {!hasPermission ? (
        <div className="aspect-square w-full bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-4">
            <CameraOff className="w-12 h-12 text-slate-500 mb-4"/>
            <h4 className="font-bold">Camera Access Denied</h4>
            <p className="text-sm text-slate-400">Please enable camera permissions in your browser settings to scan the QR code.</p>
        </div>
      ) : (
        <div id="reader" className="overflow-hidden rounded-3xl bg-black border-4 border-slate-800"></div>
      )}
      
      <p className="text-xs text-slate-400 mt-6 text-center italic">
        Point your camera at the vendor's screen to complete the handshake.
      </p>
      
      <Button onClick={onCancel} variant="secondary" className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white">Cancel</Button>
    </div>
  );
}
