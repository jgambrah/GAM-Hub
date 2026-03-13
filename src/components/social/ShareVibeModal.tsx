
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  ImageIcon, Type, X, Send, 
  Video, Sparkles, Youtube, Loader2, Link as LinkIcon, Globe, Tag, ShoppingBag, Search, Plus, CheckCircle2 
} from 'lucide-react';
import Image from 'next/image';
import type { SocialPost, Product, KnowledgeGraphNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { extractHashtags, updateHashtagIndex, updateHashtagGraph } from '@/lib/hashtag-utils';
import { generateSemanticHashtags } from '@/ai/flows/generate-semantic-hashtags';
import { analyzeVibeContent } from '@/ai/flows/analyze-vibe-content';
import { searchMarketplaceProducts } from '@/lib/market-intelligence';
import { updateGraphFromContent } from '@/lib/knowledge-graph';
import { validateVideo, generateFileHash } from '@/lib/video-utils';

export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { isTokenReady, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [postType, setPostType] = useState<'text' | 'image' | 'native' | 'link'>('text');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showTagging, setShowTagging] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productSearch.trim() || !firestore || !userProfile?.campusId) {
        setSearchResults([]);
        return;
    }
    const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
            const results = await searchMarketplaceProducts(firestore, userProfile.campusId, productSearch);
            setSearchResults(results);
        } catch (e) { console.warn(e); }
        finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [productSearch, firestore, userProfile?.campusId]);

  const handleToggleTag = (product: Product) => {
    setSelectedProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) return prev.filter(p => p.id !== product.id);
        if (prev.length >= 3) {
            toast({ title: "Tag Limit Reached", description: "Max 3 items." });
            return prev;
        }
        return [...prev, product];
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreview(URL.createObjectURL(file));
      setPostType('image');
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await validateVideo(file);
        setVideoFile(file);
        setPreview(URL.createObjectURL(file));
        setPostType('native');
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Rejected', description: err.message });
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !isTokenReady || !userProfile || !auth?.currentUser || !firestore) return;
    
    const hasMedia = (postType === 'image' && imageFile) || (postType === 'native' && videoFile) || (postType === 'link' && externalUrl.trim());
    if (!content.trim() && !hasMedia) {
        toast({ variant: 'destructive', title: 'Empty Vibe', description: 'Add content!' });
        return;
    }

    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: SocialPost['mediaType'] = 'text';
      let videoHash: string | null = null;

      const targetCampusId = (isGlobal && isAdmin) ? "all" : (userProfile.campusId ?? "all");
      const targetCampusAcronym = (isGlobal && isAdmin) ? "GH" : (userProfile.campusAcronym ?? "GH");

      if (postType === 'image' && imageFile) {
        mediaType = 'image';
        const fileRef = ref(storage, `social_posts/${userProfile.campusId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        imageUrl = await getDownloadURL(fileRef);
        mediaUrl = imageUrl;
      } else if (postType === 'native' && videoFile) {
        mediaType = 'video';
        // 🧬 DEDUPLICATION
        videoHash = await generateFileHash(videoFile);
        const hashRef = doc(firestore, 'video_hashes', videoHash);
        const hashSnap = await getDoc(hashRef);

        if (hashSnap.exists()) {
            const existing = hashSnap.data();
            mediaUrl = existing.mediaUrl;
            imageUrl = existing.imageUrl;
            toast({ title: "Viral Match!", description: "Reusing existing high-quality video node." });
        } else {
            const filePath = `videos/hot/${auth.currentUser.uid}/${Date.now()}_${videoFile.name}`;
            const fileRef = ref(storage, filePath);
            await uploadBytes(fileRef, videoFile, { customMetadata: { hash: videoHash } });
            mediaUrl = await getDownloadURL(fileRef);
            await setDoc(hashRef, {
                mediaUrl, storagePath: filePath, storageTier: 'hot', processed: false, updatedAt: serverTimestamp()
            });
        }
      } else if (postType === 'link' && externalUrl) {
        mediaType = externalUrl.includes('youtube.com') || externalUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
        mediaUrl = externalUrl;
      }

      const manualTags = extractHashtags(content);
      const postData: any = {
        authorId: auth.currentUser.uid,
        authorName: userProfile.name || "Campus Member",
        authorAvatarUrl: userProfile.avatarUrl ?? "",
        campusId: targetCampusId,
        campusAcronym: targetCampusAcronym,
        content: content || "",
        mediaType, imageUrl, mediaUrl, videoHash,
        tags: manualTags,
        productTags: selectedProducts.map(p => p.id),
        likes: 0, commentCount: 0,
        type: 'regular',
        isArenaEntry: false, 
        isLiaisonSeed: isGlobal && isAdmin,
        storageTier: mediaType === 'video' ? 'hot' : 'standard',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(firestore, 'campus_pulse'), postData);
      
      const runAi = async () => {
          try {
              const aiResult = await analyzeVibeContent({
                  mediaUrl: mediaUrl || '',
                  caption: content,
                  mediaType: (mediaType as any) === 'text' ? 'text' : (mediaType as any)
              });
              const finalTags = Array.from(new Set([...manualTags, ...aiResult.aiTags])).slice(0, 15);
              const embedding = await generatePostEmbedding({ content: content || "", tags: finalTags });
              await updateDoc(doc(firestore, 'campus_pulse', docRef.id), {
                  aiTags: aiResult.aiTags, mood: aiResult.mood, embedding
              });
              const graphEntities: {id: string, type: KnowledgeGraphNode['type']}[] = [
                  { id: auth.currentUser!.uid, type: 'creator' },
                  { id: targetCampusId, type: 'location' },
                  ...finalTags.map(t => ({ id: t.toLowerCase(), type: 'tag' as const })),
                  ...selectedProducts.map(p => ({ id: p.id, type: 'product' as const }))
              ];
              if (graphEntities.length >= 2) await updateGraphFromContent(firestore, graphEntities);
              if (finalTags.length > 0) {
                  await updateHashtagIndex(firestore, finalTags);
                  if (finalTags.length >= 2) await updateHashtagGraph(firestore, finalTags);
              }
          } catch (e) { console.warn(e); }
      };
      runAi();
      toast({ title: 'Vibe Shared!' });
      onClose();
    } catch (err) { toast({ variant: 'destructive', title: 'Broadcast Failed' }); }
    finally { setLoading(false); }
  };

  const resetMedia = () => {
    setImageFile(null); setVideoFile(null); setPreview(null); setExternalUrl(''); setPostType('text');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300 border border-border">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full z-20 hover:bg-muted/80 transition-all"><X size={20}/></button>
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-3xl font-black text-foreground tracking-tight">Share Your Vibe</h2>
              <p className="text-sm font-medium text-muted-foreground italic">Deduplication Registry Active 🧬</p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            <textarea 
                placeholder="What's the frequency, Citizen? 😊" 
                className="w-full p-6 rounded-[2rem] bg-muted/50 border-none outline-none text-lg font-medium min-h-[120px] focus:bg-muted transition-all text-foreground" 
                value={content}
                onChange={(e) => setContent(e.target.value)} 
            />
            {preview && (
                <div className="relative aspect-video rounded-[2rem] overflow-hidden border-4 border-muted shadow-inner bg-black">
                    {postType === 'image' ? <Image src={preview} layout="fill" className="object-cover" alt="" /> : <video src={preview} className="w-full h-full object-cover" />}
                    <button type="button" onClick={resetMedia} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X size={16} /></button>
                </div>
            )}
            {postType === 'link' && (
                <div className="relative">
                    <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="Paste link..." className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-mono text-xs" />
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
            )}
            <div className="flex gap-2 bg-muted/30 p-1 rounded-3xl border shadow-inner">
                {[
                    { id: 'text', icon: Type }, { id: 'image', icon: ImageIcon },
                    { id: 'native', icon: Video }, { id: 'link', icon: Youtube }
                ].map(t => (
                    <button key={t.id} type="button" onClick={() => { 
                        if (t.id === 'image') fileInputRef.current?.click();
                        else if (t.id === 'native') videoInputRef.current?.click();
                        else { resetMedia(); setPostType(t.id as any); }
                    }} className={cn("flex-1 p-4 rounded-2xl border-2 transition-all", postType === t.id ? "bg-white dark:bg-slate-800 text-primary border-primary shadow-md" : "bg-transparent border-transparent text-muted-foreground")}>
                        <t.icon size={20} />
                    </button>
                ))}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />
            <button disabled={loading} className="w-full py-5 bg-slate-900 dark:bg-primary text-white rounded-[2.5rem] font-black text-lg shadow-2xl active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "Broadcast Vibe"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
