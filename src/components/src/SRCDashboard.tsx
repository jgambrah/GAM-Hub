'use client';

import React, { useState } from 'react';
import {
  Megaphone, Tv, Radio, UserCheck, Send,
  Play, Square, Trophy, Star, Flag, Search,
  ShieldCheck, Upload, X, Loader2, FileText, CheckCircle, XCircle, Youtube, Image as ImageIcon, Type
} from 'lucide-react';
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import type { User as AppUser, SocialPost } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import LiveDirector from './LiveDirector';
import RadioManager from './RadioManager';
import CampusRadio from '@/components/social/CampusRadio';
import Image from 'next/image';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export default function SRCDashboard({ userProfile }: { userProfile: AppUser }) {
  const [activeTab, setActiveTab] = useState<'news' | 'tv' | 'radio' | 'election' | 'launcher'>('news');
  const [loading, setLoading] = useState(false);
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();

  // --- 1. BULLETIN STATE ---
  const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text');
  const [news, setNews] = useState({ title: '', content: '', url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // --- 2. ELECTION COMMAND STATE ---
  const [electionType, setElectionType] = useState<'vetted_list' | 'winner'>('vetted_list');
  const [vettedList, setVettedList] = useState({ position: '', names: '' });
  const [winner, setWinner] = useState({ name: '', position: '', photoUrl: '', message: '' });

  // --- 3. CAMPAIGN LAUNCHER STATE ---
  const [searchEmail, setSearchEmail] = useState('');
  const [foundStudent, setFoundStudent] = useState<any>(null);
  const [assignedPosition, setAssignedPosition] = useState('SRC President');

  // --- HANDLERS ---

  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !storage || !userProfile) return;
    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let mediaUrl: string | null = null;
      let finalMediaType: SocialPost['mediaType'] = 'text';

      if (postType === 'image' && file) {
        finalMediaType = 'image';
        const fileRef = ref(storage, `src_media/${userProfile.campusId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        imageUrl = await getDownloadURL(fileRef);
      } else if (postType === 'video' && news.url) {
        finalMediaType = news.url.includes('youtube') ? 'youtube' : 'tiktok';
        mediaUrl = news.url;
      }
      
      const postData = {
        title: news.title,
        content: news.content,
        mediaUrls: imageUrl ? [imageUrl] : [],
        campusId: userProfile.campusId,
        authorId: userProfile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Primary Write: src_posts (The Official Stream)
      await addDocumentNonBlocking(collection(firestore, 'src_posts'), postData);
      
      // Secondary Write: spotlight (For Home Screen visibility)
      const spotlightData = {
        ...postData,
        authorName: userProfile.name,
        isOfficial: true,
        type: 'announcement',
        sourceType: 'src',
        targetAudience: 'all',
        manualOverride: true,
        mediaType: finalMediaType,
        mediaUrl: mediaUrl,
        image: imageUrl,
      };
      await addDocumentNonBlocking(collection(firestore, 'spotlight'), spotlightData);
      
      toast({ title: "SRC Multimedia Bulletin Published!" });
      setNews({ title: '', content: '', url: '' });
      setPreview(null);
      setFile(null);

    } catch (err) { 
      console.error(err); 
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to publish news.'}) 
    } finally { 
      setLoading(false); 
    }
  };
  
  const announceVettedList = async () => {
    if (!firestore || !vettedList.position || !vettedList.names) return;
    setLoading(true);
    try {
      const postData = {
        title: `Official Vetted Candidates: ${vettedList.position}`,
        content: `The following aspirants have been cleared to campaign: ${vettedList.names}`,
        campusId: userProfile.campusId,
        authorId: userProfile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'src_posts'), postData);
      
      toast({ title: "Official list released to the Yard!" });
      setVettedList({ position: '', names: '' });
    } catch(err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    };
  };

  const announceWinner = async () => {
    if (!firestore || !winner.name || !winner.position) return;
    setLoading(true);
    try {
      const postData = {
        title: `ELECTION RESULT: New ${winner.position} Elect!`,
        content: winner.message || `Congratulations to ${winner.name} on your victory!`,
        campusId: userProfile.campusId,
        authorId: userProfile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, 'src_posts'), postData);
      
      toast({ title: "Winner crowned on GAM Hub!" });
      setWinner({ name: '', position: '', photoUrl: '', message: '' });
    } catch(err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    };
  };

  const handleFindStudent = async () => {
    if(!firestore) return;
    setLoading(true);
    const q = query(collection(firestore, 'users'), where('email', '==', searchEmail.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setFoundStudent({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } else { 
      toast({ variant: 'destructive', title: "Student not found." }); 
    }
    setLoading(false);
  };

  const handleAssignCandidate = async () => {
    if (!foundStudent || !firestore) return;
    setLoading(true);
    try {
      await updateDoc(doc(firestore, 'users', foundStudent.id), {
        candidacyStatus: 'approved',
        candidatePosition: assignedPosition,
      });
      toast({ title: "Candidate Status Granted!", description: `${foundStudent.name} is now an Official Candidate!` });
      setFoundStudent(null);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="p-4 md:p-8 bg-muted/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
              SRC Portal: {userProfile.campusId?.toUpperCase()}
            </h1>
            <p className="text-muted-foreground font-medium">Manage student leadership and communications</p>
          </div>
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl shadow-lg">
            <ShieldCheck size={32} className="text-white" />
          </div>
        </header>

        {/* --- DYNAMIC TAB NAVIGATION --- */}
        <div className="flex gap-1 md:gap-2 mb-10 bg-card p-1.5 rounded-[2rem] w-full md:w-fit shadow-lg border overflow-x-auto">
          {[
            { id: 'news', label: 'Bulletin', icon: Megaphone, color: 'from-orange-500 to-red-500' },
            { id: 'tv', label: 'Live TV', icon: Tv, color: 'from-blue-500 to-cyan-500' },
            { id: 'radio', label: 'Radio', icon: Radio, color: 'from-green-500 to-emerald-500' },
            { id: 'election', label: 'Election', icon: Trophy, color: 'from-amber-500 to-yellow-500' },
            { id: 'launcher', label: 'Launcher', icon: Flag, color: 'from-purple-500 to-pink-500' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 rounded-[1.5rem] text-[10px] font-black flex items-center gap-2 transition-all flex-shrink-0 ${activeTab === tab.id ? `bg-gradient-to-r ${tab.color} text-white shadow-md` : 'text-muted-foreground hover:text-foreground'}`}
            >
              <tab.icon size={14} /> {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* --- TAB CONTENT AREA --- */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* NEWS/BULLETIN TAB */}
          {activeTab === 'news' && (
             <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6 md:p-10 rounded-[3.5rem] shadow-xl border-2 border-orange-200 dark:border-orange-900 animate-in fade-in duration-500">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    <Megaphone className="text-orange-600" /> Broadcast Hub
                </h3>
                <div className="flex gap-4 mb-8">
                {[
                    { type: 'text', icon: Type, color: 'blue' },
                    { type: 'image', icon: ImageIcon, color: 'green' },
                    { type: 'video', icon: Youtube, color: 'red' }
                ].map((t) => (
                    <button 
                    key={t.type} 
                    onClick={() => { setPostType(t.type as any); setPreview(null); }} 
                    className={`flex-1 py-3 rounded-2xl border-2 font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                        postType === t.type 
                        ? `border-orange-500 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 text-orange-700 dark:text-orange-300 shadow-lg` 
                        : 'border-border bg-muted/50 text-muted-foreground'
                    }`}
                    >
                    <t.icon size={16}/>
                    {t.type.toUpperCase()}
                    </button>
                ))}
                </div>
                <form onSubmit={handlePostNews} className="space-y-4">
                <Input required placeholder="News Headline..." className="w-full p-4 h-auto rounded-2xl bg-white/80 dark:bg-muted/80 backdrop-blur-sm border-2 border-orange-200 dark:border-orange-900 outline-none font-bold focus:border-orange-500 transition-colors" onChange={e => setNews({...news, title: e.target.value})} value={news.title} />
                {postType === 'video' && <Input required placeholder="Paste YouTube Link..." className="w-full p-4 h-auto rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-xs font-mono outline-none border-2 border-red-300 dark:border-red-800" onChange={e => setNews({...news, url: e.target.value})} value={news.url} />}
                {postType === 'image' && (
                    <div className="aspect-video bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-[2.5rem] border-2 border-dashed border-green-300 dark:border-green-800 flex items-center justify-center overflow-hidden relative">
                    {preview ? <div className="relative w-full h-full"><Image src={preview} layout="fill" className="w-full h-full object-cover" alt="preview" /><Button type="button" onClick={() => {setFile(null); setPreview(null)}} className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-2 h-auto"><X size={16}/></Button></div>
                    : <Label className="cursor-pointer text-center p-8"><div className="p-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full w-fit mx-auto mb-4"><Upload className="text-white" size={24} /></div><span className="text-xs font-black text-green-700 dark:text-green-300 uppercase">Select Official Photo</span><Input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f) { setFile(f); setPreview(URL.createObjectURL(f)); }}} /></Label>}
                    </div>
                )}
                <Textarea required placeholder="Detailed message..." className="w-full p-4 rounded-2xl bg-white/80 dark:bg-muted/80 backdrop-blur-sm border-2 border-orange-200 dark:border-orange-900 h-32 outline-none focus:border-orange-500 transition-colors" onChange={e => setNews({...news, content: e.target.value})} value={news.content} />
                <Button disabled={loading} type="submit" className="w-full py-5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50">{loading ? <Loader2 className="animate-spin mx-auto" /> : "Share with the Yard"}</Button>
                </form>
            </div>
          )}

          {/* LIVE TV TAB */}
          {activeTab === 'tv' && <div className="animate-in fade-in"><LiveDirector userProfile={userProfile} /></div>}

          {/* RADIO TAB */}
          {activeTab === 'radio' && (
            <div className="space-y-10 animate-in fade-in duration-500">
              <RadioManager userProfile={userProfile} />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-4 px-6">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Executive Preview</p>
                </div>
                
                <CampusRadio campusId={userProfile.campusId} />
                
                <p className="mt-4 text-center text-[9px] text-slate-400 italic">
                  "If you can hear it here, every student at {userProfile.campusAcronym || userProfile.campusId.toUpperCase()} can hear it too!"
                </p>
              </div>
            </div>
          )}

          {/* ELECTION COMMAND TAB */}
          {activeTab === 'election' && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-6 md:p-10 rounded-[3.5rem] shadow-xl border-2 border-amber-200 dark:border-amber-900 animate-in fade-in duration-500">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent"><Trophy className="text-amber-500"/> Election Command</h3>
                <div className="grid grid-cols-2 gap-4 mb-8 bg-white/50 dark:bg-card/50 p-2 rounded-2xl">
                    <Button onClick={() => setElectionType('vetted_list')} variant={electionType === 'vetted_list' ? 'default' : 'ghost'} className="py-3 h-auto rounded-xl font-bold text-xs">Vetted List</Button>
                    <Button onClick={() => setElectionType('winner')} variant={electionType === 'winner' ? 'default' : 'ghost'} className="py-3 h-auto rounded-xl font-bold text-xs bg-amber-500 text-white hover:bg-amber-600 data-[variant=ghost]:bg-transparent data-[variant=ghost]:text-muted-foreground">Announce Winner</Button>
                </div>
                {electionType === 'vetted_list' ? (
                  <div className="space-y-4">
                    <Input placeholder="Position (e.g. SRC President)" className="font-bold" value={vettedList.position} onChange={e => setVettedList({...vettedList, position: e.target.value})} />
                    <Textarea placeholder="List names of cleared candidates..." className="h-32" value={vettedList.names} onChange={e => setVettedList({...vettedList, names: e.target.value})} />
                    <Button onClick={announceVettedList} disabled={loading} className="w-full"><UserCheck size={18}/> Publish Vetted List</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input placeholder="Winner Name" className="font-bold" value={winner.name} onChange={e => setWinner({...winner, name: e.target.value})} />
                    <Input placeholder="Position Won" className="font-bold" value={winner.position} onChange={e => setWinner({...winner, position: e.target.value})} />
                    <Input placeholder="Winner's Photo URL" value={winner.photoUrl} onChange={e => setWinner({...winner, photoUrl: e.target.value})} />
                    <Textarea placeholder="Victory message... (optional)" value={winner.message} onChange={e => setWinner({...winner, message: e.target.value})} />
                    <Button onClick={announceWinner} disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white"><Star fill="currentColor" size={20} /> Announce Victory</Button>
                  </div>
                )}
            </div>
          )}

          {/* CAMPAIGN LAUNCHER TAB */}
          {activeTab === 'launcher' && (
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30 p-6 md:p-10 rounded-[3.5rem] shadow-xl border-2 border-purple-200 dark:border-purple-900 animate-in fade-in duration-500">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"><Flag className="text-purple-600"/> Campaign Launcher</h3>
                <div className="relative mb-8">
                    <Input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="Enter student email..." className="font-bold pr-32" />
                    <Button onClick={handleFindStudent} disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 h-5/6">{loading ? <Loader2 className="animate-spin"/> : 'Find'}</Button>
                </div>
                {foundStudent && (
                    <div className="p-6 bg-white dark:bg-card rounded-[2rem] border animate-in zoom-in-95">
                    <h4 className="font-black text-foreground mb-4">{foundStudent.name}</h4>
                    <select className="w-full p-4 rounded-xl border bg-muted font-bold text-xs mb-4" onChange={(e) => setAssignedPosition(e.target.value)}>
                        <option>SRC President</option><option>General Secretary</option>
                    </select>
                    <Button onClick={handleAssignCandidate} disabled={loading} className="w-full"><ShieldCheck size={18} /> Grant Candidate Status</Button>
                    </div>
                )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
