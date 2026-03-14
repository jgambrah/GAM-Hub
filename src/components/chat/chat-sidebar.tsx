
'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { Chat, User } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Search, Loader2, MessageSquare, Plus } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, getDoc, doc, setDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ChatSidebarProps {
  chats: Chat[] | null;
  isLoading: boolean;
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  currentUser: User | null;
}

/**
 * ChatSidebar Component
 * --------------------
 * High-performance chat navigator.
 * Queries the root 'chats' collection for active conversations.
 */
export function ChatSidebar({ chats, isLoading, selectedChat, onSelectChat, currentUser }: ChatSidebarProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingChat, setIsCreatingChat] = useState(false);

    // --- Search Logic: Find new people to vibe with ---
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !searchTerm.trim()) return null;
        return query(
            collection(firestore, 'users'),
            where('name', '>=', searchTerm),
            where('name', '<=', searchTerm + '\uf8ff'),
            limit(10)
        );
    }, [firestore, searchTerm]);

    const { data: searchResults, isLoading: isLoadingSearch } = useCollection<User>(usersQuery);

    const getOtherUser = (chat: Chat) => {
        if (!currentUser || !chat.userAInfo || !chat.userBInfo) return null;
        if (chat.userAInfo.id === currentUser.id) return chat.userBInfo;
        return chat.userAInfo;
    }

    const handleSelectUser = async (selectedUser: User) => {
        if (!currentUser || !firestore) return;
        if (selectedUser.id === currentUser.id) {
            toast({ variant: 'destructive', title: "You can't message yourself!" });
            return;
        }
        setIsCreatingChat(true);

        // Generate deterministic Chat ID
        const chatId = [currentUser.id, selectedUser.id].sort().join('_');
        const chatRef = doc(firestore, 'chats', chatId);

        try {
            const chatSnap = await getDoc(chatRef);
            let chatData: Chat;

            if (chatSnap.exists()) {
                chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
            } else {
                // Initialize the Chat Document (Root metadata)
                const newChatData: Omit<Chat, 'id'> = {
                    users: [currentUser.id, selectedUser.id],
                    updatedAt: new Date().toISOString(),
                    userAInfo: {
                        id: currentUser.id,
                        name: currentUser.name || "User",
                        avatarUrl: currentUser.avatarUrl || ""
                    },
                    userBInfo: {
                        id: selectedUser.id,
                        name: selectedUser.name || "User",
                        avatarUrl: selectedUser.avatarUrl || ""
                    },
                    lastMessage: `Handshake initiated with ${selectedUser.name}.`
                };
                await setDoc(chatRef, newChatData);
                chatData = { id: chatId, ...newChatData } as Chat;
            }
            
            onSelectChat(chatData);
            setSearchTerm(''); 

        } catch (error) {
            console.error("Error starting chat:", error);
            toast({ variant: 'destructive', title: 'Connection Failed' });
        } finally {
            setIsCreatingChat(false);
        }
    };

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full animate-in slide-in-from-left-4 duration-500">
        <div className="p-6 border-b space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    <MessageSquare className="text-primary" /> Inbox
                </h2>
                <div className="p-2 bg-muted rounded-xl text-muted-foreground">
                    <Plus size={18} />
                </div>
            </div>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Find a major-mate..."
                    className="pl-10 h-12 rounded-2xl bg-muted/50 border-none font-bold text-sm focus:ring-2 focus:ring-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
            {isCreatingChat && (
                <div className="flex flex-col items-center justify-center p-10 space-y-3">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Opening Secure Hub...</p>
                </div>
            )}

            {searchTerm.trim() && !isCreatingChat ? (
                <div className="p-3 space-y-2 animate-in fade-in zoom-in-95">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">Search Results</p>
                    {isLoadingSearch && <Skeleton className="h-16 w-full rounded-2xl" />}
                    {searchResults && searchResults.length > 0 ? (
                        searchResults.filter(u => u.id !== currentUser?.id).map(user => (
                            <div 
                                key={user.id}
                                onClick={() => handleSelectUser(user)}
                                className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-muted/50 transition-all border border-transparent hover:border-border active:scale-95"
                            >
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback className="font-black text-primary">{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="font-black text-sm truncate">{user.name}</p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">{user.campusAcronym || user.campusId.toUpperCase()}</p>
                                </div>
                            </div>
                        ))
                    ) : !isLoadingSearch ? (
                        <p className="text-center text-xs text-muted-foreground py-10 italic">No matches found in the Yard.</p>
                    ) : null}
                </div>
            ) : (
                <div className="divide-y divide-border/50">
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-2xl" />
                            <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                        ))}
                    </div>
                ) : chats && chats.length > 0 ? (
                chats.map(chat => {
                    const otherUser = getOtherUser(chat);
                    if (!otherUser) return null;
                    const isActive = selectedChat?.id === chat.id;

                    return (
                    <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat)}
                        className={cn(
                        'w-full flex items-center gap-4 p-5 text-left transition-all border-l-4',
                        isActive 
                            ? 'bg-primary/5 border-primary shadow-inner' 
                            : 'hover:bg-muted/30 border-transparent'
                        )}
                    >
                        <div className="relative">
                            <Avatar className={cn("h-14 w-14 border-2 border-background shadow-sm transition-all", isActive && "ring-2 ring-primary ring-offset-2")}>
                                <AvatarImage src={otherUser.avatarUrl} alt={otherUser.name} />
                                <AvatarFallback className="font-black">{otherUser.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-baseline mb-1">
                                <p className={cn("font-black truncate transition-all", isActive ? "text-primary text-base" : "text-sm")}>
                                    {otherUser.name}
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase">
                                    {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: false })}
                                </p>
                            </div>
                            <p className={cn("text-xs truncate font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                                {chat.lastMessage}
                            </p>
                        </div>
                    </button>
                    );
                })
                ) : (
                <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-4 opacity-40">
                    <MessageSquare size={48} className="stroke-[1.5]" />
                    <div className="space-y-1">
                        <p className="font-black uppercase tracking-widest text-[10px]">Inbox Empty</p>
                        <p className="text-[10px] font-medium leading-relaxed">Vibe with someone new today!</p>
                    </div>
                </div>
                )}
                </div>
            )}
        </div>
    </div>
  );
}
