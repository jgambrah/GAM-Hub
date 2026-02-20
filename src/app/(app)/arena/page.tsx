
'use client';

import React, { useState, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import type { ArenaPost, User, Campus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Swords, Flame, Send, Loader2, Star, Smile, Youtube, ImagePlus, Video, X, Trophy } from 'lucide-react';
import { ArenaPostCard } from '@/components/arena/ArenaPostCard';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { campuses as staticCampuses } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ArenaLeaderboard from '@/components/social/ArenaLeaderboard';
import HallOfFame from '@/components/social/HallOfFame';
import { ArenaRules } from '@/components/arena/ArenaRules';
import EmojiPicker from 'emoji-picker-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export default function ArenaPage() {
    const { firestore, storage } = useFirebase();
    const { user, isUserLoading } = useAuth();
    const { toast } = useToast();
    
    // Form state
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState<string | undefined>(undefined);
    const [showHallOfFame, setShowHallOfFame] = useState(false);
    
    // Multimedia state
    const [showEmoji, setShowEmoji] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch ALL campuses for dynamic targeting
    const { data: allCampuses, isLoading: isLoadingCampuses } = useCollection<Campus>(
        useMemoFirebase(() => {
            if (!firestore) return null;
            return query(collection(firestore, 'campuses'), orderBy('acronym', 'asc'));
        }, [firestore])
    );

    const userCampusInfo = user ? staticCampuses.find(c => c.id === user.campusId) : undefined;
    
    const postsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'arena_posts'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
    }, [firestore]);

    const { data: posts, isLoading: isLoadingPosts } = useCollection<ArenaPost>(postsQuery);

    const showLoading = isUserLoading || isLoadingPosts || isLoadingCampuses;
    
    const resetInputs = () => {
        setContent('');
        setTargetCampus(undefined);
        setVibeType('celebration');
        setShowEmoji(false);
        setShowUrlInput(false);
        setVideoUrl('');
        setFile(null);
        setPreviewUrl(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user || (!content.trim() && !file && !videoUrl.trim())) {
            toast({ variant: 'destructive', title: 'Cannot post', description: 'Content is empty or you are not logged in.' });
            return;
        }

        if (vibeType === 'shade' && !targetCampus) {
            toast({ variant: 'destructive', title: 'Target Required', description: 'Please select a campus to throw shade at.' });
            return;
        }

        setIsLoading(true);

        const authorCampus = userCampusInfo?.acronym || "GH";
        const authorColor = userCampusInfo?.primaryColor || "#0f172a"; // Slate-900 for Admin
        const authorName = user.name || "National Liaison";
        const authorAvatarUrl = user.avatarUrl || `https://picsum.photos/seed/${user.id}/100/100`;

        try {
            let postData: any = {
                content,
                vibeType,
                authorId: user.id,
                authorName: authorName,
                authorAvatarUrl,
                authorCampus: authorCampus,
                authorColor: authorColor,
                stats: { likes: 0, burns: 0 },
                comebackCount: 0,
                createdAt: serverTimestamp(),
                isGlobal: targetCampus === 'ALL', // Special flag for global shades
            };
    
            if (vibeType === 'shade' && targetCampus) {
                postData.targetCampus = targetCampus;
            }

            if (file) {
                const filePath = `arena_media/${user.id}/${Date.now()}_${file.name}`;
                const fileRef = ref(storage, filePath);
                await uploadBytes(fileRef, file);
                const downloadUrl = await getDownloadURL(fileRef);
        
                postData.mediaUrl = downloadUrl;
                postData.mediaType = file.type.startsWith('image') ? 'image' : 'video';
            } else if (videoUrl.trim()) {
                postData.mediaUrl = videoUrl.trim();
                postData.mediaType = videoUrl.includes('youtube') || videoUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
            }

            await addDocumentNonBlocking(collection(firestore, 'arena_posts'), postData);
            toast({ title: 'Vibe Shared!', description: 'Your post is now live in The Arena.' });
            resetInputs();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Post Failed', description: 'Could not share your post.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 bg-muted/50 min-h-screen pb-24">
            
            <ArenaLeaderboard />
            
            <div className="bg-slate-900 rounded-[3rem] p-8 mb-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 p-6 opacity-20"><Swords size={120} /></div>
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase">The Arena</h1>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em]">National Inter-Uni Battleground</p>
                    </div>
                    <button 
                        onClick={() => setShowHallOfFame(true)}
                        className="p-4 bg-white text-amber-500 rounded-[1.5rem] shadow-xl border border-amber-100 hover:scale-110 active:scale-95 transition-all"
                    >
                        <Trophy size={24} />
                    </button>
                </div>
            </div>

            <ArenaRules />

            {user && (
                <div className="bg-card rounded-[2.5rem] p-6 mb-10 shadow-xl border border-border">
                    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                        <button onClick={() => setVibeType('celebration')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${vibeType === 'celebration' ? 'bg-green-100 text-green-700 shadow-lg' : 'bg-muted text-muted-foreground'}`}><Star size={14}/> Vibe</button>
                        <button onClick={() => setVibeType('shade')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${vibeType === 'shade' ? 'bg-red-100 text-red-700 shadow-lg' : 'bg-muted text-muted-foreground'}`}><Flame size={14}/> Shade</button>
                    </div>

                    {vibeType === 'shade' && (
                        <div className="flex items-center gap-2 mb-4 px-2 overflow-x-auto no-scrollbar">
                            <p className="text-[10px] font-black text-slate-400 uppercase mr-2 flex-shrink-0">Target Yard:</p>
                            
                            {/* THE "ALL" BUTTON */}
                            <button 
                                onClick={() => setTargetCampus('ALL')}
                                className={`flex-shrink-0 px-5 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                                targetCampus === 'ALL' 
                                ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white border-transparent shadow-lg' 
                                : 'bg-white dark:bg-card border-border text-muted-foreground'
                                }`}
                            >
                                🇬🇭 THE NATION (ALL)
                            </button>

                            {/* EXISTING CAMPUS BUTTONS */}
                            {allCampuses?.filter(c => c.acronym !== userCampusInfo?.acronym).map((uni: any) => (
                                <button 
                                key={uni.id} 
                                onClick={() => setTargetCampus(uni.acronym)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                                    targetCampus === uni.acronym ? 'bg-foreground text-background shadow-lg' : 'bg-white dark:bg-muted border border-border text-muted-foreground'
                                }`}
                                >
                                {uni.acronym}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <form onSubmit={handlePost} className="space-y-4">
                        {showUrlInput && (
                            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste YouTube or TikTok Link for evidence..." className="w-full bg-red-50 text-red-600 rounded-xl text-xs font-mono border-red-100" />
                        )}
                        {previewUrl && (
                            <div className="relative w-48 h-28 rounded-lg overflow-hidden border-2 border-border">
                                {file?.type.startsWith('image') ?
                                    <Image src={previewUrl} layout="fill" className="object-cover" alt="preview" /> :
                                    <video src={previewUrl} className="w-full h-full object-cover" />
                                }
                                <Button type="button" size="icon" variant="destructive" onClick={resetInputs} className="absolute top-1 right-1 h-6 w-6"><X size={12} /></Button>
                            </div>
                        )}
                        <div className="relative flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border focus-within:bg-background transition-all">
                            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-muted-foreground hover:text-amber-500 rounded-full transition-colors"><Smile size={18}/></button>
                            <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ setFile(f); setPreviewUrl(URL.createObjectURL(f));}}} className="hidden" accept="image/*" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-muted-foreground hover:text-blue-500 rounded-full transition-colors"><ImagePlus size={18}/></button>
                            <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="p-2.5 text-muted-foreground hover:text-red-500 rounded-full transition-colors"><Youtube size={18}/></button>
                            
                            <Input 
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={vibeType === 'shade' && targetCampus ? `Throw intellectual shade at ${targetCampus}... 🧠` : "What's the good news?"}
                                className="flex-1 bg-transparent p-4 pl-2 h-auto border-none outline-none font-medium text-sm"
                            />
                            <Button type="submit" disabled={isLoading} className={`p-4 rounded-full shadow-lg active:scale-95 transition-all h-auto ${vibeType === 'shade' ? 'bg-red-600 shadow-red-100 hover:bg-red-700' : 'bg-green-600 shadow-green-100 hover:bg-green-700'}`}>
                                {isLoading ? <Loader2 className="animate-spin" size={20}/> : (vibeType === 'shade' ? <Flame size={20} fill="currentColor" /> : <Send size={20} />)}
                            </Button>

                            {showEmoji && (
                                <div className="absolute bottom-full mb-2 left-0 z-[100]">
                                    <div className="bg-card p-2 rounded-2xl border shadow-lg">
                                        <div className="flex justify-end mb-1">
                                            <button type="button" onClick={() => setShowEmoji(false)} className="p-1 hover:bg-muted rounded-full">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                        <EmojiPicker onEmojiClick={(data) => {
                                            setContent(prev => prev + data.emoji);
                                            setShowEmoji(false);
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6 max-w-2xl mx-auto">
                {showLoading ? (
                    <>
                        <Skeleton className="h-48 w-full rounded-3xl" />
                        <Skeleton className="h-48 w-full rounded-3xl" />
                    </>
                ) : posts && posts.length > 0 ? (
                    posts.map(post => <ArenaPostCard key={post.id} post={post} />)
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                        <h2 className="text-xl font-semibold">The Arena is Quiet</h2>
                        <p className="text-muted-foreground mt-2">Be the first to start the celebration... or the shade.</p>
                    </div>
                )}
            </div>

            {/* THE TROPHY CABINET DRAWER */}
            <Sheet open={showHallOfFame} onOpenChange={setShowHallOfFame}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[3.5rem] bg-muted/50 border-t-4 border-amber-500 overflow-y-auto no-scrollbar">
                    <SheetHeader className="mb-8">
                        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6" />
                        <SheetTitle className="text-3xl font-black text-center italic flex items-center justify-center gap-3">
                            <Trophy className="text-amber-500" size={32} /> THE ARCHIVES
                        </SheetTitle>
                        <SheetDescription className="text-center font-bold text-slate-500 uppercase tracking-widest text-[10px]">
                            Historical Lineage of Weekly Kings
                        </SheetDescription>
                    </SheetHeader>
                    
                    <div className="max-w-4xl mx-auto pb-20">
                        <HallOfFame />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
