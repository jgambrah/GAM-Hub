'use client';

import React, { useState, useRef } from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Type, X, Send, Camera, Video, Sparkles, Youtube, Loader2, Link as LinkIcon, Play } from 'lucide-react';
import Image from 'next/image';
import type { SocialPost } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();
  
  const [postType, setPostType] = useState<'text' | 'image' | 'native' | 'link'>('text');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
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

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Vlogs must be under 20MB.' });
        return;
      }
      setVideoFile(file);
      setPreview(URL.createObjectURL(file));
      setPostType('native');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !firestore || !storage || !auth.currentUser) return;
    
    const hasMedia = imageFile || videoFile || externalUrl.trim();
    if (!content.trim() && !hasMedia) {
        toast({ variant: 'destructive', title: 'Empty Vibe', description: 'Please add some content or media to share.' });
        return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let mediaType: SocialPost['mediaType'] = 'text';

      if (postType === 'image' && imageFile) {
        mediaType = 'image';
        const fileRef = ref(storage, `social_posts/${userProfile.campusId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        imageUrl = await getDownloadURL(fileRef);
      } else if (postType === 'native' && videoFile) {
        mediaType = 'video';
        const fileRef = ref(storage, `social_videos/${userProfile.id}_${Date.now()}_${videoFile.name}`);
        await uploadBytes(fileRef, videoFile);
        mediaUrl = await getDownloadURL(fileRef);
      } else if (postType === 'link' && externalUrl) {
        mediaType = externalUrl.includes('youtube.com') || externalUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
        mediaUrl = externalUrl;
      }
      
      const hashtags = content.match(/#(\w+)/g)?.map(tag => tag.substring(1).toLowerCase()) || [];

      const postData: Partial<SocialPost> = {
        authorId: auth.currentUser.uid,
        authorName: userProfile.name || "Campus Member",
        authorAvatarUrl: userProfile.avatarUrl ?? "",
        campusId: userProfile.campusId ?? "all",
        campusAcronym: userProfile.campusAcronym ?? "GH",
        content: content || "",
        mediaType: mediaType,
        imageUrl: imageUrl,
        mediaUrl: mediaUrl,
        tags: hashtags,
        likes: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };

      await addDocumentNonBlocking(collection(firestore, 'campus_pulse'), postData);
      toast({ title: 'Vibe Shared with the Yard!' });
      onClose();
    } catch (err) { 
        console.error(err); 
        toast({ variant: 'destructive', title: 'Error', description: 'Could not publish your vibe.' });
    } finally { setLoading(false); }
  };

  const resetMedia = () => {
    setImageFile(null);
    setVideoFile(null);
    setPreview(null);
    setExternalUrl('');
    setPostType('text');
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full z-20 hover:bg-muted/80 transition-all"><X size={20}/></button>
        
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-3xl font-black text-foreground">Share Your Vibe</h2>
              <p className="text-sm font-medium text-muted-foreground italic">Broadcasting to {userProfile.campusAcronym || 'The Yard'}</p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            <textarea 
                required 
                placeholder="What's the frequency, Citizen? 😊" 
                className="w-full p-6 rounded-[2rem] bg-muted/50 border-none outline-none text-lg font-medium min-h-[120px] focus:bg-muted transition-all" 
                onChange={(e) => setContent(e.target.value)} 
            />
            
            {/* MEDIA PREVIEW AREA */}
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
                            className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-mono text-xs text-blue-600 focus:ring-2 focus:ring-primary transition-all"
                        />
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                </div>
            )}

            {/* CHANNEL SELECTOR */}
            <div className="flex gap-2">
                <button 
                    type="button" 
                    onClick={() => { resetMedia(); setPostType('text'); }} 
                    className={cn("flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2", postType === 'text' ? "bg-primary text-white border-primary shadow-lg" : "bg-muted border-transparent text-muted-foreground")}
                >
                    <Type size={20} />
                </button>
                
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className={cn("flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2", postType === 'image' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg" : "bg-muted border-transparent text-muted-foreground")}
                >
                    <ImageIcon size={20} />
                </button>

                <button 
                    type="button" 
                    onClick={() => videoInputRef.current?.click()} 
                    className={cn("flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2", postType === 'native' ? "bg-red-500 text-white border-red-500 shadow-lg" : "bg-muted border-transparent text-muted-foreground")}
                >
                    <Video size={20} />
                </button>

                <button 
                    type="button" 
                    onClick={() => { resetMedia(); setPostType('link'); }} 
                    className={cn("flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2", postType === 'link' ? "bg-blue-500 text-white border-blue-500 shadow-lg" : "bg-muted border-transparent text-muted-foreground")}
                >
                    <Youtube size={20} />
                </button>
            </div>

            {/* HIDDEN INPUTS */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />

            <button 
                disabled={loading} 
                className="w-full py-5 bg-slate-900 dark:bg-primary text-white rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Send size={20}/>}
              Share Vibe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}