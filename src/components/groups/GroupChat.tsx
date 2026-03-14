
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, limitToLast, setDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Send, Smile, Reply, Forward, X, ShieldCheck, Paperclip, Loader2, ImagePlus, ShoppingBag } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import type { Message, User, Group } from '@/lib/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { ForwardMessageModal } from '../social/ForwardMessageModal';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { validateVideo } from '@/lib/video-utils';
import { uploadAudio } from '@/lib/audio-service';
import VoiceRecorder from '../social/VoiceRecorder';
import VoicePlayer from '../social/VoicePlayer';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * GroupChat Component
 * ------------------
 * Real-time community messaging hub.
 * Now expanded with Multi-User Typing Indicators and Group Read Receipts.
 */
export default function GroupChat({ group }: { group: Group }) {
  const { firestore, storage, auth } = useFirebase();
  const { user: userProfile } = useAuth();
  const { toast } = useToast();
  
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. REAL-TIME GROUP FEED
  const messagesQuery = useMemoFirebase(() => 
    firestore ? query(
        collection(firestore, 'groups', group.id, 'messages'), 
        orderBy('createdAt', 'asc'),
        limitToLast(50)
    ) : null
  , [firestore, group.id]);
  
  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  // 2. TYPING INDICATOR LISTENER
  const typingQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'groups', group.id, 'typing')) : null
  , [firestore, group.id]);
  const { data: typingDocs } = useCollection<any>(typingQuery);
  const typingUsers = typingDocs?.filter(d => d.id !== auth.currentUser?.uid) || [];

  // 3. READ RECEIPTS HANDSHAKE
  useEffect(() => {
    if (!messages || !auth.currentUser || !firestore) return;
    const myId = auth.currentUser.uid;
    
    messages.forEach(msg => {
      if (!msg.readBy?.includes(myId)) {
        const msgRef = doc(firestore, 'groups', group.id, 'messages', msg.id);
        updateDocumentNonBlocking(msgRef, { readBy: arrayUnion(myId) });
      }
    });
  }, [messages, auth.currentUser?.uid, firestore, group.id]);

  // 4. TYPING LOGIC
  useEffect(() => {
    if (!text.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      updateTypingStatus(false);
      return;
    }

    updateTypingStatus(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
  }, [text]);

  const updateTypingStatus = (isTyping: boolean) => {
    if (!firestore || !auth.currentUser || !group.id) return;
    const typingRef = doc(firestore, 'groups', group.id, 'typing', auth.currentUser.uid);
    if (isTyping) {
      setDoc(typingRef, { isTyping: true, userName: userProfile?.name, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      deleteDoc(typingRef).catch(() => {});
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !firestore || !auth.currentUser || !userProfile) return;

    const messageData: Partial<Message> = {
      text: text.trim(),
      senderId: auth.currentUser.uid,
      senderName: userProfile.name || "Unknown User",
      createdAt: new Date().toISOString(),
      type: 'text',
      readBy: [auth.currentUser.uid],
      replyTo: replyingTo ? { messageId: replyingTo.id, text: replyingTo.text || '', senderName: replyingTo.senderName } : null,
      isForwarded: false,
    };

    addDocumentNonBlocking(collection(firestore, 'groups', group.id, 'messages'), messageData);

    updateDocumentNonBlocking(doc(firestore, 'groups', group.id), {
      lastMessage: text.trim(),
      updatedAt: new Date().toISOString()
    });

    setText('');
    setReplyingTo(null);
    setShowEmoji(false);
    updateTypingStatus(false);
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!firestore || !storage || !auth.currentUser || !userProfile) return;
    
    setIsUploading(true);
    try {
      const filePath = `voice_messages/groups/${group.id}/${Date.now()}_voice.webm`;
      const audioUrl = await uploadAudio(storage, blob, filePath);

      const messageData: Partial<Message> = {
        type: 'audio',
        mediaUrl: audioUrl,
        duration: duration,
        senderId: auth.currentUser.uid,
        senderName: userProfile.name || "User",
        readBy: [auth.currentUser.uid],
        createdAt: new Date().toISOString(),
        isForwarded: false,
      };

      addDocumentNonBlocking(collection(firestore, 'groups', group.id, 'messages'), messageData);

      updateDocumentNonBlocking(doc(firestore, 'groups', group.id), {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !storage || !userProfile) return;

    if (file.type.startsWith('video')) {
        try {
            await validateVideo(file);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Denied', description: err.message });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
    }

    setIsUploading(true);
    try {
        const filePath = `group_media/${group.id}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, filePath);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);

        const messageData: Partial<Message> = {
            senderId: userProfile.id,
            senderName: userProfile.name || "User",
            readBy: [userProfile.id],
            createdAt: new Date().toISOString(),
            type: file.type.startsWith('image') ? 'image' : 'file',
            mediaUrl: downloadUrl,
            text: file.name,
            isForwarded: false,
        };

        addDocumentNonBlocking(collection(firestore, 'groups', group.id, 'messages'), messageData);

        updateDocumentNonBlocking(doc(firestore, 'groups', group.id), {
            lastMessage: file.type.startsWith('image') ? "🖼️ Shared an image" : "📄 Shared a file",
            updatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-slate-900/50 rounded-[3rem] shadow-xl border border-border overflow-hidden">
      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {isLoading ? (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-16 w-3/4 rounded-3xl" />
                <Skeleton className="h-16 w-1/2 ml-auto rounded-3xl" />
            </div>
        ) : messages && messages.length > 0 ? (
            messages.map((msg: Message) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const readCount = (msg.readBy?.length || 1) - 1; // Exclude sender
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                        {!isMe && (
                            <Avatar className="h-8 w-8 mt-auto border shadow-sm">
                                <AvatarFallback className="text-[10px] font-black">{msg.senderName.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn(
                            "max-w-[80%] group relative p-4 transition-all",
                            isMe ? 'bg-primary text-primary-foreground rounded-3xl rounded-tr-none' : 'bg-muted/50 dark:bg-slate-800 text-foreground rounded-3xl rounded-tl-none border shadow-sm'
                        )}>
                            
                            {!isMe && <p className="text-[10px] font-black text-primary uppercase mb-1.5">{msg.senderName}</p>}

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
                                <div className="min-w-[200px] max-w-full">
                                    <VoicePlayer 
                                        url={msg.mediaUrl || ''} 
                                        duration={msg.duration} 
                                        theme={isMe ? 'primary' : 'dark'} 
                                    />
                                </div>
                            ) : msg.type === 'image' && msg.mediaUrl ? (
                                <Image src={msg.mediaUrl} width={500} height={300} className="rounded-xl mb-2 max-h-60 object-cover w-full shadow-inner" alt="Shared" />
                            ) : msg.type === 'product' && msg.productInfo ? (
                                <Link href={`/products/${msg.productInfo.id}`} className="block p-3 bg-black/5 rounded-2xl border border-black/10 hover:scale-[1.02] transition-transform">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                                            <Image src={msg.productInfo.imageUrl} fill className="object-cover" alt="" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-[10px] truncate">{msg.productInfo.name}</p>
                                            <p className="text-[9px] font-black text-amber-600">GHS {msg.productInfo.price.toFixed(2)}</p>
                                        </div>
                                        <ShoppingBag size={12} className="ml-auto text-muted-foreground" />
                                    </div>
                                </Link>
                            ) : msg.type === 'file' ? (
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-xl mb-2 hover:bg-black/10 transition-colors">
                                    <div className="p-2 bg-white/20 rounded-lg"><Paperclip size={14} /></div>
                                    <span className="text-xs font-bold truncate">{msg.text}</span>
                                </a>
                            ) : (
                                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                            )}

                            {isMe && readCount > 0 && (
                                <div className="mt-1 flex justify-end">
                                    <p className="text-[8px] font-black uppercase opacity-60">Seen by {readCount}</p>
                                </div>
                            )}

                            <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1`}>
                                <button onClick={() => setReplyingTo(msg)} className="p-2 bg-background border shadow-md rounded-full text-muted-foreground hover:text-primary active:scale-90 transition-all"><Reply size={14}/></button>
                                <button onClick={() => setForwardingMessage(msg)} className="p-2 bg-background border shadow-md rounded-full text-muted-foreground hover:text-green-600 active:scale-90 transition-all"><Forward size={14}/></button>
                            </div>
                        </div>
                    </div>
                )
            })
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                <ShieldCheck size={64} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Yard Fortress Encrypted</p>
                <p className="text-[10px] mt-2 italic font-medium">Start the vibration by sending a message.</p>
            </div>
        )}

        {typingUsers.length > 0 && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-muted/50 p-2.5 rounded-2xl flex items-center gap-2 border border-border/50">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                        {typingUsers.length === 1 
                            ? `${typingUsers[0].userName} is typing` 
                            : `${typingUsers.length} members are typing`}
                    </span>
                    <div className="flex gap-0.5">
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                </div>
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-background border-t border-border relative flex-shrink-0">
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-primary" />
            <span className="text-[10px] font-black uppercase text-primary">Broadcasting Vocal...</span>
          </div>
        )}

        {showEmoji && (
          <div className="absolute bottom-full mb-4 left-4 z-50 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="flex justify-end p-2 bg-background rounded-t-2xl border-b border-border">
                  <button onClick={() => setShowEmoji(false)} className="p-1 hover:bg-muted rounded-full">
                      <X size={16} className="text-muted-foreground" />
                  </button>
              </div>
            <EmojiPicker onEmojiClick={(d) => setText(prev => prev + d.emoji)} />
          </div>
        )}

        {replyingTo && (
          <div className="mb-3 p-3 bg-primary/5 rounded-2xl flex justify-between items-center animate-in slide-in-from-bottom-2 border border-primary/10">
            <div className="border-l-4 border-primary pl-3 min-w-0">
               <p className="text-[10px] font-black text-primary uppercase">Replying to {replyingTo.senderName}</p>
               <p className="text-xs text-muted-foreground truncate">{replyingTo.text}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"><X size={14}/></button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2.5 text-muted-foreground hover:text-primary transition-colors">
              <Smile size={22} />
            </button>
            <VoiceRecorder onSend={handleSendAudio} />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              <ImagePlus size={22} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>

          <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
            <input 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Post to the Yard..."
              className="flex-1 bg-muted/50 p-4 rounded-[2rem] border-none outline-none text-sm font-medium focus:bg-background focus:ring-2 focus:ring-primary transition-all shadow-inner"
            />
            <button type="submit" disabled={!text.trim()} className="p-4 bg-slate-900 text-white dark:bg-primary dark:text-white rounded-full shadow-lg active:scale-90 transition-transform disabled:opacity-30">
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
      
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          isOpen={!!forwardingMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}
    </div>
  );
}
