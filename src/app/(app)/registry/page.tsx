'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { RegistryPost } from '@/lib/types';
import { Landmark, ShieldAlert, BadgeCheck, Calendar, FileText, Lock, Users, GraduationCap, Briefcase, Download, Paperclip } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function RegistryHubPage() {
  const { firestore } = useFirebase();
  const { user, isAdmin, isUserLoading, isTokenReady } = useAuth();
  const { viewAsCampus } = useCampusView();

  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // LIAISON RESTRICTION: Only management or admins can view official registry data
  const isAuthorized = React.useMemo(() => {
    if (!user) return false;
    return user.role === 'management' || isAdmin;
  }, [user, isAdmin]);

  // DATA FETCH: Guarded by isAuthorized and isTokenReady
  const registryQuery = useMemoFirebase(() => {
    if (!firestore || !activeCampusId || !isTokenReady || !isAuthorized) return null;
    
    return query(
      collection(firestore, 'registry_posts'),
      where('campusId', '==', activeCampusId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeCampusId, isTokenReady, isAuthorized]);

  const { data: posts, isLoading: isLoadingRegistry } = useCollection<RegistryPost>(registryQuery);
  
  const isLoading = isUserLoading || isLoadingRegistry;

  if (!isAuthorized && !isLoading) {
    return (
      <div className="p-4 md:p-8 bg-muted/50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-10 bg-white dark:bg-card rounded-[3.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Lock className="text-amber-600" size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Registry Restricted</h1>
            <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium">
              Official University Directives are only accessible to authorized management personnel. Please contact your campus administrator for official notices.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-muted/50 min-h-screen pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-6 mb-16">
          <div className="p-5 bg-blue-900 text-white rounded-[2rem] shadow-2xl">
            <Landmark size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">The Registry</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-70">Official University Directives & Circulars</p>
          </div>
        </div>

        <div className="space-y-8">
          {isLoading ? (
            <>
                <Skeleton className="h-64 w-full rounded-[3rem]" />
                <Skeleton className="h-64 w-full rounded-[3rem]" />
            </>
          ) : posts && posts.length > 0 ? (
            posts.map((post: RegistryPost) => (
              <div key={post.id} className={cn(
                  'bg-white dark:bg-card rounded-[3rem] border-2 overflow-hidden transition-all shadow-xl hover:shadow-2xl', 
                  post.isUrgent ? 'border-red-200 dark:border-red-900/50 ring-4 ring-red-50 dark:ring-red-900/10' : 'border-slate-100 dark:border-slate-800'
              )}>
                <div className="p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-blue-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                        Official Circular
                      </Badge>
                      {post.isUrgent && (
                        <Badge className="bg-red-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 border-none animate-pulse">
                          <ShieldAlert size={12} /> Urgent
                        </Badge>
                      )}
                      <Badge variant="outline" className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 border-2 border-slate-100 text-slate-500">
                        {post.targetAudience === 'staff' ? <Briefcase size={12} /> : post.targetAudience === 'student' ? <GraduationCap size={12} /> : <Globe size={12} />}
                        Target: {post.targetAudience?.toUpperCase() || 'ALL'}
                      </Badge>
                    </div>
                    {post.createdAt && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} className="text-slate-300" />
                            {new Date(post.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 leading-tight">{post.title}</h3>
                  
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 mb-8 shadow-inner">
                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">{post.content}</p>
                  </div>

                  {/* Multimedia Attachments */}
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-2 px-1">
                        <Paperclip size={14} className="text-blue-900" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Official Reference Memos</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {post.attachments.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-2xl hover:border-blue-900 transition-all group shadow-sm"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-900"><FileText size={16} /></div>
                                <span className="text-xs font-black truncate text-slate-700 dark:text-slate-200 uppercase tracking-tighter">Memo_{i+1}.pdf</span>
                            </div>
                            <Download size={16} className="text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-slate-400 mb-4 md:mb-0">
                      <BadgeCheck size={20} className="text-blue-900" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Verified Directive: University Registry Command</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                        <FileText size={14} /> Ref: UR-{post.id.slice(-8).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-32 bg-white dark:bg-card border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[4rem]">
                <Landmark className="mx-auto h-20 w-20 text-slate-100 dark:text-slate-800 mb-6" />
                <p className="font-black text-slate-300 uppercase tracking-[0.3em]">No official directives found</p>
                <p className="text-sm text-slate-400 mt-4 italic font-medium">The Registry is currently quiet. Directives will appear here as they are released.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
