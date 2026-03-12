
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { addDocumentNonBlocking, useFirestore } from '@/firebase';
import { 
  Loader2, ShoppingCart, Building2, MapPin, UserCheck, 
  Landmark, Globe, UserPlus, ExternalLink, Send, Navigation, PlayCircle, X, Youtube, AlertTriangle 
} from 'lucide-react';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { Product, PickupPoint } from '@/lib/types';
import { PickupSelector } from '../orders/PickupSelector';
import Image from 'next/image';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { Skeleton } from '../ui/skeleton';
import ReactPlayer from 'react-player';
import YouTube from 'react-youtube';
import { recordMarketSignal } from '@/lib/market-intelligence';

const PreciseLocationMap = dynamic(() => import('../logistics/PreciseLocationMap'), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />
});

const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

interface OrderConfirmationDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderConfirmationDialog({ product, open, onOpenChange }: OrderConfirmationDialogProps) {
  const { user, firebaseUser, campus } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPoint, setSelectedPoint] = React.useState<PickupPoint | null>(null);
  const [deliveryAddress, setDeliveryAddress] = React.useState({ department: '', room: '' });
  const [servicePreference, setServicePreference] = React.useState<'consultation' | 'visit' | 'digital'>('consultation');
  const [showMap, setShowMap] = React.useState(false);
  const [pinnedCoords, setPinnedCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [showVideo, setShowVideo] = React.useState(false);
  const [isRestricted, setIsRestricted] = React.useState(false);

  const isStaff = user?.role === 'staff';
  const isService = product.productType === 'service';
  const [deliveryType, setDeliveryType] = React.useState<'pickup' | 'office'>(isStaff ? 'office' : 'pickup');
  
  const hasVideo = !!(product.videoUrl || product.nativeVideoUrl);
  const youtubeId = React.useMemo(() => getYouTubeId(product.videoUrl || ''), [product.videoUrl]);

  const isReadyToOrder = () => {
    if (isService) {
        if (servicePreference === 'consultation') {
            return deliveryAddress.department && deliveryAddress.room;
        }
        return true;
    }
    if (deliveryType === 'office') {
      return deliveryAddress.department && deliveryAddress.room;
    }
    return !!selectedPoint;
  }

  const handleConfirmOrder = async () => {
    if (!firestore || !user || !product || !firebaseUser) return;
    
    if (!isReadyToOrder()) {
      toast({ variant: 'destructive', title: 'Missing Information' });
      return;
    }

    setIsLoading(true);

    let deliveryMode: 'pickup_point' | 'office_delivery' | 'service_inquiry';
    let deliveryLocation: any = {};

    if (isService) {
      deliveryMode = 'service_inquiry';
      deliveryLocation = {
        servicePreference: servicePreference,
        ...(servicePreference === 'consultation' ? {
            department: deliveryAddress.department,
            roomNumber: deliveryAddress.room,
            ...(pinnedCoords ? {
                latitude: pinnedCoords.lat,
                longitude: pinnedCoords.lng,
            } : {})
        } : {})
      };
    } else if (deliveryType === 'office') {
      deliveryMode = 'office_delivery';
      deliveryLocation = {
        department: deliveryAddress.department,
        roomNumber: deliveryAddress.room,
      };
    } else {
      deliveryMode = 'pickup_point';
      deliveryLocation = {
        pointId: selectedPoint!.id,
        pointName: selectedPoint!.name,
      };
    }

    const orderData = {
      productId: product.id,
      productName: product.name,
      buyerId: firebaseUser.uid,
      buyerName: user.name || firebaseUser.email || "Campus Member",
      buyerType: user.role as 'student' | 'staff',
      vendorId: product.vendorId,
      vendorName: product.vendorName || "Verified Vendor",
      campusId: product.campusId,
      category: product.category,
      amount: product.price,
      status: isService ? 'inquiry_sent' : 'awaiting_confirmation',
      payoutStatus: 'pending',
      createdAt: new Date().toISOString(),
      deliveryMode,
      deliveryLocation,
    };

    try {
        // 1. Log order to database
        await addDocumentNonBlocking(collection(firestore, 'orders'), orderData);
        
        // 2. 🛒 MARKET INTELLIGENCE: Record "High Intent" signal
        recordMarketSignal(firestore, user.id, product, 'intent');

        toast({ title: isService ? 'Inquiry Sent!' : 'Order Request Sent!' });
        onOpenChange(false);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Submission Failed' });
    } finally {
        setIsLoading(false);
    }
  }
  
  const mapCenter = React.useMemo(() => {
    return { lat: campus?.latitude || 5.6506, lng: campus?.longitude || -0.1870 };
  }, [campus]);

  React.useEffect(() => {
    if (open) {
      setDeliveryType(isStaff ? 'office' : 'pickup');
      setServicePreference('consultation');
      setShowMap(false);
      setPinnedCoords(null);
      setShowVideo(false);
      setIsRestricted(false);
    } else {
      setSelectedPoint(null);
      setDeliveryAddress({ department: '', room: '' });
    }
  }, [open, isStaff]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="font-black text-2xl">{isService ? 'Service Inquiry' : 'Confirm Your Order'}</DialogTitle>
          <DialogDescription className="font-medium text-xs">
            Refining logistics for {product.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-muted border shadow-sm group">
                {!showVideo ? (
                    <>
                        <Image src={product.imageUrl} alt={product.name} fill className="object-cover" data-ai-hint={product.imageHint} />
                        {hasVideo && (
                            <button 
                                onClick={() => setShowVideo(true)}
                                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all"
                            >
                                <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl group-hover:scale-110 transition-transform">
                                    <PlayCircle size={48} fill="currentColor" />
                                </div>
                            </button>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full bg-black relative">
                        {youtubeId ? (
                            isRestricted ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                    <AlertTriangle className="text-amber-500 mb-2" />
                                    <p className="text-slate-400 text-[8px] mb-4">Content owner restricted embedding. Tap to watch on YouTube.</p>
                                    <a 
                                        href={product.videoUrl || '#'} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                        <Youtube size={12} fill="white" /> Open External
                                    </a>
                                </div>
                            ) : (
                                <YouTube 
                                    videoId={youtubeId}
                                    opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }}
                                    className="w-full h-full"
                                    onError={(e) => { if (e.data === 101 || e.data === 150) setIsRestricted(true); }}
                                />
                            )
                        ) : (
                            <ReactPlayer url={product.nativeVideoUrl || ''} playing controls width="100%" height="100%" />
                        )}
                        <button onClick={() => setShowVideo(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black"><X size={16} /></button>
                    </div>
                )}
            </div>

            {isService ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Consultation Preference</label>
                    <div className="grid grid-cols-1 gap-2">
                        <button onClick={() => setServicePreference('consultation')} className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all", servicePreference === 'consultation' ? "border-primary bg-primary/5 shadow-sm" : "border-border")}>
                            <div className={cn("p-3 rounded-xl", servicePreference === 'consultation' ? "bg-primary text-white" : "bg-muted")}><UserPlus size={20} /></div>
                            <div><p className="font-black text-sm">Liaison Consultation</p><p className="text-[10px] font-medium text-muted-foreground text-xs leading-tight">Provider visits your campus office</p></div>
                        </button>

                        {servicePreference === 'consultation' && (
                            <div className="p-5 bg-blue-50/50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800 space-y-4 animate-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="service-dept" className="text-[10px] uppercase font-black text-slate-400 px-1">Faculty/Dept</Label>
                                        <Input id="service-dept" placeholder="e.g. Law" className="rounded-xl border-none font-bold text-sm" value={deliveryAddress.department} onChange={(e) => setDeliveryAddress({...deliveryAddress, department: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="service-room" className="text-[10px] uppercase font-black text-slate-400 px-1">Room/Office</Label>
                                        <Input id="service-room" placeholder="e.g. 402" className="rounded-xl border-none font-bold text-sm" value={deliveryAddress.room} onChange={(e) => setDeliveryAddress({...deliveryAddress, room: e.target.value})} />
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={() => setShowMap(!showMap)} className="w-full rounded-xl text-xs font-black">{showMap ? 'Hide Map' : 'Select Precise Location'}</Button>
                                {showMap && <div className="mt-3 h-[250px] rounded-2xl overflow-hidden border"><PreciseLocationMap center={mapCenter} onPinDropped={setPinnedCoords} /></div>}
                            </div>
                        )}

                        <button onClick={() => setServicePreference('visit')} className={cn("flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all", servicePreference === 'visit' ? "border-primary bg-primary/5 shadow-sm" : "border-border")}>
                            <div className={cn("p-3 rounded-xl", servicePreference === 'visit' ? "bg-primary text-white" : "bg-muted")}><Landmark size={20} /></div>
                            <div><p className="font-black text-sm">In-Person Visit</p><p className="text-[10px] font-medium text-muted-foreground text-xs leading-tight">You visit the provider branch</p></div>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                  <div className="flex gap-2 p-1.5 bg-muted rounded-2xl">
                    <button onClick={() => setDeliveryType('pickup')} className={cn('flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2', deliveryType === 'pickup' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground')}><MapPin size={14} /> Campus Pickup</button>
                    {isStaff && <button onClick={() => setDeliveryType('office')} className={cn('flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2', deliveryType === 'office' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground')}><Building2 size={14} /> Office Delivery</button>}
                  </div>
                  
                  {deliveryType === 'office' && isStaff ? (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Faculty/Dept</Label>
                            <Input placeholder="e.g. Law" className="rounded-xl border-none font-bold" value={deliveryAddress.department} onChange={(e) => setDeliveryAddress({...deliveryAddress, department: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground px-1">Room</Label>
                            <Input placeholder="e.g. 402" className="rounded-xl border-none font-bold" value={deliveryAddress.room} onChange={(e) => setDeliveryAddress({...deliveryAddress, room: e.target.value})} />
                        </div>
                    </div>
                  ) : (
                     <div className="animate-in fade-in"><PickupSelector campusId={product.campusId} onSelect={setSelectedPoint} selectedPointId={selectedPoint?.id} /></div>
                  )}
                </div>
            )}
        </div>

        <DialogFooter className="p-8 border-t bg-muted/20 flex-shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
          <Button onClick={handleConfirmOrder} disabled={isLoading || !isReadyToOrder()} className="rounded-[1.5rem] font-black px-10 py-6 h-auto shadow-xl transition-all">
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            {isService ? 'Send Inquiry' : 'Request Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
