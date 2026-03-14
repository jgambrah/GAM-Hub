'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, getDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  ImageIcon, Type, X, Send, 
  Video, Sparkles, Youtube, Loader2, Link as LinkIcon, Globe, Tag, ShoppingBag, Search, Plus, CheckCircle2, Mic, Music
} from 'lucide-react';
import Image from 'next/image';
import type { SocialPost, Product, KnowledgeGraphNode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { generatePostEmbedding } from '@/ai/flows/generate-post-embedding';
import { extractHashtags, updateHashtagIndex, updateHashtagGraph } from '@/lib/hashtag-utils';
import { analyzeVibeContent } from '@/ai/flows/analyze-vibe-content';
import { updateGraphFromContent } from '@/lib/knowledge-graph';
import { validateVideo, generateFileHash } from '@/lib/video-utils';
import VoiceRecorder from './VoiceRecorder';
import { uploadAudio } from '@/lib/audio-service';

export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { isTokenReady, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [postType, setPostType] = useState<'text' | 'image' | 'native' | 'link' | 'shoutout'>('text');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  const handleAudioPrepared = (blob: Blob, duration: number) => {
    setAudioBlob(blob);
    setAudioDuration(duration);
    setPostType('shoutout');
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !isTokenReady || !userProfile || !auth?.currentUser || !firestore) return;
    
    const hasMedia = (postType === 'image' && imageFile) || (postType === 'native' && videoFile) || (postType === 'link' && externalUrl.trim()) || (postType === 'shoutout' && audioBlob);
    if (!content.trim() && !hasMedia) {
        toast({ variant: 'destructive', title: 'Empty Vibe', description: 'Please add some content to share!' });
        return;
    }

    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: SocialPost['mediaType'] = 'text';
      let videoHash: string | null = null;
      let finalDuration = 0;

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
        
        videoHash = await generateFileHash(videoFile);
        const hashRef = doc(firestore, 'video_hashes', videoHash);
        const hashSnap = await getDoc(hashRef);

        if (hashSnap.exists()) {
            const existing = hashSnap.data();
            mediaUrl = existing.mediaUrl;
            imageUrl = existing.imageUrl;
            await updateDoc(hashRef, { uploads: increment(1) });
            toast({ title: "Viral Match!", description: "Reusing existing high-quality video node." });
        } else {
            const filePath = `videos/hot/${auth.currentUser.uid}/${Date.now()}_${videoFile.name}`;
            const fileRef = ref(storage, filePath);
            await uploadBytes(fileRef, videoFile, { customMetadata: { hash: videoHash } });
            mediaUrl = await getDownloadURL(fileRef);
            
            await setDoc(hashRef, {
                mediaUrl,
                storagePath: filePath,
                storageTier: 'hot',
                processed: false,
                uploads: 1,
                updatedAt: serverTimestamp()
            });
        }
      } else if (postType === 'shoutout' && audioBlob) {
        mediaType = 'audio';
        const path = `social_shoutouts/${userProfile.campusId}/${Date.now()}_voice_shout.webm`;
        mediaUrl = await uploadAudio(storage, audioBlob, path);
        finalDuration = audioDuration;
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
        content: content || (postType === 'shoutout' ? "🎤 Voice Shoutout" : ""),
        mediaType, imageUrl, mediaUrl, videoHash,
        duration: finalDuration,
        tags: manualTags,
        likes: 0, commentCount: 0,
        type: postType === 'shoutout' ? 'shoutout' : 'regular',
        storageTier: (mediaType === 'video' || mediaType === 'audio') ? 'hot' : 'standard',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(firestore, 'campus_pulse'), postData);
      
      const runAi = async () => {
          try {
              const aiResult = await analyzeVibeContent({
                  mediaUrl: mediaUrl || '',
                  caption: content,
                  mediaType: (mediaType as any) === 'text' ? 'text' : (mediaType as any) === 'audio' ? 'text' : (mediaType as any)
              });
              const finalTags = Array.from(new Set([...manualTags, ...aiResult.aiTags])).slice(0, 15);
              const embedding = await generatePostEmbedding({ content: content || "", tags: finalTags });
              await updateDoc(doc(firestore, 'campus_pulse', docRef.id), {
                  aiTags: aiResult.aiTags, mood: aiResult.mood, embedding
              });
              const graphEntities: {id: string, type: KnowledgeGraphNode['type']}[] = [
                  { id: auth.currentUser!.uid, type: 'creator' },
                  { id: targetCampusId, type: 'location' },
                  ...finalTags.map(t => ({ id: t.toLowerCase(), type: 'tag' as const }))
              ];
              if (graphEntities.length >= 2) await updateGraphFromContent(firestore, graphEntities);
              if (finalTags.length > 0) {
                  await updateHashtagIndex(firestore, finalTags);
                  if (finalTags.length >= 2) await updateHashtagGraph(firestore, finalTags);
              }
          } catch (e) { console.warn("Background AI drifted."); }
      };
      runAi();

      toast({ title: 'Vibe Shared!' });
      onClose();
    } catch (err) { 
      console.error(err);
      toast({ variant: 'destructive', title: 'Broadcast Failed' }); 
    } finally { 
      setLoading(false); 
    }
  };

  const resetMedia = () => {
    setImageFile(null); setVideoFile(null); setAudioBlob(null); setPreview(null); setExternalUrl(''); setPostType('text');
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
              <p className="text-sm font-medium text-muted-foreground italic">Neural Indexing Active 🧠🧬</p>
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

            {postType === 'shoutout' && audioBlob && (
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Mic size={16} className="text-blue-600" />
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Voice Shoutout Prepared</span>
                        </div>
                        <button type="button" onClick={resetMedia} className="p-1 hover:bg-blue-100 rounded-lg text-blue-600"><X size={14}/></button>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-full shadow-lg border-2 border-blue-500 animate-pulse">
                            <Music size={32} className="text-blue-500" />
                        </div>
                        <span className="text-xs font-black text-blue-600">{Math.floor(audioDuration)} Seconds</span>
                    </div>
                </div>
            )}

            {postType === 'link' && (
                <div className="relative animate-in slide-in-from-top-2">
                    <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="Paste YouTube or TikTok link..." className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-mono text-xs" />
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
            )}

            <div className="flex gap-2 bg-muted/30 p-1 rounded-3xl border shadow-inner">
                {[
                    { id: 'text', icon: Type, label: 'Text' }, 
                    { id: 'image', icon: ImageIcon, label: 'Photo' },
                    { id: 'native', icon: Video, label: 'Video' }, 
                    { id: 'shoutout', icon: Mic, label: 'Shoutout' },
                    { id: 'link', icon: Youtube, label: 'Embed' }
                ].map(t => {
                    const isActive = postType === t.id;
                    const isShoutoutPlaceholder = t.id === 'shoutout' && !audioBlob;
                    const commonClasses = cn(
                        "flex-1 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 overflow-hidden",
                        isActive ? "bg-white dark:bg-slate-800 text-primary border-primary shadow-md" : "bg-transparent border-transparent text-muted-foreground"
                    );

                    // 🛡️ LIAISON FIX: Avoid nested buttons by rendering a div for the shoutout slot
                    if (isShoutoutPlaceholder) {
                        return (
                            <div key={t.id} className={cn(commonClasses, "p-0")}>
                                <div className="scale-75 origin-center">
                                    <VoiceRecorder onSend={handleAudioPrepared} disabled={loading} />
                                </div>
                            </div>
                        );
                    }

                    return (
                        <button 
                            key={t.id} 
                            type="button" 
                            onClick={() => { 
                                if (t.id === 'image') fileInputRef.current?.click();
                                else if (t.id === 'native') videoInputRef.current?.click();
                                else { resetMedia(); setPostType(t.id as any); }
                            }} 
                            className={cn(commonClasses, "p-4")}
                        >
                            <t.icon size={20} />
                            <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />

            <button disabled={loading} className="w-full py-5 bg-slate-900 dark:bg-primary text-white rounded-[2.5rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={24} /> : <><Send size={20} /> Broadcast Vibe</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
