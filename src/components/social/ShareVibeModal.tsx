'use client';

import React, { useState } from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Type, X, Send, Camera, Video, Sparkles, Youtube, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { SocialPost } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ShareVibeModal({ userProfile, onClose }: any) {
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'native'>('text');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !firestore || !storage || !auth.currentUser) return;
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
      } else if (postType === 'video' && url) {
        mediaType = url.includes('youtube.com') ? 'youtube' : 'tiktok';
        mediaUrl = url;
      }
      
      const hashtags = content.match(/#(\w+)/g)?.map(tag => tag.substring(1).toLowerCase()) || [];

      // UNIFIED WRITE: All social vibrations go to 'campus_pulse'
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
      toast({ title: 'Vibe Shared!' });
      onClose();
    } catch (err) { 
        console.error(err); 
        toast({ variant: 'destructive', title: 'Error', description: 'Could not publish your vibe.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full z-20"><X size={20}/></button>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-3xl font-black text-foreground">Share Your Vibe</h2>
              <p className="text-sm font-medium text-muted-foreground italic">Broadcasting to the Yard</p>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            <textarea required placeholder="What's on your mind? 😊" className="w-full p-6 rounded-[2rem] bg-muted border-none outline-none text-lg font-medium min-h-[120px]" onChange={(e) => setContent(e.target.value)} />
            
            <div className="flex gap-2">
                {[
                    { id: 'text', icon: Type }, { id: 'image', icon: ImageIcon }, { id: 'native', icon: Video }
                ].map(t => (
                    <button key={t.id} type="button" onClick={() => setPostType(t.id as any)} className={cn("flex-1 p-4 rounded-2xl border-2 transition-all", postType === t.id ? "bg-primary text-white border-primary" : "bg-muted border-transparent")}>
                        <t.icon size={20} className="mx-auto" />
                    </button>
                ))}
            </div>

            <button disabled={loading} className="w-full py-5 bg-foreground text-background rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3">
              {loading ? <Loader2 className="animate-spin" /> : <Send size={20}/>}
              Share Vibe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
