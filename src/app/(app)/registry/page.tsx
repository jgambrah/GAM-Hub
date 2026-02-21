
'use client';

import React from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { RegistryPost } from '@/lib/types';
import { Landmark, ShieldAlert, BadgeCheck, Calendar, FileText, Lock, Users, GraduationCap, Briefcase, Paperclip, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function RegistryHubPage() {
  const { firestore } = useFirebase();
  const { user, isAdmin, isUserLoading, isTokenReady } = useAuth();
  const { viewAsCampus } = useCampusView();

  const activeCampusId = isAdmin ? viewAsCampus?.id : user?.campusId;

  // LIAISON RESTRICTION: Determine if the current user is authorized to query registry_posts
  const isAuthorized = React.useMemo(() => {
    if (!user) return false;
    // Only 'management' role is now permitted per firestore.rules
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
          <div className="p-6 bg-white dark:bg-card rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="text-amber-600" size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Registry Restricted</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
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
        <div className="flex items-center gap-4 mb-12">
          <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-xl dark:bg-card">
            <Landmark size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">The Registry</h1>
            <p className="text-sm text-slate-500 font-medium dark:text-slate-400">Official University Directives & Circulars</p>
          </div>
        </div>

        <div className="space-y-6">
          {isLoading ? (
            <>
                <Skeleton className="h-48 w-full rounded-[2.5rem]" />
                <Skeleton className="h-48 w-full rounded-[2.5rem]" />
            </>
          ) : posts && posts.length > 0 ? (
            posts.map((post: RegistryPost) => (
              <div key={post.id} className={cn(
                  'bg-card rounded-[2.5rem] border-2 overflow-hidden transition-all', 
                  post.isUrgent ? 'border-red-200 dark:border-red-800 shadow-red-100/50 dark:shadow-red-900/20 shadow-lg' : 'border-border shadow-sm'
              )}>
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Official Notice
                      </span>
                      {post.isUrgent && (
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                          <ShieldAlert size={10} /> Urgent
                        </span>
                      )}
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                        {post.targetAudience === 'staff' ? <Briefcase size={10} /> : post.targetAudience === 'student' ? <GraduationCap size={10} /> : <Globe size={10} />}
                        Target: {post.targetAudience?.toUpperCase() || 'ALL'}
                      </span>
                    </div>
                    {post.createdAt && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-foreground mb-4">{post.title}</h3>
                  
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border mb-6">
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Multimedia Attachments */}
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="space-y-2 mb-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Official Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {post.attachments.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card border rounded-xl hover:bg-muted transition-all group shadow-sm"
                          >
                            <FileText size={14} className="text-primary" />
                            <span className="text-xs font-bold">Memo_{i+1}.pdf</span>
                            <Download size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-4 md:mb-0">
                      <BadgeCheck size={16} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase tracking-tight italic">Verified Directive: University Registry</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <FileText size={14} /> Ref: {post.id.slice(-8).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 border-2 border-dashed rounded-[2.5rem]">
                <p className="font-semibold text-slate-400 uppercase tracking-widest">No official directives.</p>
                <p className="text-sm text-muted-foreground mt-2 italic">The Yard is currently quiet. Check back for Registry updates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
