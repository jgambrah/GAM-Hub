'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { Chat, User } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Search, Loader2 } from 'lucide-react';
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

export function ChatSidebar({ chats, isLoading, selectedChat, onSelectChat, currentUser }: ChatSidebarProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingChat, setIsCreatingChat] = useState(false);

    // --- Search Logic ---
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !searchTerm.trim()) return null;
        // Simple prefix search
        return query(
        collection(firestore, 'users'),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        limit(10)
        );
    }, [firestore, searchTerm]);

    const { data: searchResults, isLoading: isLoadingSearch } = useCollection<User>(usersQuery);
    // --- End Search Logic ---

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

        const chatId = [currentUser.id, selectedUser.id].sort().join('_');
        const chatRef = doc(firestore, 'chats', chatId);

        try {
            const chatSnap = await getDoc(chatRef);
            let chatData: Chat;

            if (chatSnap.exists()) {
                // Chat already exists, just use its data
                chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
            } else {
                // Chat doesn't exist, create it
                const newChatData: Omit<Chat, 'id'> = {
                    users: [currentUser.id, selectedUser.id],
                    updatedAt: new Date().toISOString(), // Use ISO string to match type
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
                    lastMessage: `You are now connected with ${selectedUser.name}.`
                };
                await setDoc(chatRef, newChatData);
                chatData = { id: chatId, ...newChatData } as Chat;
            }
            
            onSelectChat(chatData);
            setSearchTerm(''); // Clear search after selection

        } catch (error) {
            console.error("Error finding or creating chat:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start conversation.' });
        } finally {
            setIsCreatingChat(false);
        }
    };


  return (
    <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b space-y-4">
            <h2 className="text-xl font-bold font-headline">Messages</h2>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search people..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {isCreatingChat && (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="animate-spin text-muted-foreground" />
                </div>
            )}
            {/* Show search results if user is typing */}
            {searchTerm.trim() && !isCreatingChat ? (
                <div className="p-2 space-y-1">
                    {isLoadingSearch && <Skeleton className="h-16 w-full" />}
                    {searchResults && searchResults.length > 0 ? (
                        searchResults.filter(u => u.id !== currentUser?.id).map(user => (
                            <div 
                                key={user.id}
                                onClick={() => handleSelectUser(user)}
                                className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted"
                            >
                                <Avatar>
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                        ))
                    ) : !isLoadingSearch ? (
                        <p className="text-center text-sm text-muted-foreground pt-8">No users found.</p>
                    ) : null}
                </div>
            ) : (
                <>
                {/* Show existing chats if not searching */}
                {isLoading ? (
                <div className="p-4 space-y-4">
                    {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
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

                    return (
                    <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat)}
                        className={cn(
                        'flex w-full items-center gap-3 p-4 text-left transition-colors',
                        selectedChat?.id === chat.id ? 'bg-muted' : 'hover:bg-muted/50'
                        )}
                    >
                        <Avatar>
                        <AvatarImage src={otherUser.avatarUrl} alt={otherUser.name} />
                        <AvatarFallback>{otherUser.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                            <p className="font-semibold truncate">{otherUser.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                        </div>
                    </button>
                    );
                })
                ) : (
                <div className="p-8 text-center text-muted-foreground">
                    <p>No conversations yet.</p>
                    <p className="text-xs">Start a conversation by searching for someone.</p>
                </div>
                )}
                </>
            )}
        </div>
    </div>
  );
}
