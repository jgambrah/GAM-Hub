
'use client';

import type { SpotlightItem, User, SocialPost } from '@/lib/types';
import { Star, ShoppingBag, Play, Link as LinkIcon, Megaphone, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { logTrendEvent } from '@/lib/trend-logger';
import { useFirebase } from '@/firebase';

export const FeaturedStudentCard = ({ item }: { item: SpotlightItem }) => {
    const student = item.data as User;
    if (!student) return null;
    return (
        <Card className="min-w-[320px] w-[320px] overflow-hidden rounded-[3rem] p-0 text-white shadow-2xl relative group">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900 p-8 pt-12">
                <div className="absolute top-6 left-8 bg-white/10 text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-[0.2em] border border-white/5 backdrop-blur-sm">
                    {item.campusId === 'all' ? 'Elite Networker' : 'Campus Connector'}
                </div>
                
                <div className="mt-4 flex items-center gap-4">
                    <div className="relative">
                        <Avatar className="h-16 w-16 border-4 border-white/20 shadow-xl group-hover:scale-105 transition-transform duration-500">
                            <AvatarImage src={student.avatarUrl} data-ai-hint="student portrait" className="object-cover" />
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-amber-500 p-1 rounded-full border-2 border-indigo-700">
                            <Star size={10} className="text-white fill-white" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-lg leading-tight">{student.name}</h3>
                        <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">
                            {student.campusId?.toUpperCase()} • {student.major || 'Student'}
                        </p>
                    </div>
                </div>
                <p className="text-xs mt-6 leading-relaxed line-clamp-2 italic opacity-80 font-medium">
                    "{student.bio || 'Sharing vibes and building links across the Yard.'}"
                </p>
                <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-200 bg-white/5 px-3 py-1 rounded-full uppercase">
                        {item.score || 0} Link-Ups
                    </span>
                </div>
                <Button variant="secondary" className="mt-6 w-full bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl font-black text-xs uppercase tracking-widest h-12 shadow-xl active:scale-95 transition-all">
                    <LinkIcon className="mr-2 h-4 w-4" /> Link Up Now
                </Button>
            </div>
        </Card>
    )
}

export const FeaturedVendorCard = ({ item }: { item: SpotlightItem }) => {
    const vendor = item.data as User;
    const { firestore } = useFirebase();
    if (!vendor) return null;

    const handleVendorClick = () => {
        if (firestore) {
            logTrendEvent(firestore, {
                type: 'vendor_visit',
                entityId: vendor.id,
                campusId: vendor.campusId,
                tag: vendor.vendorCategory
            });
        }
    };

    return (
        <Card className="min-w-[320px] w-[320px] overflow-hidden rounded-[3rem] p-0 text-white shadow-2xl relative group">
            <div className="bg-gradient-to-br from-orange-500 via-red-600 to-orange-700 p-8 pt-12">
                <div className="absolute top-6 left-8 bg-white/10 text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-[0.2em] border border-white/5 backdrop-blur-sm">
                    {item.campusId === 'all' ? 'National Merchant' : 'Campus Favorite'}
                </div>

                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black font-headline tracking-tight">{vendor.name}</h3>
                        <p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-1">
                            {vendor.campusId?.toUpperCase()} • {vendor.vendorCategory || 'Merchant'}
                        </p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                        <ShoppingBag size={20} className="text-orange-200" />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-6 text-[10px] font-black bg-black/20 w-fit px-3 py-1.5 rounded-xl uppercase tracking-wider">
                    <Star size={12} className="text-amber-400 fill-amber-400" /> 
                    <span>Rating: {vendor.rating?.toFixed(1) || '5.0'} ({vendor.reviewCount || 0})</span>
                </div>

                <Button onClick={handleVendorClick} variant="secondary" className="mt-8 w-full bg-white text-orange-600 hover:bg-orange-50 rounded-2xl font-black text-xs uppercase tracking-widest h-12 shadow-xl active:scale-95 transition-all">
                     <ShoppingBag className="mr-2 h-4 w-4" /> Visit Store
                </Button>
            </div>
        </Card>
    )
}

export const VlogCard = ({ item }: { item: SpotlightItem }) => {
    const vlog = item.data as SocialPost;
    if (!vlog) return null;
    return (
        <Card className="relative aspect-[9/16] rounded-[2rem] overflow-hidden group border-0 min-w-[180px] w-full h-full shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
            <Image 
                src={vlog.imageUrl || `https://picsum.photos/seed/${vlog.id}/400/700`} 
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover group-hover:scale-110 transition-transform duration-700" 
                alt="vlog thumbnail"
                data-ai-hint={vlog.imageHint || 'vlog video'}
            />
            <div className="absolute top-4 right-4 z-20">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                    <Play size={16} fill="white" className="text-white" />
                </div>
            </div>
            <div className="absolute bottom-6 left-6 right-6 z-20 text-white">
                <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.3em]">#{vlog.campusAcronym || vlog.campusId?.toUpperCase()}_PULSE</p>
                <p className="text-sm font-black leading-tight mt-2 line-clamp-2 group-hover:text-red-400 transition-colors">
                    {vlog.content.substring(0, 60)}
                </p>
            </div>
        </Card>
    )
}

export const AnnouncementCard = ({ item }: { item: SpotlightItem }) => {
    return (
        <Card 
            className="w-full overflow-hidden rounded-[3rem] text-white relative shadow-2xl h-[280px] group border-none" 
            style={{ backgroundColor: item.vibeColor || '#0f172a' }}
        >
             <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent p-8 flex flex-col justify-between z-10">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest border border-white/10 flex items-center gap-2 backdrop-blur-sm" variant="secondary">
                            <Megaphone size={12} className="text-amber-400"/> {item.category || 'National Bulletin'}
                        </Badge>
                        {item.campusId === 'all' && (
                            <Badge className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-lg border-none">GLOBAL</Badge>
                        )}
                    </div>
                    <h3 className="font-black font-headline text-3xl mt-6 leading-tight max-w-lg group-hover:translate-x-1 transition-transform duration-500">
                        {item.title}
                    </h3>
                    {item.content && <p className="text-sm mt-3 line-clamp-2 opacity-70 font-medium max-w-md leading-relaxed">{item.content}</p>}
                </div>
                <Button variant="secondary" className="mt-4 rounded-2xl font-black text-xs uppercase tracking-widest w-fit px-8 py-6 h-auto bg-white text-slate-900 shadow-xl hover:scale-105 active:scale-95 transition-all">
                    View Details
                </Button>
            </div>
            {item.image ? (
                <Image 
                    src={item.image} 
                    alt={item.title || ''} 
                    fill 
                    className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" 
                    data-ai-hint={item.imageHint || 'announcement'} 
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"/>
            )}
        </Card>
    );
}
