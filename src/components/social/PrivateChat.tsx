'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Smile, Reply, Forward, X, ShieldCheck, Paperclip, Loader2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { ForwardMessageModal } from './ForwardMessageModal';
import type { Message, User } from '@/lib/types';
import VoiceRecorder from './VoiceRecorder';
import { uploadAudio } from '@/lib/audio-service';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function PrivateChat({ chatId, otherUser }: { chatId: string, otherUser: User }) {
  const { firestore, auth, storage } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')) : null
  , [firestore, chatId]);
  
  const { data: messages } = useCollection<Message>(messagesQuery);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !auth.currentUser || !userProfile) return;

    const messageData: Partial<Message> = {
      text,
      senderId: auth.currentUser.uid,
      senderName: userProfile.name || auth.currentUser.displayName || "Unknown User",
      createdAt: new Date().toISOString(),
      type: 'text',
      replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text || '', senderName: replyingTo.senderName } : null,
      isForwarded: false,
    };

    addDocumentNonBlocking(collection(firestore, 'chats', chatId, 'messages'), messageData);

    updateDocumentNonBlocking(doc(firestore, 'chats', chatId), {
      lastMessage: text,
      updatedAt: new Date().toISOString()
    });

    setText('');
    setReplyingTo(null);
    setShowEmoji(false);
  };

  const handleSendAudio = async (blob: Blob) => {
    if (!firestore || !storage || !auth.currentUser || !userProfile) return;
    
    setIsUploading(true);
    try {
      // 1. Centralized Audio Upload Handshake
      const filePath = `voice_messages/${chatId}/${Date.now()}_voice.webm`;
      const audioUrl = await uploadAudio(storage, blob, filePath);

      // 2. Log Message to Firestore
      const messageData: Partial<Message> = {
        type: 'audio',
        mediaUrl: audioUrl,
        senderId: auth.currentUser.uid,
        senderName: userProfile.name || "User",
        createdAt: new Date().toISOString(),
        isForwarded: false,
      };

      addDocumentNonBlocking(collection(firestore, 'chats', chatId, 'messages'), messageData);
      
      updateDocumentNonBlocking(doc(firestore, 'chats', chatId), {
        lastMessage: "🎤 Voice Message",
        updatedAt: new Date().toISOString()
      });

    } catch (err) {
      console.error("Liaison Voice Upload Error:", err);
      toast({ variant: 'destructive', title: "Voice Note Failed", description: "Could not send audio vibration." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
        {/* CHAT HEADER */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
              <img src={otherUser.avatarUrl} alt="avatar" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{otherUser.name}</h3>
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                {otherUser.campusAcronym || 'GH'} • Online
              </p>
            </div>
          </div>
          <ShieldCheck className="text-blue-500 opacity-50" size={20} />
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 no-scrollbar">
          {messages?.map((msg: Message) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] group relative p-4 text-sm font-medium leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-3xl rounded-tr-none' : 'bg-white text-slate-800 rounded-3xl rounded-tl-none shadow-sm'}`}>
                  
                  {msg.isForwarded && (
                    <div className="flex items-center gap-1 text-xs opacity-70 mb-2">
                      <Forward size={14} />
                      <span className="font-bold">Forwarded</span>
                    </div>
                  )}
                  
                  {msg.replyTo && (
                    <div className="mb-2 p-2 bg-black/10 rounded-xl border-l-4 border-white/50 text-[10px]">
                      <p className="font-black opacity-70">{msg.replyTo.senderName}</p>
                      <p className="truncate">{msg.replyTo.text}</p>
                    </div>
                  )}

                  {msg.type === 'audio' ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <audio src={msg.mediaUrl} controls className={cn("h-8 w-full", isMe ? "invert brightness-200" : "")} />
                      </div>
                    </div>
                  ) : (
                    <p>{msg.text}</p>
                  )}

                  <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
                     <button onClick={() => setReplyingTo(msg)} className="p-2 bg-white shadow-sm rounded-full text-slate-400 hover:text-blue-600"><Reply size={14}/></button>
                     <button onClick={() => setForwardingMessage(msg)} className="p-2 bg-white shadow-sm rounded-full text-slate-400 hover:text-green-600"><Forward size={14}/></button>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white border-t border-slate-50 relative flex-shrink-0">
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-blue-600" />
              <span className="text-xs font-black uppercase text-blue-600">Sending Voice Vibe...</span>
            </div>
          )}

          {showEmoji && (
            <div className="absolute bottom-full mb-4 left-4 z-50 shadow-2xl">
                <div className="flex justify-end p-2 bg-background rounded-t-2xl border-b border-border">
                    <button onClick={() => setShowEmoji(false)} className="p-1 hover:bg-muted rounded-full">
                        <X size={16} className="text-muted-foreground" />
                    </button>
                </div>
              <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
            </div>
          )}

          {replyingTo && (
            <div className="mb-3 p-3 bg-blue-50 rounded-2xl flex justify-between items-center animate-in slide-in-from-bottom-2">
              <div className="border-l-4 border-blue-600 pl-3">
                 <p className="text-[10px] font-black text-blue-600 uppercase">Replying to {replyingTo.senderName}</p>
                 <p className="text-xs text-slate-500 truncate">{replyingTo.text}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 bg-blue-100 text-blue-600 rounded-full"><X size={14}/></button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors">
                <Smile size={22} />
              </button>
              <VoiceRecorder onSend={handleSendAudio} />
            </div>

            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
              <input 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message the Yard..."
                className="flex-1 bg-slate-50 p-4 rounded-[2rem] border-none outline-none text-sm font-medium"
              />
              <button type="submit" disabled={!text.trim()} className="p-4 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-100 active:scale-90 transition-transform disabled:opacity-30">
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          isOpen={!!forwardingMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}
    </>
  );
}
