'use client';

import React, { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  ImageIcon, Type, X, Send, 
  Video, Sparkles, Youtube, Loader2, Link as LinkIcon 
} from 'lucide-react';
import Image from 'next/image';
import type { SocialPost } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * ShareVibeModal Component
 * 
 * The multimedia broadcast center for the Yard.
 * Securely handles Text, Image/Video Uploads, and YouTube/TikTok Links.
 */
export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { isTokenReady } = useAuth();
  const { toast } = useToast();
  
  // Vibe State
  const [postType, setPostType] = useState<'text' | 'image' | 'native' | 'link'>('text');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  
  // Media State
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

    console.log("📡 Broadcast Attempted:", { isTokenReady, userId: auth?.currentUser?.uid });

    if (!isTokenReady || !userProfile || !auth?.currentUser || !firestore) {
      toast({ 
        variant: 'destructive', 
        title: 'Identity Syncing', 
        description: 'Wait a moment for the Yard to verify your credentials.' 
      });
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

      // MULTIMEDIA PROCESSING
      if (postType === 'image' && imageFile) {
        mediaType = 'image';
        const fileRef = ref(storage, `social_posts/${userProfile.campusId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        imageUrl = await getDownloadURL(fileRef);
      } else if (postType === 'native' && videoFile) {
        mediaType = 'video';
        const fileRef = ref(storage, `social_videos/${auth.currentUser.uid}/${Date.now()}_${videoFile.name}`);
        await uploadBytes(fileRef, videoFile);
        mediaUrl = await getDownloadURL(fileRef);
      } else if (postType === 'link' && externalUrl) {
        mediaType = externalUrl.includes('youtube.com') || externalUrl.includes('youtu.be') ? 'youtube' : 'tiktok';
        mediaUrl = externalUrl;
      }
      
      const hashtags = (content || '').match(/#(\w+)/g)?.map(tag => tag.substring(1).toLowerCase()) || [];

      // CONSTRUCT PAYLOAD
      const postData = {
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
        type: 'regular',
        isArenaEntry: false, 
        createdAt: new Date().toISOString(),
      };

      // BROADCAST
      await addDoc(collection(firestore, 'campus_pulse'), postData);
      
      toast({ title: 'Vibe Shared!' });
      
      // Success delay to allow logic to settle
      setTimeout(() => onClose(), 100);

    } catch (err: any) { 
        console.error("🚨 BROADCAST CRASH:", err); 
        toast({ 
          variant: 'destructive', 
          title: 'Broadcast Failed', 
          description: err.message.includes('permission') 
            ? 'The Fortress blocked this post. Check verification.' 
            : 'Check your connection and try again.' 
        });
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
              <p className="text-sm font-medium text-muted-foreground italic">Broadcasting to {userProfile?.campusAcronym || 'The Yard'}</p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            <textarea 
                placeholder="What's the frequency, Citizen? 😊" 
                className="w-full p-6 rounded-[2rem] bg-muted/50 border-none outline-none text-lg font-medium min-h-[120px] focus:bg-muted transition-all text-foreground placeholder:text-muted-foreground/50" 
                value={content}
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
                            className="w-full p-4 pl-12 rounded-2xl bg-muted border-none outline-none font-mono text-xs text-blue-600 focus:ring-2 focus:ring-primary transition-all dark:bg-slate-900 shadow-inner"
                        />
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                </div>
            )}

            {/* CHANNEL SELECTOR */}
            <div className="flex gap-2 bg-muted/30 p-1 rounded-3xl border">
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
                            postType === t.id ? "bg-white dark:bg-slate-800 text-primary border-primary shadow-sm" : "bg-transparent border-transparent text-muted-foreground"
                        )}
                    >
                        <t.icon size={20} />
                    </button>
                ))}
            </div>

            {/* HIDDEN INPUTS */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />

            <button 
                type="submit"
                disabled={loading} 
                className="w-full py-5 bg-slate-900 dark:bg-primary text-white rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Send size={20}/>}
              Broadcast to Yard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
