
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
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

/**
 * ShareVibeModal Component
 * 
 * The multimedia broadcast center for the Yard.
 * Upgraded with Creator-Commerce Engine and Knowledge Graph Seeding.
 */
export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { isTokenReady, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [postType, setPostType] = useState<'text' | 'image' | 'native' | 'link'>('text');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  
  // Media State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Commerce State
  const [showTagging, setShowTagging] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 🛍️ COMMERCE ENGINE: Product Lookup
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
        } catch (e) {
            console.warn("Product search failed:", e);
        } finally {
            setIsSearching(false);
        }
    }, 400);

    return () => clearTimeout(timer);
  }, [productSearch, firestore, userProfile?.campusId]);

  const handleToggleTag = (product: Product) => {
    setSelectedProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) return prev.filter(p => p.id !== product.id);
        if (prev.length >= 3) {
            toast({ title: "Tag Limit Reached", description: "You can only link 3 products to a single vibe." });
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

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Campus vlogs must be under 20MB.' });
        return;
      }
      setVideoFile(file);
      setPreview(URL.createObjectURL(file));
      setPostType('native');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!isTokenReady || !userProfile || !auth?.currentUser || !firestore) {
      toast({ variant: 'destructive', title: 'Identity Syncing', description: 'Wait a moment for the Yard to verify your credentials.' });
      return;
    }
    
    const rawTags = (content.match(/#\w+/g) || []);
    if (rawTags.length > 10) {
        toast({ variant: 'destructive', title: 'Policy Violation', description: 'Maximum 10 hashtags per vibration allowed.' });
        return;
    }

    const hasMedia = (postType === 'image' && imageFile) || 
                     (postType === 'native' && videoFile) || 
                     (postType === 'link' && externalUrl.trim());
                     
    if (!content.trim() && !hasMedia) {
        toast({ variant: 'destructive', title: 'Empty Vibe', description: 'Add content to broadcast!' });
        return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: SocialPost['mediaType'] = 'text';

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
        const fileRef = ref(storage, `social_videos/${auth.currentUser.uid}/${Date.now()}_${videoFile.name}`);
        await uploadBytes(fileRef, videoFile);
        mediaUrl = await getDownloadURL(fileRef);
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
        mediaType: mediaType,
        imageUrl: imageUrl,
        mediaUrl: mediaUrl,
        tags: manualTags,
        productTags: selectedProducts.map(p => p.id),
        likes: 0,
        commentCount: 0,
        type: 'regular',
        isArenaEntry: false, 
        isLiaisonSeed: isGlobal && isAdmin,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(firestore, 'campus_pulse'), postData);
      
      // 🚀 KNOWLEDGE GRAPH & AI PIPELINE
      const runAiAnalysis = async () => {
          try {
              const aiResult = await analyzeVibeContent({
                  mediaUrl: mediaUrl || '',
                  caption: content,
                  mediaType: (mediaType as any) === 'text' ? 'text' : (mediaType as any)
              });

              const finalTags = Array.from(new Set([...manualTags, ...aiResult.aiTags])).slice(0, 15);
              const embedding = await generatePostEmbedding({ content: content || "", tags: finalTags });

              await updateDoc(doc(firestore, 'campus_pulse', docRef.id), {
                  aiTags: aiResult.aiTags,
                  aiTopics: aiResult.aiTopics,
                  mood: aiResult.mood,
                  musicGenre: aiResult.musicGenre,
                  detectedObjects: aiResult.detectedObjects,
                  transcript: aiResult.transcript,
                  embedding: embedding
              });

              // 🕸️ AUTOMATIC GRAPH SEEDING
              const graphEntities: {id: string, type: KnowledgeGraphNode['type']}[] = [
                  { id: auth.currentUser!.uid, type: 'creator' },
                  { id: targetCampusId, type: 'location' },
                  ...finalTags.map(t => ({ id: t.toLowerCase(), type: 'tag' as const })),
                  ...selectedProducts.map(p => ({ id: p.id, type: 'product' as const }))
              ];
              
              if (graphEntities.length >= 2) {
                  await updateGraphFromContent(firestore, graphEntities);
              }

              if (finalTags.length > 0) {
                  await updateHashtagIndex(firestore, finalTags);
                  if (finalTags.length >= 2) await updateHashtagGraph(firestore, finalTags);
              }
          } catch (e) {
              console.error("Liaison AI Pipeline Error:", e);
          }
      };

      runAiAnalysis();
      
      toast({ title: isGlobal ? 'Global Vibe Broadcasted!' : 'Vibe Shared!' });
      onClose();

    } catch (err: any) { 
        console.error("🚨 BROADCAST CRASH:", err); 
        toast({ variant: 'destructive', title: 'Broadcast Failed' });
    } finally { 
        setLoading(false); 
    }
  };

  const resetMedia = () => {
    setImageFile(null);
    setVideoFile(null);
    setPreview(null);
    setExternalUrl('');
    setPostType('text');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300 border border-border">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full z-20 hover:bg-muted/80 transition-all"><X size={20}/></button>
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-3xl font-black text-foreground tracking-tight">Share Your Vibe</h2>
              <p className="text-sm font-medium text-muted-foreground italic">
                {isGlobal && isAdmin ? 'Broadcasting to National Hub' : `Broadcasting to ${userProfile?.campusAcronym || 'The Yard'}`}
              </p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            
            {isAdmin && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-[2rem] border-2 border-amber-200 dark:border-amber-800 flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-lg shadow-amber-100/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-md animate-pulse">
                    <Globe size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">Global Hub Seeding</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1.5 leading-tight">AI understanding across ALL campuses.</p>
                  </div>
                </div>
                <Switch checked={isGlobal} onCheckedChange={setIsGlobal} className="data-[state=checked]:bg-amber-500" />
              </div>
            )}

            <div className="space-y-2">
                <textarea 
                    placeholder="What's the frequency, Citizen? 😊 Liaison AI will automatically expand your tags." 
                    className="w-full p-6 rounded-[2rem] bg-muted/50 border-none outline-none text-lg font-medium min-h-[120px] focus:bg-muted transition-all text-foreground placeholder:text-muted-foreground/50" 
                    value={content}
                    onChange={(e) => setContent(e.target.value)} 
                />
            </div>
            
            {preview && (
                <div className="relative aspect-video rounded-[2rem] overflow-hidden border-4 border-muted shadow-inner bg-black group">
                    {postType === 'image' ? (
                        <Image src={preview} layout="fill" className="object-cover" alt="Preview" />
                    ) : (
                        <video src={preview} className="w-full h-full object-cover" />
                    )}
                    <button type="button" onClick={resetMedia} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-all">
                        <X size={16} />
                    </button>
                </div>
            )}

            {postType === 'link' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-2">YouTube / TikTok URL</label>
                    <div className="relative">
                        <input 
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder="Paste link here..."
                            className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-mono text-xs text-blue-600 focus:ring-2 focus:ring-primary transition-all dark:bg-slate-900 shadow-inner"
                        />
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <button 
                    type="button"
                    onClick={() => setShowTagging(!showTagging)}
                    className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 shadow-sm",
                        selectedProducts.length > 0 ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-100 dark:border-slate-800 hover:border-amber-400 hover:text-amber-600"
                    )}
                >
                    <ShoppingBag size={14} className={selectedProducts.length > 0 ? "text-amber-600" : ""} /> 
                    {selectedProducts.length > 0 ? `Commerce: ${selectedProducts.length} Items Tagged` : 'Tag Products from Market'}
                </button>

                {showTagging && (
                    <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-5 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {isSearching ? <Loader2 className="animate-spin text-amber-500" size={16} /> : <Search className="text-slate-400" size={16} />}
                            </div>
                            <input 
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Search campus store..."
                                className="w-full bg-white dark:bg-slate-900 p-4 pl-12 rounded-2xl outline-none font-black text-xs border border-transparent focus:border-amber-400 transition-all shadow-sm"
                            />
                        </div>

                        {searchResults.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto no-scrollbar py-1">
                                {searchResults.map(p => {
                                    const isSelected = selectedProducts.find(item => item.id === p.id);
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleToggleTag(p)}
                                            className={cn(
                                                "p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all",
                                                isSelected ? "bg-amber-50 border-amber-400 shadow-md" : "bg-white dark:bg-card border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-inner">
                                                    <Image src={p.imageUrl} fill className="object-cover" alt="" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">{p.name}</p>
                                                    <p className="text-[10px] font-bold text-amber-600">GHS {p.price.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className={cn("p-2 rounded-full transition-all", isSelected ? "bg-amber-500 text-white shadow-lg rotate-0" : "bg-slate-100 text-slate-300")}>
                                                {isSelected ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {selectedProducts.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                {selectedProducts.map(p => (
                                    <div key={p.id} className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg animate-in zoom-in">
                                        <span className="truncate max-w-[100px] uppercase tracking-tighter">{p.name}</span>
                                        <button type="button" onClick={() => handleToggleTag(p)} className="p-0.5 hover:bg-red-500 rounded-md transition-colors"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!productSearch && searchResults.length === 0 && (
                            <div className="text-center py-4 opacity-40">
                                <p className="text-[10px] font-bold uppercase tracking-widest">Type to find campus deals</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-2 bg-muted/30 p-1 rounded-3xl border shadow-inner">
                {[
                    { id: 'text', icon: Type, label: 'Text' },
                    { id: 'image', icon: ImageIcon, label: 'Image' },
                    { id: 'native', icon: Video, label: 'Video' },
                    { id: 'link', icon: Youtube, label: 'Link' }
                ].map(t => (
                    <button 
                        key={t.id} 
                        type="button" 
                        onClick={() => { 
                            if (t.id === 'image') fileInputRef.current?.click();
                            else if (t.id === 'native') videoInputRef.current?.click();
                            else { resetMedia(); setPostType(t.id as any); }
                        }} 
                        className={cn(
                            "flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2", 
                            postType === t.id ? "bg-white dark:bg-slate-800 text-primary border-primary shadow-md scale-105" : "bg-transparent border-transparent text-muted-foreground hover:bg-white/10"
                        )}
                    >
                        <t.icon size={20} />
                    </button>
                ))}
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />

            <button 
                type="submit"
                disabled={loading} 
                className={cn(
                  "w-full py-5 text-white rounded-[2.5rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50",
                  isGlobal && isAdmin ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-slate-900 dark:bg-primary"
                )}
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={20}/>}
              {isGlobal ? 'Analyze & Seed to National Hub' : 'Analyze & Broadcast Vibe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
