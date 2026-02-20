'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, addDoc, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { 
  BrainCircuit, X, Sparkles, BookOpen, 
  Loader2, Wand2, Bold, Italic, Lock, Users, Bot, Share2, ShieldCheck, Landmark
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAcademicAssistance } from '@/ai/flows/ai-tutor-flow';
import { cn } from '@/lib/utils';
import type { StudyRoom as StudyRoomType } from '@/lib/types';

export default function StudyRoomInterface({ roomId, onClose }: { roomId: string, onClose: () => void }) {
  const { user: userProfile } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [roomData, setRoomData] = useState<StudyRoomType | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);

  // Sync ref with state for use in the effect closure to prevent cursor jumping
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // 1. REAL-TIME NOTEPAD SYNC (Liaison Protocol: No-Jump Logic)
  useEffect(() => {
    if (!firestore || !roomId) return;

    const roomRef = doc(firestore, 'study_rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as StudyRoomType;
        setRoomData(data);
        // CRITICAL: Prevent cursor jumps by only updating if external content is different
        if (data.content !== contentRef.current) {
          setContent(data.content || '');
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, firestore]);

  // 2. FETCH AI TUTOR RESPONSES (Persistent History)
  const aiMessagesQuery = useMemoFirebase(() => {
    if (!firestore || !roomId) return null;
    return query(
      collection(firestore, 'study_rooms', roomId, 'ai_assistance'), 
      orderBy('createdAt', 'asc')
    );
  }, [firestore, roomId]);

  const { data: aiMessages } = useCollection(aiMessagesQuery);

  // Auto-scroll AI sidebar
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isTutorOpen]);

  // 3. THE "BRAIN" FUNCTION: ASK AI
  const askAITutor = async () => {
    if (!content.trim() || content.length < 20) {
      toast({
        variant: 'destructive',
        title: "More notes needed",
        description: "Please add more detailed notes so the Professor can analyze the vibe!",
      });
      return;
    }

    setAiLoading(true);
    setIsTutorOpen(true); // Open sidebar to show thinking state

    try {
      // 1. Save thinking state to history
      const aiAssistanceRef = await addDoc(collection(firestore!, 'study_rooms', roomId, 'ai_assistance'), {
        prompt: content,
        authorName: userProfile?.name || "Student",
        createdAt: serverTimestamp(),
        status: 'thinking'
      });

      // 2. Call academic assistant flow
      const result = await getAcademicAssistance({
        notes: content,
        topic: roomData?.title
      });

      // 3. Update doc with Professor's explanation
      await updateDoc(aiAssistanceRef, {
        response: result.explanation,
        status: 'complete'
      });

    } catch (err) {
      console.error("AI Tutor Error:", err);
      toast({
        variant: 'destructive',
        title: "Tutor Busy",
        description: "The Professor is currently consulting another student. Try again in a moment.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleTextChange = (val: string) => {
    setContent(val);
    if (!firestore || !roomId) return;
    
    // Non-blocking update for live vibration
    const roomRef = doc(firestore, 'study_rooms', roomId);
    updateDocumentNonBlocking(roomRef, { 
      content: val, 
      updatedAt: new Date().toISOString() 
    });
  };

  const handleInviteLink = () => {
    const inviteLink = `${window.location.origin}/study/${roomId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join my Study Session on GAM Hub',
        text: `We are studying ${roomData?.title}. Come help us out!`,
        url: inviteLink,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Invite link copied!",
        description: "Share it in your class WhatsApp group.",
      });
    }
  };

  if (!roomData) {
    return (
      <div className="fixed inset-0 z-[6000] bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Entering Academic Cockpit...</p>
        </div>
      </div>
    );
  }

  const isPrivate = roomData.isPrivate === true;
  const isOfficial = roomData.isOfficial === true;

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in fade-in duration-300">
      
      {/* --- TOP NAVIGATION BAR --- */}
      <header className={cn(
        "h-20 border-b flex items-center justify-between px-8 shadow-sm flex-shrink-0 transition-colors",
        isOfficial ? "bg-slate-900 text-white border-slate-800" : "bg-white border-slate-100"
      )}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className={cn("p-2 rounded-full transition-all group", isOfficial ? "hover:bg-white/10" : "hover:bg-slate-100")}
          >
            <X size={20} className={cn(isOfficial ? "text-slate-400 group-hover:text-white" : "text-slate-400 group-hover:text-slate-900")} />
          </button>
          <div className={cn("h-10 w-[2px] mx-2", isOfficial ? "bg-white/10" : "bg-slate-100")} />
          <div>
            <h1 className="text-lg font-black leading-none flex items-center gap-2">
                {isPrivate && <Lock size={16} className="text-amber-500" />}
                {isOfficial && <ShieldCheck size={18} className="text-amber-500" />}
                {roomData.title}
            </h1>
            <p className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mt-1", isOfficial ? "text-blue-400" : "text-indigo-500")}>
               {isPrivate ? <Bot size={10} /> : (isOfficial ? <Landmark size={10} /> : <Users size={10} />)} 
               {isPrivate ? 'Private Research Lab' : (isOfficial ? `Official Registry Hub • ${roomData.creatorRole?.toUpperCase()}` : `${roomData.major} • Academic Hub`)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isPrivate && (
            <button 
              onClick={handleInviteLink}
              className={cn(
                "hidden sm:flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm",
                isOfficial ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Share2 size={16} /> Share to Yard
            </button>
          )}
          <button 
            onClick={() => setIsTutorOpen(!isTutorOpen)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm",
              isTutorOpen 
                ? (isOfficial ? "bg-amber-500 text-slate-900 shadow-amber-500/20" : "bg-indigo-600 text-white shadow-indigo-100") 
                : (isOfficial ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200")
            )}
          >
            <BrainCircuit size={16} /> {isTutorOpen ? 'Close Professor' : 'Consult AI Tutor'}
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA: SPLIT SCREEN --- */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT SIDE: COLLABORATIVE NOTEPAD */}
        <div className={cn(
          "flex-1 transition-all duration-500 ease-in-out bg-white p-10 flex flex-col relative",
          isTutorOpen ? "mr-[400px]" : "mr-0"
        )}>
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
            <div className="flex justify-between items-center mb-10">
               <div className="flex items-center gap-4">
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border shadow-sm",
                    isOfficial ? "bg-slate-900 text-amber-500 border-slate-800" : "bg-green-50 text-green-600 border-green-100"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isOfficial ? "bg-amber-500" : "bg-green-500")} /> 
                    {isOfficial ? "Official Hall Record" : "Liaison Sync Active"}
                  </span>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Bold size={16}/></button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><Italic size={16}/></button>
                  </div>
               </div>
               <button 
                onClick={askAITutor}
                disabled={aiLoading}
                className="flex items-center gap-2 text-indigo-600 font-black text-xs hover:underline disabled:opacity-50 transition-all"
               >
                 {aiLoading ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14} />}
                 Request AI Professor Analysis
               </button>
            </div>

            <textarea 
              value={content}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={isOfficial ? "Professor drafting official notes..." : "Draft your collective brilliance here..."}
              className="flex-1 w-full outline-none resize-none text-slate-700 leading-relaxed font-medium text-xl placeholder:text-slate-200 no-scrollbar"
              spellCheck={false}
            />
          </div>
        </div>

        {/* RIGHT SIDE: THE AI TUTOR SIDEBAR (HISTORY) */}
        <aside className={cn(
          "fixed top-20 right-0 bottom-0 w-[400px] bg-slate-900 shadow-2xl transition-transform duration-500 ease-in-out border-l border-white/10 flex flex-col z-[40]",
          isTutorOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="p-6 bg-indigo-600 text-white flex items-center gap-3 flex-shrink-0">
             <div className="p-2.5 bg-white/20 rounded-xl shadow-inner"><Sparkles size={20}/></div>
             <div>
                <h3 className="font-black text-sm tracking-tight">Liaison Professor</h3>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">Academic Strategy History</p>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-slate-900">
             {aiMessages && aiMessages.length > 0 ? (
               aiMessages.map((m: any) => (
                 <div key={m.id} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Student Context */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
                       <p className="text-[9px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Analysis Request from {m.authorName}</p>
                       <p className="text-xs text-slate-300 leading-relaxed italic font-medium">Topic: {roomData.title}</p>
                    </div>
                    {/* AI Professor Output */}
                    {m.response ? (
                      <div className="p-6 bg-white rounded-[2rem] rounded-tl-none shadow-2xl border-l-4 border-indigo-500">
                         <p className="text-slate-800 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                           {m.response}
                         </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                         <Loader2 className="animate-spin text-indigo-500 mb-2" size={24} />
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Professor is thinking...</p>
                      </div>
                    )}
                 </div>
               ))
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                   <BrainCircuit size={80} className="text-white mb-4" />
                   <p className="text-white font-black text-xs uppercase tracking-widest">Awaiting Notes</p>
                   <p className="text-slate-400 text-[10px] mt-2 font-medium">The Professor reads your notepad to provide context-aware insights.</p>
                </div>
             )}
             <div ref={scrollRef} />
          </div>

          <div className="p-6 bg-slate-950/50 border-t border-white/5 flex-shrink-0">
             <p className="text-[9px] text-slate-500 font-bold leading-relaxed italic">
               Liaison Note: Academic support is anchored in the Ghanaian curriculum.
             </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
