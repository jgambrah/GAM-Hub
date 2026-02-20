'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, BookOpen, Users, Sparkles, GraduationCap, ArrowRight, BrainCircuit, Bot, Lock, ShieldCheck, Landmark, Star } from 'lucide-react';
import type { StudyRoom as StudyRoomType, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StudyRoomInterface from '@/components/study/StudyRoom';
import { cn } from '@/lib/utils';

function CreateRoomModal({ user, open, setOpen }: { user: User, open: boolean, setOpen: (open: boolean) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [title, setTitle] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const isOfficialCreator = ['staff', 'src', 'management'].includes(user.role);

    const handleCreateRoom = async () => {
        if (!firestore || !user.major || !user.campusId || !title.trim()) {
            toast({
                variant: 'destructive',
                title: 'Cannot create room',
                description: 'A title is required to launch the session.',
            });
            return;
        }
        setIsLoading(true);

        const newRoomData = {
            title: title.trim(),
            major: user.major || "General Studies",
            campusId: user.campusId,
            content: '',
            participants: [user.id],
            authorId: user.id,
            authorName: user.name || user.email || "Campus Member",
            isPrivate: false,
            isOfficial: isOfficialCreator,
            creatorRole: user.role,
            createdAt: serverTimestamp(),
            updatedAt: new Date().toISOString(),
        };

        try {
            await addDoc(collection(firestore, 'study_rooms'), newRoomData);
            toast({ 
                title: isOfficialCreator ? "Official Session Launched!" : "Study Room Launched!", 
                description: isOfficialCreator ? "Your verified lecture session is now live." : "Vibrating the academic space..." 
            });
            setOpen(false);
            setTitle('');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Liaison Error', description: 'Could not create the study room.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md rounded-[2.5rem]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={cn("p-3 rounded-2xl", isOfficialCreator ? "bg-slate-900 text-white" : "bg-primary/10 text-primary")}>
                            {isOfficialCreator ? <Landmark size={24} /> : <GraduationCap size={24} />}
                        </div>
                        <DialogTitle className="text-2xl font-black">
                            {isOfficialCreator ? 'Launch Official Session' : 'Launch Session'}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="font-medium">
                        {isOfficialCreator 
                            ? `Start a verified lecture or revision hall for ${user.major}`
                            : `Start a live collaborative session for ${user.major}`
                        }
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="room-title" className="text-[10px] font-black uppercase text-muted-foreground px-1">Session Title</Label>
                        <Input 
                            id="room-title"
                            placeholder={isOfficialCreator ? "e.g. Advanced Calculus Lecture Hall" : "e.g. Thermodynamics Group"}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isLoading}
                            className="rounded-xl border-none bg-muted font-bold"
                        />
                    </div>
                    
                    <div className={cn("p-4 rounded-2xl border flex items-start gap-3", isOfficialCreator ? "bg-slate-900 text-white border-slate-800" : "bg-primary/5 border-primary/10")}>
                        {isOfficialCreator ? <ShieldCheck className="text-amber-500 mt-1" size={16} /> : <Sparkles className="text-primary mt-1" size={16} />}
                        <p className={cn("text-[10px] leading-relaxed font-medium italic", isOfficialCreator ? "text-slate-300" : "text-primary/80")}>
                            {isOfficialCreator 
                                ? "Prestige Mode: This room will carry the Official Registry Badge and be pinned to the top of the departmental hub."
                                : `Visibility: This room will be broadcast to every other student in the ${user.major} department at ${user.campusId.toUpperCase()}.`
                            }
                        </p>
                    </div>
                </div>

                <DialogFooter className="bg-muted/30 p-6 -mx-6 -mb-6 border-t flex flex-row gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                    <Button onClick={handleCreateRoom} disabled={isLoading || !title.trim()} className={cn("rounded-xl font-black px-8 h-12 shadow-xl active:scale-95 transition-all", isOfficialCreator ? "bg-slate-900 text-white" : "bg-primary text-white")}>
                        {isLoading ? <Loader2 className="animate-spin" /> : (isOfficialCreator ? "Open Lecture Hall" : "Launch to Yard")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function StudyPage() {
    const { user, isUserLoading } = useAuth();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
    const [isLoadingLab, setIsLoadingLab] = React.useState(false);

    // 1. DYNAMIC QUERY: Fetch departmental rooms (Excluding private labs)
    // Order by isOfficial first, then by creation date
    const roomsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.major || !user?.campusId) return null;
        return query(
            collection(firestore, 'study_rooms'),
            where('campusId', '==', user.campusId),
            where('major', '==', user.major),
            where('isPrivate', '==', false),
            orderBy('isOfficial', 'desc'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user?.major, user?.campusId]);

    const { data: rooms, isLoading: isLoadingRooms } = useCollection<StudyRoomType>(roomsQuery);

    const handleLaunchPersonalLab = async () => {
        if (!firestore || !user) return;
        setIsLoadingLab(true);
        try {
            const docRef = await addDoc(collection(firestore, 'study_rooms'), {
                title: "Personal AI Research Lab",
                major: user.major || "General Studies",
                campusId: user.campusId,
                content: "",
                participants: [user.id],
                authorId: user.id,
                authorName: user.name || user.email || "Campus Member",
                isPrivate: true,
                isOfficial: false,
                createdAt: serverTimestamp(),
                updatedAt: new Date().toISOString()
            });
            setActiveRoomId(docRef.id);
            toast({ title: "Private Lab Active", description: "Your private research vault is ready." });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Liaison Error', description: 'Could not launch private lab.' });
        } finally {
            setIsLoadingLab(false);
        }
    };

    if (isUserLoading || !user) {
        return (
            <div className="max-w-6xl mx-auto p-6 space-y-10">
                <Skeleton className="h-32 w-full rounded-[2.5rem]" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                    <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="max-w-6xl mx-auto p-6 space-y-10 pb-24">
            {/* STUDY HUB HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-card p-8 rounded-[3rem] border border-slate-100 dark:border-border shadow-xl shadow-indigo-100/20 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg shadow-indigo-200">
                        <GraduationCap size={28} />
                    </div>
                    <div className="text-center md:text-left">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-foreground">Academic Hub</h2>
                        <p className="text-xs text-indigo-500 font-black uppercase tracking-widest mt-1">
                            Live for {user.major || 'Your Course'}
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none w-full md:w-auto"
                >
                    <Plus size={18} /> Start New Session
                </button>
            </div>

            {/* AI TUTOR PROMO CARD: PERSONAL LAB LAUNCHER */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                    <BrainCircuit size={150} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Bot size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Liaison Private Research</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight mb-4">Your Private AI Lab.</h2>
                    <p className="text-indigo-100 font-medium leading-relaxed mb-8">
                        Need to study alone? Launch a private lab to analyze your personal notes, summarize content, and generate custom practice questions without sharing.
                    </p>
                    <Button 
                        onClick={handleLaunchPersonalLab}
                        disabled={isLoadingLab}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl px-10 py-6 h-auto font-black text-sm shadow-xl active:scale-95 transition-all"
                    >
                        {isLoadingLab ? <Loader2 className="animate-spin mr-2" /> : <Lock className="mr-2 h-4 w-4" />}
                        Open Personal Lab
                    </Button>
                </div>
            </div>

            {/* ROOM GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isLoadingRooms ? (
                    <>
                        <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                        <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                    </>
                ) : rooms && rooms.length > 0 ? (
                    rooms.map(room => {
                        const isOfficial = room.isOfficial === true;
                        return (
                            <div key={room.id} className={cn(
                                "p-8 rounded-[3rem] border-2 transition-all hover:shadow-2xl relative overflow-hidden group",
                                isOfficial 
                                ? "border-amber-200 bg-white dark:bg-slate-900 shadow-amber-100/50 dark:shadow-amber-900/10" 
                                : "border-slate-100 dark:border-border bg-white dark:bg-card shadow-sm"
                            )}>
                                {/* 1. THE AUTHORITY BADGE */}
                                {isOfficial && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="bg-amber-500 text-white p-2 rounded-2xl shadow-lg rotate-12 flex items-center justify-center">
                                            <ShieldCheck size={16} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        {isOfficial && (
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
                                                <Star size={10} fill="currentColor" /> Official Yard Session
                                            </p>
                                        )}
                                        <h3 className={cn(
                                            "text-xl font-black transition-colors group-hover:text-primary",
                                            isOfficial ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-foreground"
                                        )}>
                                            {room.title}
                                        </h3>
                                    </div>
                                    {!isOfficial && (
                                        <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl animate-pulse">
                                            <Sparkles size={16} />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="flex -space-x-2">
                                        {[1,2,3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700" />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                                        <Users size={16} /> {room.participants?.length || 0} Joined
                                    </div>
                                    {isOfficial && (
                                        <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">
                                            <Landmark size={12} /> {room.creatorRole?.toUpperCase()} Led
                                        </div>
                                    )}
                                </div>

                                <Button 
                                    onClick={() => setActiveRoomId(room.id)}
                                    className={cn(
                                        "w-full py-6 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-2 transition-all h-auto shadow-sm",
                                        isOfficial 
                                            ? "bg-slate-900 text-white dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500 shadow-xl shadow-slate-200 dark:shadow-none" 
                                            : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white"
                                    )}
                                >
                                    <BookOpen size={18} /> {isOfficial ? "Enter Lecture Hall" : "Join Collaborative Notes"} <ArrowRight size={16} />
                                </Button>
                            </div>
                        )
                    })
                ) : (
                    <div className="md:col-span-2 p-20 text-center bg-white dark:bg-muted/20 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-border/50">
                        <BookOpen className="mx-auto h-16 w-16 text-slate-200 dark:text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-bold text-slate-400">The Hub is Quiet...</h3>
                        <p className="text-sm text-slate-400 mt-2">No active {user.major} study rooms found. Be the leader!</p>
                    </div>
                )}
            </div>

            {isCreateModalOpen && (
                <CreateRoomModal user={user} open={isCreateModalOpen} setOpen={setIsCreateModalOpen} />
            )}

            {activeRoomId && (
                <StudyRoomInterface roomId={activeRoomId} onClose={() => setActiveRoomId(null)} />
            )}
        </div>
    );
}