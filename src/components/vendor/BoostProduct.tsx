'use client';

import React, { useState, useMemo } from 'react';
import { Zap, Target, Loader2, ShieldCheck, Users, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Product, Group, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, limit } from 'firebase/firestore';
import AdCreativeManager from './AdCreativeManager';
import { cn } from '@/lib/utils';

export function BoostProduct({ product }: { product: Product }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [targetType, setTargetType] = useState<'major' | 'group'>(product.targetType === 'group' ? 'group' : 'major');
  const [targetValue, setTargetValue] = useState(product.targetValue || product.sponsoredMajor || '');
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch Dynamic Data: Groups & Users (to find unique majors)
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !product.campusId) return null;
    return query(collection(firestore, 'groups'), where('campusId', '==', product.campusId));
  }, [firestore, product.campusId]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !product.campusId) return null;
    // We only need a sample to find active majors
    return query(collection(firestore, 'users'), where('campusId', '==', product.campusId), limit(100));
  }, [firestore, product.campusId]);

  const { data: groups, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

  // Calculate unique majors from sample users
  const uniqueMajors = useMemo(() => {
    const majors = new Set<string>();
    majors.add("All Majors");
    users?.forEach(u => {
      if (u.major) majors.add(u.major);
    });
    return Array.from(majors);
  }, [users]);

  const handleUpdateTargeting = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
        const productRef = doc(firestore, 'products', product.id);
        updateDocumentNonBlocking(productRef, {
            isSponsored: true,
            adStatus: 'active',
            targetType: targetType,
            targetValue: targetValue,
            sponsoredMajor: targetType === 'major' ? targetValue : 'Group Membership', // Backwards compatibility
            updatedAt: new Date().toISOString()
        });
        toast({ 
            title: 'Targeting Updated', 
            description: `This ad is now targeting the ${targetType === 'major' ? targetValue : 'selected community'}.` 
        });
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update targeting.' });
    } finally {
        setIsSaving(false);
    }
  };

  const getTargetName = () => {
    if (targetType === 'major') return targetValue;
    const group = groups?.find(g => g.id === targetValue);
    return group?.name || 'Community';
  };

  return (
    <div className="space-y-8">
        {/* DYNAMIC TARGETING ENGINE */}
        <Card className="bg-primary/5 border-primary/20 rounded-[2.5rem] overflow-hidden shadow-sm">
            <CardHeader className="bg-primary/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-xl text-white shadow-lg shadow-primary/20">
                        <Target size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-primary font-black">Community Targeting Engine</CardTitle>
                        <CardDescription className="font-bold uppercase text-[10px] tracking-widest text-primary/60">Dynamic Database Lookup</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                
                {/* Switcher: Major vs Group */}
                <div className="flex gap-2 p-1.5 bg-muted rounded-2xl">
                    <button 
                        onClick={() => { setTargetType('major'); setTargetValue(''); }}
                        className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all",
                            targetType === 'major' ? "bg-background shadow-md text-primary" : "text-muted-foreground"
                        )}
                    >
                        <GraduationCap size={14} /> Targeted Major
                    </button>
                    <button 
                        onClick={() => { setTargetType('group'); setTargetValue(''); }}
                        className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all",
                            targetType === 'group' ? "bg-background shadow-md text-primary" : "text-muted-foreground"
                        )}
                    >
                        <Users size={14} /> Active Group
                    </button>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
                        Select {targetType === 'major' ? 'Database Major' : 'Campus Community'}
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {targetType === 'major' ? (
                            <Select onValueChange={setTargetValue} value={targetValue}>
                                <SelectTrigger className="flex-1 h-12 rounded-xl border-2 border-primary/10 font-bold bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Select a major" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    {uniqueMajors.map(major => (
                                        <SelectItem key={major} value={major} className="rounded-lg font-bold">{major}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Select onValueChange={setTargetValue} value={targetValue}>
                                <SelectTrigger className="flex-1 h-12 rounded-xl border-2 border-primary/10 font-bold bg-white dark:bg-slate-950">
                                    <SelectValue placeholder={isLoadingGroups ? "Scanning Groups..." : "Select a Group"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    {groups && groups.length > 0 ? (
                                        groups.map(group => (
                                            <SelectItem key={group.id} value={group.id} className="rounded-lg font-bold">
                                                {group.name} ({group.members.length} members)
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-xs text-muted-foreground italic">No groups found on this campus.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                        <button 
                            onClick={handleUpdateTargeting}
                            disabled={isSaving || !targetValue}
                            className="bg-slate-900 text-white px-8 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 shadow-lg"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Deploy Target"}
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* CREATIVE LAB */}
        <AdCreativeManager product={product} targetMajor={getTargetName()} />

        {/* LOGISTICS FEEDBACK */}
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-800 flex items-start gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200/50">
                <Zap size={20} fill="currentColor" />
            </div>
            <div>
                <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-widest text-[10px]">Commercial Placement</h4>
                <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 leading-relaxed italic">
                    {targetType === 'group' 
                        ? "This ad will now appear directly inside the targeted group's lounge and on their dashboard."
                        : "This ad is optimized for dashboard placement for students studying your selected major."}
                </p>
            </div>
        </div>
    </div>
  );
}