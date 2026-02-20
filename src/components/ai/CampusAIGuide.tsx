'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, Sparkles } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

type AIMessage = {
  id: string;
  prompt: string;
  response?: string;
  createTime: any;
};

export default function CampusAIGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { firestore, user } = useFirebase();

  useEffect(() => {
    if (!user || !firestore || !isOpen) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(firestore, 'users', user.uid, 'ai_assistant'),
      orderBy('createTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIMessage));
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [isOpen, user, firestore]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !firestore) return;

    const userPrompt = input;
    setInput('');

    try {
      await addDoc(collection(firestore, 'users', user.uid, 'ai_assistant'), {
        prompt: userPrompt,
        createTime: serverTimestamp(),
      });
    } catch (err) {
      console.error("AI Assistant Error:", err);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* 1. Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border-4 border-background"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} className="animate-pulse" />}
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

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/50">
            {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-xs mt-10">Ask me about buying, linking up, or university rules!</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                {/* User Prompt */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none text-xs font-medium">
                    {m.prompt}
                  </div>
                </div>
                {/* AI Response */}
                {m.response && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-card text-card-foreground p-3 rounded-2xl rounded-tl-none text-xs shadow-sm border">
                      {m.response}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-card border-t flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="How do I get my MoMo payout?"
              className="flex-1 bg-muted rounded-xl px-4 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" className="p-3 bg-foreground text-background rounded-xl active:scale-95 transition-transform">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
