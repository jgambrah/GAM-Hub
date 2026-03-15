
'use client';

import React, { useState, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import type { ArenaPost, Campus } from '@/lib/types';
import { Swords, Trophy, Send, Loader2, Star, Flame, Smile, Youtube, ImagePlus, X, PlusCircle, Target, Zap } from 'lucide-react';
import { ArenaPostCard } from '@/components/arena/ArenaPostCard';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { campuses as staticCampuses } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ArenaLeaderboard from '@/components/social/ArenaLeaderboard';
import HallOfFame from '@/components/social/HallOfFame';
import { ArenaRules } from '@/components/arena/ArenaRules';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { extractHashtags, updateHashtagIndex, updateHashtagGraph } from '@/lib/hashtag-utils';
import { generateSemanticHashtags } from '@/ai/flows/generate-semantic-hashtags';
import { validateVideo, generateFileHash } from '@/lib/video-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INITIAL_LIMIT = 100;
const LOAD_MORE_BATCH = 50;

export default function ArenaPage() {
    const { firestore, storage } = useFirebase();
    const { user, isTokenReady } = useAuth();
    const { toast } = useToast();
    
    const [isLoading, setIsLoading] = useState(false);
    const [limitCount, setLimitCount] = useState(INITIAL_LIMIT);
    const [content, setContent] = useState('');
    const [vibeType, setVibeType] = useState<'shade' | 'celebration'>('celebration');
    const [targetCampus, setTargetCampus] = useState('all');
    const [showHallOfFame, setShowHallOfFame] = useState(false);
    
    const [showEmoji, setShowEmoji] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setVibeType('celebration');
        setTargetCampus('all');
        setShowEmoji(false);
        setVideoUrl('');
        setFile(null);
        setPreviewUrl(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || (!content.trim() && !file && !videoUrl.trim())) return;

        setIsLoading(true);
        try {
            let postData: any = {
                content,
                vibeType,
                targetCampus: targetCampus !== 'all' ? staticCampuses.find(c => c.id === targetCampus)?.acronym : 'National',
                authorId: user.id,
                authorName: user.name || "Campus Member",
                authorAvatarUrl: user.avatarUrl || "",
                authorCampus: userCampusInfo?.acronym || "GH",
                authorColor: userCampusInfo?.primaryColor || "#0f172a",
                stats: { likes: 0, burns: 0 },
                createdAt: new Date().toISOString(),
                isArenaEntry: true,
                campusId: user.campusId,
                storageTier: 'hot'
            };

            // 1. Process Multimedia with Deduplication Registry 🧬
            if (file) {
                const isVideo = file.type.startsWith('video');
                if (isVideo) {
                    await validateVideo(file);
                    const hash = await generateFileHash(file);
                    const hashRef = doc(firestore, 'video_hashes', hash);
                    const hashSnap = await getDoc(hashRef);

                    if (hashSnap.exists()) {
                        const existing = hashSnap.data();
                        postData.mediaUrl = existing.mediaUrl;
                        postData.mediaType = 'video';
                        postData.imageUrl = existing.imageUrl;
                        postData.storageTier = existing.storageTier || 'hot';
                        postData.videoHash = hash;
                        await setDoc(hashRef, { uploads: increment(1) }, { merge: true });
                        toast({ title: "Viral Vibe Detected!", description: "Reusing existing high-quality version from the Yard." });
                    } else {
                        const filePath = `videos/hot/${user.id}/${Date.now()}_${file.name}`;
                        const fileRef = ref(storage, filePath);
                        await uploadBytes(fileRef, file, { customMetadata: { hash } });
                        postData.mediaUrl = await getDownloadURL(fileRef);
                        postData.mediaType = 'video';
                        postData.videoHash = hash;
                        await setDoc(hashRef, {
                            mediaUrl: postData.mediaUrl,
                            storagePath: filePath,
                            storageTier: 'hot',
                            processed: false,
                            uploads: 1,
                            updatedAt: serverTimestamp()
                        });
                    }
                } else {
                    const filePath = `arena_media/${user.id}/${Date.now()}_${file.name}`;
                    const fileRef = ref(storage, filePath);
                    await uploadBytes(fileRef, file);
                    postData.mediaUrl = await getDownloadURL(fileRef);
                    postData.mediaType = 'image';
                }
            } else if (videoUrl.trim()) {
                postData.mediaUrl = videoUrl.trim();
                postData.mediaType = videoUrl.includes('youtube') ? 'youtube' : 'tiktok';
            }

            // 2. AI SEMANTIC UPGRADE 🧠
            const manualTags = extractHashtags(content);
            let aiTags: string[] = [];
            try {
                const aiResult = await generateSemanticHashtags({ content, campusAcronym: userCampusInfo?.acronym });
                aiTags = aiResult.tags;
            } catch (e) { console.warn("AI Tagging drifted."); }

            const finalHashtags = Array.from(new Set([...manualTags, ...aiTags])).slice(0, 10);
            postData.tags = finalHashtags;

            const embedding = await generatePostEmbedding({ content, tags: finalHashtags });
            postData.embedding = embedding;

            // 3. Launch to Yard
            await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), postData);
            
            if (finalHashtags.length > 0) {
                await updateHashtagIndex(firestore, finalHashtags);
                if (finalHashtags.length >= 2) await updateHashtagGraph(firestore, finalHashtags);
            }

            toast({ title: 'Vibe Shared in The Arena!' });
            resetInputs();
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Action Blocked', description: error.message });
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
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                        <div className="flex gap-2">
                            <button onClick={() => setVibeType('celebration')} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all", vibeType === 'celebration' ? 'bg-amber-100 text-amber-700 shadow-sm ring-2 ring-amber-500/20' : 'bg-muted text-muted-foreground')}><Star size={14} fill={vibeType === 'celebration' ? 'currentColor' : 'none'}/> Victory</button>
                            <button onClick={() => setVibeType('shade')} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all", vibeType === 'shade' ? 'bg-red-100 text-red-700 shadow-sm ring-2 ring-red-500/20' : 'bg-muted text-muted-foreground')}><Flame size={14} fill={vibeType === 'shade' ? 'currentColor' : 'none'}/> Shade</button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Target:</span>
                            <Select onValueChange={setTargetCampus} value={targetCampus}>
                                <SelectTrigger className="w-[180px] rounded-xl font-bold border-none bg-muted h-10">
                                    <Target size={14} className="text-primary" />
                                    <SelectValue placeholder="All Rivals" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    <SelectItem value="all">🌍 All Rivals</SelectItem>
                                    {staticCampuses.filter(c => c.id !== user.campusId).map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.acronym} Hub</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <form onSubmit={handlePost} className="space-y-4">
                        <div className="relative flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-muted-foreground hover:text-amber-500 rounded-full"><Smile size={18}/></button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-muted-foreground hover:text-blue-500 rounded-full"><ImagePlus size={18}/></button>
                            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder={vibeType === 'shade' ? "Dropping a national heat-seek... 🧨" : "Celebrating Yard success! 🏆"} className="flex-1 bg-transparent p-4 border-none outline-none font-medium text-sm" />
                            <Button type="submit" disabled={isLoading} className={cn("p-4 rounded-full shadow-lg h-auto transition-all", vibeType === 'shade' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600')}>
                                {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20} fill="currentColor" />}
                            </Button>
                        </div>
                        <div className="flex justify-between items-center px-6">
                            <p className="text-[9px] text-muted-foreground italic">Liaison AI targeting & deduplication active. 🛡️✨</p>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Yard Sync Live</span>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-8 max-w-2xl mx-auto">
                {isLoadingPosts && limitCount === INITIAL_LIMIT ? (
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                    </div>
                ) : posts?.map(post => <ArenaPostCard key={post.id} post={post} />)}

                {hasMore && (
                    <div className="flex flex-col items-center pt-12 pb-20">
                        <Button 
                            onClick={() => setLimitCount(prev => prev + LOAD_MORE_BATCH)}
                            disabled={isLoadingPosts}
                            className="bg-slate-900 text-white rounded-2xl px-12 h-16 font-black shadow-xl hover:scale-105 transition-all"
                        >
                            {isLoadingPosts ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                            Load More Battles
                        </Button>
                    </div>
                )}
            </div>

            <Sheet open={showHallOfFame} onOpenChange={setShowHallOfFame}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[3.5rem] overflow-y-auto border-t-8 border-amber-500">
                    <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-black text-center italic flex items-center justify-center gap-3">
                            <Trophy className="text-amber-500" size={32} /> THE NATIONAL ARCHIVES
                        </SheetTitle>
                    </SheetHeader>
                    <HallOfFame />
                </SheetContent>
            </Sheet>
        </div>
    )
}
