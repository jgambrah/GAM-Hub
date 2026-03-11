'use client';

import React, { useState, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { ArenaPost, Campus } from '@/lib/types';
import { Swords, Trophy, Send, Loader2, Star, Flame, Smile, Youtube, ImagePlus, X, PlusCircle } from 'lucide-react';
import { ArenaPostCard } from '@/components/arena/ArenaPostCard';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { campuses as staticCampuses } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ArenaLeaderboard from '@/components/social/ArenaLeaderboard';
import HallOfFame from '@/components/social/HallOfFame';
import { ArenaRules } from '@/components/arena/ArenaRules';
import EmojiPicker from 'emoji-picker-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { extractHashtags, updateHashtagIndex } from '@/lib/hashtag-utils';

const INITIAL_LIMIT = 100;
const LOAD_MORE_BATCH = 50;

export default function ArenaPage() {
    const { firestore, storage } = useFirebase();
    const { user, isUserLoading, isTokenReady } = useAuth();
    const { toast } = useToast();
    
    const [isLoading, setIsLoading] = useState(false);
    const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState<string | undefined>(undefined);
    const [showHallOfFame, setShowHallOfFame] = useState(false);
    
    const [showEmoji, setShowEmoji] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: allCampuses } = useCollection<Campus>(
        useMemoFirebase(() => {
            if (!firestore || !isTokenReady) return null;
            return query(collection(firestore, 'campuses'), orderBy('acronym', 'asc'));
        }, [firestore, isTokenReady])
    );

    const userCampusInfo = user ? staticCampuses.find(c => c.id === user.campusId) : undefined;
    
    const postsQuery = useMemoFirebase(() => {
        if (!firestore || !user || !isTokenReady) return null;
        return query(
            collection(firestore, 'campus_pulse'),
            where('isArenaEntry', '==', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
    }, [firestore, user?.id, isTokenReady, limitCount]);

    const { data: posts, isLoading: isLoadingPosts } = useCollection<ArenaPost>(postsQuery);

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
        if (!user || (!content.trim() && !file && !videoUrl.trim())) return;

        setIsLoading(true);
        try {
            let postData: any = {
                content,
                vibeType,
                authorId: user.id,
                authorName: user.name || "Campus Member",
                authorAvatarUrl: user.avatarUrl || "",
                authorCampus: userCampusInfo?.acronym || "GH",
                authorColor: userCampusInfo?.primaryColor || "#0f172a",
                stats: { likes: 0, burns: 0 },
                createdAt: new Date().toISOString(),
                isArenaEntry: true,
                campusId: user.campusId,
            };

            // 1. Process Media
            if (file) {
                const filePath = `arena_media/${user.id}/${Date.now()}_${file.name}`;
                const fileRef = ref(storage, filePath);
                await uploadBytes(fileRef, file);
                postData.mediaUrl = await getDownloadURL(fileRef);
                postData.mediaType = file.type.startsWith('image') ? 'image' : 'video';
            } else if (videoUrl.trim()) {
                postData.mediaUrl = videoUrl.trim();
                postData.mediaType = videoUrl.includes('youtube') ? 'youtube' : 'tiktok';
            }

            // 2. HASHTAG ENGINE
            const hashtags = extractHashtags(content);
            postData.tags = hashtags;

            // 3. Generate Semantic Embedding
            const embedding = await generatePostEmbedding({
                content: content,
                tags: hashtags
            });
            postData.embedding = embedding;

            // 4. Launch to Yard
            await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), postData);
            
            // 5. Update Global Hashtag Index
            if (hashtags.length > 0) {
                await updateHashtagIndex(firestore, hashtags);
            }

            toast({ title: 'Vibe Shared in The Arena!' });
            resetInputs();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Post Failed' });
        } finally {
            setIsLoading(false);
        }
    };

    const hasMore = posts && posts.length >= limitCount;

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
                    <button onClick={() => setShowHallOfFame(true)} className="p-4 bg-white text-amber-500 rounded-[1.5rem] shadow-xl hover:scale-110 active:scale-95 transition-all">
                        <Trophy size={24} />
                    </button>
                </div>
            </div>

            <ArenaRules />

            {user && (
                <div className="bg-card rounded-[2.5rem] p-6 mb-10 shadow-xl border border-border">
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setVibeType('celebration')} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2", vibeType === 'celebration' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground')}><Star size={14}/> Vibe</button>
                        <button onClick={() => setVibeType('shade')} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2", vibeType === 'shade' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground')}><Flame size={14}/> Shade</button>
                    </div>
                    
                    <form onSubmit={handlePost} className="space-y-4">
                        <div className="relative flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border focus-within:bg-background transition-all">
                            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-muted-foreground hover:text-amber-500 rounded-full"><Smile size={18}/></button>
                            <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ setFile(f); setPreviewUrl(URL.createObjectURL(f));}}} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-muted-foreground hover:text-blue-500 rounded-full"><ImagePlus size={18}/></button>
                            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Semantic Shade incoming... use #tags" className="flex-1 bg-transparent p-4 border-none outline-none font-medium text-sm" />
                            <Button type="submit" disabled={isLoading} className={cn("p-4 rounded-full shadow-lg h-auto", vibeType === 'shade' ? 'bg-red-600' : 'bg-green-600')}>
                                {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20} />}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6 max-w-2xl mx-auto">
                {isLoadingPosts && limitCount === INITIAL_LIMIT ? (
                    <Skeleton className="h-48 w-full rounded-3xl" />
                ) : posts?.map(post => <ArenaPostCard key={post.id} post={post} />)}

                {hasMore ? (
                    <div className="flex flex-col items-center pt-8">
                        <Button 
                            onClick={() => setLimitCount(prev => prev + LOAD_MORE_BATCH)}
                            disabled={isLoadingPosts}
                            className="bg-slate-900 text-white rounded-2xl px-10 h-14 font-black"
                        >
                            {isLoadingPosts ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                            Load More Battles
                        </Button>
                    </div>
                ) : posts && posts.length > 0 && (
                    <div className="text-center py-10 opacity-30">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">End of Arena Archive</p>
                    </div>
                )}
            </div>

            <Sheet open={showHallOfFame} onOpenChange={setShowHallOfFame}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[3.5rem] overflow-y-auto">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-black text-center italic flex items-center justify-center gap-3">
                            <Trophy className="text-amber-500" size={32} /> THE ARCHIVES
                        </SheetTitle>
                    </SheetHeader>
                    <HallOfFame />
                </SheetContent>
            </Sheet>
        </div>
    )
}
