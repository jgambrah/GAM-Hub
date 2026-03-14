
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, limitToLast } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Smile, Reply, Forward, X, ShieldCheck, Paperclip, Loader2, ShoppingBag } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { ForwardMessageModal } from './ForwardMessageModal';
import type { Message, User } from '@/lib/types';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import { uploadAudio } from '@/lib/audio-service';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * PrivateChat Component
 * --------------------
 * High-performance real-time messaging interface.
 * Implements the sub-collection pattern for messages and non-blocking metadata updates.
 * COST OPTIMIZED: Uses limitToLast(50) to prevent excessive read operations.
 */
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

  // 1. REAL-TIME MESSAGE STREAM: Sub-collection listener (The Heartbeat)
  // COST OPTIMIZATION: limitToLast(50) ensures we only load the newest vibrations
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
        collection(firestore, 'chats', chatId, 'messages'), 
        orderBy('createdAt', 'asc'),
        limitToLast(50)
    ) : null
  , [firestore, chatId]);
  
  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  // Auto-scroll to bottom on new vibrations
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !auth.currentUser || !userProfile) return;

    const messageData: Partial<Message> = {
      text: text.trim(),
      senderId: auth.currentUser.uid,
      senderName: userProfile.name || "Unknown User",
      createdAt: new Date().toISOString(),
      type: 'text',
      replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text || '', senderName: replyingTo.senderName } : null,
      isForwarded: false,
    };

    // A. Add to sub-collection (Non-blocking - Firestore handles local cache instant update)
    addDocumentNonBlocking(collection(firestore, 'chats', chatId, 'messages'), messageData);

    // B. Update parent chat metadata for sidebar sorting (Non-blocking)
    // Optimization: Renderers use this field instead of querying the sub-collection for previews.
    updateDocumentNonBlocking(doc(firestore, 'chats', chatId), {
      lastMessage: text.trim(),
      updatedAt: new Date().toISOString()
    });

    setText('');
    setReplyingTo(null);
    setShowEmoji(false);
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!firestore || !storage || !auth.currentUser || !userProfile) return;
    
    setIsUploading(true);
    try {
      const filePath = `voice_messages/${chatId}/${Date.now()}_voice.webm`;
      const audioUrl = await uploadAudio(storage, blob, filePath);

      const messageData: Partial<Message> = {
        type: 'audio',
        mediaUrl: audioUrl,
        duration: duration,
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
      toast({ variant: 'destructive', title: "Voice Note Failed" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
        {/* CHAT HEADER */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800">
              <img src={otherUser.avatarUrl} alt="avatar" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{otherUser.name}</h3>
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                {otherUser.campusAcronym || 'GH'} • Yard Signal Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <ShieldCheck className="text-blue-500 opacity-50" size={20} />
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 no-scrollbar">
          {isLoading ? (
              <div className="flex flex-col gap-4">
                  <Skeleton className="h-16 w-3/4 rounded-3xl" />
                  <Skeleton className="h-16 w-1/2 ml-auto rounded-3xl" />
                  <Skeleton className="h-16 w-2/3 rounded-3xl" />
              </div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg: Message) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={cn(
                        "max-w-[85%] group relative p-4 transition-all",
                        isMe ? 'bg-blue-600 text-white rounded-3xl rounded-tr-none' : 'bg-white text-slate-800 rounded-3xl rounded-tl-none shadow-sm border border-slate-100'
                    )}>
                    
                    {msg.isForwarded && (
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase opacity-70 mb-2">
                        <Forward size={12} />
                        <span>Forwarded</span>
                        </div>
                    )}
                    
                    {msg.replyTo && (
                        <div className="mb-3 p-2.5 bg-black/5 rounded-xl border-l-4 border-current/30 text-[10px]">
                        <p className="font-black opacity-70 mb-0.5">{msg.replyTo.senderName}</p>
                        <p className="truncate opacity-90">{msg.replyTo.text}</p>
                        </div>
                    )}

                    {msg.type === 'audio' ? (
                        <div className="min-w-[220px] max-w-full">
                        <VoicePlayer 
                            url={msg.mediaUrl || ''} 
                            duration={msg.duration} 
                            theme={isMe ? 'primary' : 'dark'} 
                        />
                        </div>
                    ) : msg.type === 'image' ? (
                        <div className="space-y-2">
                            <div className="relative aspect-square w-full min-w-[200px] rounded-xl overflow-hidden border border-black/5 shadow-inner">
                                <Image src={msg.mediaUrl || ''} fill className="object-cover" alt="Shared image" />
                            </div>
                            {msg.text && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                        </div>
                    ) : msg.type === 'product' && msg.productInfo ? (
                        <Link href={`/products/${msg.productInfo.id}`} className="block p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 shadow-sm hover:scale-[1.02] transition-transform">
                            <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                                    <Image src={msg.productInfo.imageUrl} fill className="object-cover" alt="" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-xs text-foreground truncate">{msg.productInfo.name}</p>
                                    <p className="text-[10px] font-black text-amber-600">GHS {msg.productInfo.price.toFixed(2)}</p>
                                </div>
                                <ShoppingBag size={14} className="ml-auto text-muted-foreground" />
                            </div>
                        </Link>
                    ) : (
                        <p className="font-medium text-sm leading-relaxed">{msg.text}</p>
                    )}

                    {/* Context Actions */}
                    <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10`}>
                        <button onClick={() => setReplyingTo(msg)} className="p-2 bg-white shadow-md rounded-full text-slate-400 hover:text-blue-600 active:scale-90 transition-all"><Reply size={14}/></button>
                        <button onClick={() => setForwardingMessage(msg)} className="p-2 bg-white shadow-md rounded-full text-slate-400 hover:text-green-600 active:scale-90 transition-all"><Forward size={14}/></button>
                    </div>
                    </div>
                </div>
                );
            })
          ) : !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                <ShieldCheck size={64} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Vibe Fortress Encrypted</p>
                <p className="text-[10px] mt-2 italic font-medium">Start the vibration by sending a message.</p>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white border-t border-slate-50 relative flex-shrink-0">
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-blue-600" />
              <span className="text-[10px] font-black uppercase text-blue-600">Syncing Voice Vibration...</span>
            </div>
          )}

          {showEmoji && (
            <div className="absolute bottom-full mb-4 left-4 z-50 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex justify-end p-2 bg-background rounded-t-2xl border-b border-border">
                    <button onClick={() => setShowEmoji(false)} className="p-1 hover:bg-muted rounded-full">
                        <X size={16} className="text-muted-foreground" />
                    </button>
                </div>
              <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
            </div>
          )}

          {replyingTo && (
            <div className="mb-3 p-3 bg-blue-50 rounded-2xl flex justify-between items-center animate-in slide-in-from-bottom-2 border border-blue-100">
              <div className="border-l-4 border-blue-600 pl-3 min-w-0">
                 <p className="text-[10px] font-black text-blue-600 uppercase">Replying to {replyingTo.senderName}</p>
                 <p className="text-xs text-slate-500 truncate">{replyingTo.text}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"><X size={14}/></button>
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
                placeholder="Broadcast your vibe..."
                className="flex-1 bg-slate-50 p-4 rounded-[2rem] border-none outline-none text-sm font-medium focus:bg-slate-100 transition-all shadow-inner"
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
