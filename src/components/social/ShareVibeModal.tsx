'use client';

import React, { useState } from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Type, X, Send, Camera, Video, Sparkles, Youtube, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { SocialPost } from '@/lib/types';

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
      let originalVideoPath: string | undefined = undefined;
      let mediaStatus: SocialPost['mediaStatus'] | undefined = undefined;

      // 1. Determine media type and upload if necessary
      if (postType === 'image' && imageFile) {
        mediaType = 'image';
        const fileRef = ref(storage, `social_posts/${userProfile.campusId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        imageUrl = await getDownloadURL(fileRef);
      } else if (postType === 'native' && videoFile) {
        mediaType = 'video';
        const filePath = `social_videos/original/${userProfile.id}_${Date.now()}_${videoFile.name}`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, videoFile);
        originalVideoPath = filePath;
        mediaStatus = 'processing';
      } else if (postType === 'video' && url) {
        mediaType = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'tiktok';
        mediaUrl = url;
      }
      
      const hashtags = content.match(/#(\w+)/g)?.map(tag => tag.substring(1).toLowerCase()) || [];

      // 2. Save to social_posts
      const postData: Partial<SocialPost> = {
        authorId: auth.currentUser.uid,
        authorName: userProfile.name || "Campus Member",
        authorAvatarUrl: userProfile.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name || userProfile.id}`,
        campusId: userProfile.campusId ?? "all",
        campusAcronym: userProfile.campusAcronym ?? "GH",
        content: content || "",
        mediaType: mediaType,
        imageUrl: imageUrl,
        mediaUrl: mediaUrl,
        tags: hashtags,
        likes: 0,
        commentCount: 0,
        isProtected: false,
        isLiaisonBoosted: false,
        createdAt: new Date().toISOString(),
      };

      if (originalVideoPath) {
        postData.originalVideoPath = originalVideoPath;
      }
      if (mediaStatus) {
        postData.mediaStatus = mediaStatus;
      }


      await addDocumentNonBlocking(collection(firestore, 'social_posts'), postData);

      toast({ title: 'Vibe Shared!', description: 'Your post is now live.'});
      onClose();
    } catch (err) { 
        console.error(err); 
        toast({ variant: 'destructive', title: 'Error', description: 'Could not publish your vibe.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-card rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
        <div className="h-2 w-full bg-gradient-to-r from-pink-500 via-purple-500 via-blue-500 to-yellow-500" />
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-muted rounded-full hover:bg-destructive/10 transition-colors z-20"><X size={20}/></button>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><Sparkles size={24}/></div>
            <div>
              <h2 className="text-3xl font-black text-foreground">Share Your Vibe</h2>
              <p className="text-sm font-medium text-muted-foreground italic">Broadcasting to {userProfile?.campusAcronym}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-8 bg-muted p-2 rounded-[2rem]">
            {[
              { id: 'text', icon: Type, color: 'text-blue-500' },
              { id: 'image', icon: ImageIcon, color: 'text-emerald-500' },
              { id: 'native', icon: Video, color: 'text-orange-500' },
              { id: 'video', icon: Youtube, color: 'text-red-500' },
            ].map((t) => (
              <button key={t.id} type="button" onClick={() => { setPostType(t.id as any); setPreview(null); }} className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all ${postType === t.id ? 'bg-background shadow-md' : 'opacity-50'}`}>
                <t.icon size={20} className={t.color} />
              </button>
            ))}
          </div>

          <form onSubmit={handlePublish} className="space-y-6">
            <textarea required placeholder="What's on your mind? 😊" className="w-full p-6 rounded-[2rem] bg-muted border-none outline-none text-lg font-medium min-h-[120px]" onChange={(e) => setContent(e.target.value)} />
            
            {postType === 'video' && <input placeholder="Paste YouTube or TikTok link" className="w-full p-5 rounded-2xl bg-red-50 text-red-600 text-xs font-mono outline-none dark:bg-red-900/20 dark:text-red-300" onChange={(e) => setUrl(e.target.value)} />}
            
            {(postType === 'image' || postType === 'native') && (
              <div className="relative aspect-video rounded-[2rem] bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {preview ? <Image src={preview} layout="fill" className="w-full h-full object-cover" alt="media preview" /> : (
                  <label className="cursor-pointer flex flex-col items-center gap-3">
                    <Camera size={32} className="text-muted-foreground/50" />
                    <input type="file" className="hidden" accept={postType === 'image' ? "image/*" : "video/*"} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if(f) { if(postType === 'image') setImageFile(f); else setVideoFile(f); setPreview(URL.createObjectURL(f)); }
                    }} />
                  </label>
                )}
              </div>
            )}

            <button disabled={loading} className="w-full py-5 bg-foreground text-background rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin" /> : <><Send size={20}/> Share Vibe</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
