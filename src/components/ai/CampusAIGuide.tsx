
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { getCampusGuidance } from '@/ai/flows/campus-guide-flow';
import { useAuth } from '@/hooks/use-auth';
import type { UserIntelligence } from '@/lib/types';

type AIMessage = {
  id: string;
  prompt: string;
  response?: string;
  status?: 'thinking' | 'complete' | 'error';
  createTime: any;
};

export default function CampusAIGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { firestore } = useFirebase();
  const { user, firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser || !firestore || !isOpen) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(firestore, 'users', firebaseUser.uid, 'ai_assistant'),
      orderBy('createTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIMessage));
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [isOpen, firebaseUser, firestore]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !firebaseUser || !firestore) return;

    const userPrompt = input;
    setInput('');
    setIsAiThinking(true);

    try {
      // 1. Record the prompt in Firestore (Optimistic UI)
      const docRef = await addDoc(collection(firestore, 'users', firebaseUser.uid, 'ai_assistant'), {
        prompt: userPrompt,
        createTime: serverTimestamp(),
        status: 'thinking'
      });

      // 🧠 2. LIAISON BRAIN SYNC: Fetch unified interests for context
      let contextPrefix = "";
      try {
          const intelSnap = await getDoc(doc(firestore, 'user_intelligence', firebaseUser.uid));
          if (intelSnap.exists()) {
              const intel = intelSnap.data() as UserIntelligence;
              const topTags = Object.entries(intel.interests || {})
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([tag]) => tag);
              
              if (topTags.length > 0) {
                  contextPrefix = `[CITIZEN CONTEXT: The user is currently vibrating for: ${topTags.join(', ')}]\n\n`;
              }
          }
      } catch (e) {
          console.warn("Liaison AI context fetch drifted.");
      }

      // 3. Call the AI Flow with Unified Context
      const result = await getCampusGuidance({
        prompt: contextPrefix + userPrompt,
        userName: user?.name,
        campusId: user?.campusId
      });

      // 4. Update the document with the response
      const messageRef = doc(firestore, 'users', firebaseUser.uid, 'ai_assistant', docRef.id);
      updateDocumentNonBlocking(messageRef, {
        response: result.response,
        status: 'complete'
      });

    } catch (err) {
      console.error("AI Assistant Flow Error:", err);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* 1. Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border-4 border-background"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} className={isAiThinking ? "animate-bounce" : "animate-pulse"} />}
      </button>

      {/* 2. Chat Window */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[360px] h-[520px] bg-card rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-6 bg-primary text-primary-foreground flex items-center gap-3">
            <div className="p-2 bg-accent rounded-xl"><Sparkles size={20} /></div>
            <div>
              <h3 className="font-bold text-sm">Liaison AI Guide</h3>
              <p className="text-[10px] text-primary-foreground/80 font-bold uppercase tracking-widest">Campus Support Online</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/50 no-scrollbar">
            {messages.length === 0 && (
                <div className="text-center p-6 space-y-2 mt-10 opacity-60">
                    <Bot className="mx-auto h-10 w-10 text-primary" />
                    <p className="text-xs font-black uppercase tracking-widest">Akwaaba!</p>
                    <p className="text-[10px] font-medium leading-relaxed">Ask me about buying safely with Escrow, finding pickup points, or joining the Vibe War!</p>
                </div>
            )}
            
            {messages.map((m) => (
              <div key={m.id} className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                {/* User Prompt */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-primary text-primary-foreground p-4 rounded-3xl rounded-tr-none text-xs font-bold shadow-sm">
                    {m.prompt.replace(/\[CITIZEN CONTEXT: .*\]\n\n/, '')}
                  </div>
                </div>
                {/* AI Response */}
                {m.response ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-card text-card-foreground p-4 rounded-3xl rounded-tl-none text-xs font-medium shadow-md border leading-relaxed">
                      {m.response}
                    </div>
                  </div>
                ) : m.status === 'thinking' && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Guide is thinking...</span>
                        </div>
                    </div>
                )}
              </div>
            ))}
            
            {isAiThinking && messages[messages.length-1]?.status !== 'thinking' && (
                <div className="flex justify-start animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Connecting to Hub...</span>
                    </div>
                </div>
            )}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-card border-t flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. How does Escrow work?"
              className="flex-1 bg-muted rounded-xl px-4 py-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              disabled={isAiThinking}
            />
            <button 
                type="submit" 
                disabled={isAiThinking || !input.trim()}
                className="p-3 bg-slate-900 text-white dark:bg-primary rounded-xl active:scale-90 transition-all disabled:opacity-30 shadow-lg"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
