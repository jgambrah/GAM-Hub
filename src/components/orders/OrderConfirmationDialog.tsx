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
  Landmark, Globe, UserPlus, ExternalLink, Send, Navigation, PlayCircle, X, Youtube 
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

// Dynamically load the map to prevent hydration/SSR issues with Leaflet
const PreciseLocationMap = dynamic(() => import('../logistics/PreciseLocationMap'), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full rounded-2xl" />
});

const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        const videoId = match[2];
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
    }
    return url;
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
  
  // Local state
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPoint, setSelectedPoint] = React.useState<PickupPoint | null>(null);
  const [deliveryAddress, setDeliveryAddress] = React.useState({ department: '', room: '' });
  const [servicePreference, setServicePreference] = React.useState<'consultation' | 'visit' | 'digital'>('consultation');
  const [showMap, setShowMap] = React.useState(false);
  const [pinnedCoords, setPinnedCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [showVideo, setShowVideo] = React.useState(false);

  const isStaff = user?.role === 'staff';
  const isService = product.productType === 'service';
  const [deliveryType, setDeliveryType] = React.useState<'pickup' | 'office'>(isStaff ? 'office' : 'pickup');
  
  const hasVideo = !!(product.videoUrl || product.nativeVideoUrl);
  const isYoutube = !!product.videoUrl && (product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be'));

  // Validation logic
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
    if (!firestore || !user || !product || !firebaseUser) {
        toast({
            variant: 'destructive',
            title: 'Profile not ready',
            description: 'Please wait a moment while we load your profile.'
        })
        return;
    };
    
    if (!isReadyToOrder()) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: (isService && servicePreference === 'consultation') || deliveryType === 'office' 
            ? 'Please provide your Faculty/Department and Room Number.' 
            : 'Please select a pickup point.',
      });
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
      category: product.category, // CRITICAL: For CPL Lead Calculation
      amount: product.price,
      status: isService ? 'inquiry_sent' : 'awaiting_confirmation',
      payoutStatus: 'pending',
      createdAt: new Date().toISOString(),
      deliveryMode,
      deliveryLocation,
    };

    try {
        await addDocumentNonBlocking(collection(firestore, 'orders'), orderData);
        
        toast({
          title: isService ? 'Inquiry Sent!' : 'Order Request Sent!',
          description: isService 
            ? `Your service lead for ${product.name} is now with the provider.`
            : `The vendor has been notified to confirm stock for ${product.name}.`,
        });
        
        onOpenChange(false);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not send request.' });
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
          <DialogDescription className="font-medium">
            {isService 
              ? `Let the provider know how you'd like to proceed with ${product.name}.`
              : `Select a delivery option to finalize your order for ${product.name}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
            {/* MULTIMEDIA HEADER */}
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-muted border shadow-sm group">
                {!showVideo ? (
                    <>
                        <Image src={product.imageUrl} alt={product.name} fill className="object-cover" data-ai-hint={product.imageHint} />
                        {hasVideo && (
                            <button 
                                onClick={() => setShowVideo(true)}
                                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all"
                            >
                                <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 text-white shadow-2xl">
                                    <PlayCircle size={48} fill="currentColor" className="text-white" />
                                </div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-blue-600 text-white font-black text-[10px] tracking-widest px-3 py-1">WATCH EXPLAINER</Badge>
                                </div>
                            </button>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full bg-black relative">
                        <ReactPlayer 
                            url={product.nativeVideoUrl || product.videoUrl || ''} 
                            playing 
                            controls 
                            width="100%" 
                            height="100%" 
                        />
                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                            {isYoutube && product.videoUrl && (
                                <a 
                                    href={product.videoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                                >
                                    <Youtube size={16} fill="white" />
                                </a>
                            )}
                            <button 
                                onClick={() => setShowVideo(false)}
                                className="p-2 bg-black/50 text-white rounded-full hover:bg-black"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="px-2">
                <h4 className="font-black text-lg">{product.name}</h4>
                {isService ? (
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{product.interestRate || 'Professional Service'}</p>
                ) : (
                    <p className="text-xl font-black text-primary">GHS {product.price.toFixed(2)}</p>
                )}
            </div>

            {isService ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Consultation Preference</label>
                    <div className="grid grid-cols-1 gap-2">
                        <button 
                            onClick={() => setServicePreference('consultation')}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                                servicePreference === 'consultation' ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                            )}
                        >
                            <div className={cn("p-3 rounded-xl", servicePreference === 'consultation' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                <UserPlus size={20} />
                            </div>
                            <div>
                                <p className="font-black text-sm">Liaison Consultation</p>
                                <p className="text-[10px] font-medium text-muted-foreground">The provider visits your campus location</p>
                            </div>
                        </button>

                        {servicePreference === 'consultation' && (
                            <div className="p-5 bg-blue-50/50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Office Pin Details</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="service-dept" className="text-[10px] uppercase font-black text-slate-400 px-1">Faculty/Dept</Label>
                                        <Input 
                                            id="service-dept" 
                                            placeholder="e.g. Law" 
                                            className="rounded-xl border-none font-bold"
                                            value={deliveryAddress.department} 
                                            onChange={(e) => setDeliveryAddress({...deliveryAddress, department: e.target.value})} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="service-room" className="text-[10px] uppercase font-black text-slate-400 px-1">Room/Office</Label>
                                        <Input 
                                            id="service-room" 
                                            placeholder="e.g. 402" 
                                            className="rounded-xl border-none font-bold"
                                            value={deliveryAddress.room} 
                                            onChange={(e) => setDeliveryAddress({...deliveryAddress, room: e.target.value})} 
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => setShowMap(!showMap)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-all shadow-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapPin className="text-blue-600 h-4 w-4" />
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">Precise Location (Optional)</span>
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">{showMap ? 'Hide' : 'Drop Pin'}</span>
                                    </button>

                                    {showMap && (
                                        <div className="mt-3 aspect-square w-full h-[280px] rounded-2xl overflow-hidden border shadow-inner animate-in zoom-in duration-300">
                                            <PreciseLocationMap 
                                                center={mapCenter}
                                                onPinDropped={setPinnedCoords}
                                            />
                                        </div>
                                    )}

                                    {pinnedCoords && (
                                        <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center gap-2">
                                            <div className="p-1 bg-emerald-500 rounded-lg text-white"><Navigation size={10} /></div>
                                            <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">Pin Dropped: {pinnedCoords.lat.toFixed(4)}, {pinnedCoords.lng.toFixed(4)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={() => setServicePreference('visit')}
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                                servicePreference === 'visit' ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                            )}
                        >
                            <div className={cn("p-3 rounded-xl", servicePreference === 'visit' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                <Landmark size={20} />
                            </div>
                            <div>
                                <p className="font-black text-sm">In-Person Visit</p>
                                <p className="text-[10px] font-medium text-muted-foreground">You visit the provider's physical campus branch</p>
                            </div>
                        </button>

                        {product.externalLink && (
                            <div className="pt-2">
                                <a 
                                    href={product.externalLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 text-blue-700 hover:bg-blue-100 transition-all group"
                                >
                                    <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                                        <Globe size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-sm">Digital Portal</p>
                                        <p className="text-[10px] font-medium opacity-80 uppercase tracking-tighter">Apply through direct portal</p>
                                    </div>
                                    <ExternalLink size={16} />
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                  <div className="flex gap-2 p-1.5 bg-muted rounded-2xl">
                    <button 
                      onClick={() => setDeliveryType('pickup')}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all',
                        deliveryType === 'pickup' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <MapPin size={14} /> Campus Pickup
                    </button>
                    {isStaff && (
                      <button 
                        onClick={() => setDeliveryType('office')}
                        className={cn(
                          'flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all',
                          deliveryType === 'office' ? 'bg-background shadow-md text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <Building2 size={14} /> Office Delivery
                      </button>
                    )}
                  </div>
                  
                  {deliveryType === 'office' && isStaff ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center gap-3">
                          <div className="p-2 bg-primary rounded-lg text-white"><UserCheck size={16} /></div>
                          <p className="text-[11px] font-black text-primary uppercase tracking-widest">Staff Priority Logistics</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="department" className="text-[10px] font-black uppercase text-muted-foreground px-1">Faculty/Dept</Label>
                            <Input id="department" placeholder="e.g. Law" className="rounded-xl border-none font-bold" value={deliveryAddress.department} onChange={(e) => setDeliveryAddress({...deliveryAddress, department: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="room" className="text-[10px] font-black uppercase text-muted-foreground px-1">Room Number</Label>
                            <Input id="room" placeholder="e.g. 402" className="rounded-xl border-none font-bold" value={deliveryAddress.room} onChange={(e) => setDeliveryAddress({...deliveryAddress, room: e.target.value})} />
                          </div>
                        </div>
                    </div>
                  ) : (
                     <div className="animate-in fade-in slide-in-from-bottom-2">
                        <PickupSelector 
                            campusId={product.campusId}
                            onSelect={setSelectedPoint}
                            selectedPointId={selectedPoint?.id}
                        />
                     </div>
                  )}
                </div>
            )}
        </div>

        <DialogFooter className="p-8 border-t bg-muted/20 flex-shrink-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirmOrder} 
            disabled={isLoading || !isReadyToOrder()} 
            className="rounded-[1.5rem] font-black px-10 py-6 h-auto shadow-xl active:scale-95 transition-all"
          >
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isService ? <Send className="mr-2 h-5 w-5" /> : <ShoppingCart className="mr-2 h-5 w-5" />)}
            {isService ? 'Send Inquiry' : 'Request Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
