
'use client';

import React from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/lib/types';
import { 
  Bell, MessageSquare, ThumbsUp, ShoppingBag, Flame, 
  Zap, Circle, CheckCircle2, UserPlus, Mic, Calendar, 
  Loader2, Share2, Tag, Info, AlertTriangle, PackageSearch
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * NotificationBell Component
 * ------------------------
 * Real-time notification orchestrator for the Yard.
 * Now expanded with FCM push context and exhaustive type handling.
 */
export function NotificationBell() {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();

  // 📶 REAL-TIME LISTENER HANDSHAKE
  const notifQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return query(
      collection(firestore, 'users', user.id, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, user?.id]);

  const { data: notifications, isLoading } = useCollection<Notification>(notifQuery);

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const handleNotifClick = async (notif: Notification) => {
    if (!firestore || !user?.id) return;
    
    // Mark as read instantly (Non-blocking)
    const notifRef = doc(firestore, 'users', user.id, 'notifications', notif.id);
    updateDocumentNonBlocking(notifRef, { read: true });

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const markAllRead = () => {
    if (!firestore || !user?.id || !notifications) return;
    notifications.filter(n => !n.read).forEach(n => {
        const ref = doc(firestore, 'users', user.id, 'notifications', n.id);
        updateDocumentNonBlocking(ref, { read: true });
    });
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'comment': return <MessageSquare className="text-blue-500" size={16} />;
      case 'like': return <Flame className="text-orange-500" size={16} />;
      case 'share': return <Share2 className="text-cyan-500" size={16} />;
      case 'follow': return <UserPlus className="text-purple-500" size={16} />;
      case 'voice_reply': return <Mic className="text-pink-500" size={16} />;
      case 'message':
      case 'voice_message':
      case 'group_message': return <Zap className="text-indigo-500" size={16} />;
      case 'order': return <ShoppingBag className="text-emerald-500" size={16} />;
      case 'price_drop': return <Tag className="text-red-500" size={16} />;
      case 'vendor_reply': return <MessageSquare className="text-amber-500" size={16} />;
      case 'product_recommendation': return <PackageSearch className="text-blue-600" size={16} />;
      case 'event': return <Calendar className="text-amber-500" size={16} />;
      case 'hostel_update': return <Info className="text-slate-500" size={16} />;
      case 'department_news': return <AlertTriangle className="text-red-400" size={16} />;
      default: return <Bell className="text-slate-400" size={16} />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90 border border-white/10 group">
          <Bell className={cn("text-primary-foreground group-hover:rotate-12 transition-transform", unreadCount > 0 && "animate-pulse")} size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 border-2 border-primary text-[10px] font-black text-white shadow-lg animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden animate-in slide-in-from-top-2 duration-300">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <DropdownMenuLabel className="p-0 text-lg font-black tracking-tight italic">
                Yard Notifications
            </DropdownMenuLabel>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {unreadCount > 0 ? `${unreadCount} new vibrations` : 'Pulse is quiet'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 size={12} /> Clear All
            </button>
          )}
        </div>
        
        <DropdownMenuSeparator className="m-0 bg-white/5" />
        
        <ScrollArea className="h-96">
          <div className="py-2">
            {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((notif) => (
                <DropdownMenuItem 
                  key={notif.id} 
                  onClick={() => handleNotifClick(notif)}
                  className={cn(
                    "flex items-start gap-4 p-4 cursor-pointer transition-colors focus:bg-muted/50",
                    !notif.read ? "bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500" : "border-l-4 border-transparent"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-xl shadow-sm border mt-1",
                    !notif.read ? "bg-white dark:bg-slate-800 border-blue-100" : "bg-muted/50 border-transparent"
                  )}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <p className={cn("text-sm leading-tight", !notif.read ? "font-black text-slate-900 dark:text-white" : "font-semibold text-slate-500 dark:text-slate-400")}>
                            {notif.title}
                        </p>
                        {!notif.read && <Circle className="fill-blue-500 text-blue-500 shrink-0 mt-1" size={8} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                    </p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-2">
                      {formatDistanceToNow(new Date(notif.createdAt?.toDate?.() || notif.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-4 opacity-40">
                <Bell size={48} className="stroke-[1.5]" />
                <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest text-[10px]">Inbox Empty</p>
                    <p className="text-[10px] font-medium leading-relaxed">Vibe with your peers to see alerts.</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 bg-slate-50 dark:bg-muted/20 border-t text-center">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">National Handshake Node • GH</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
