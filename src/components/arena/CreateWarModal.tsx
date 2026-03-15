
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, Globe, Zap, Swords, Building2, ShieldCheck } from 'lucide-react';
import { campuses as staticCampuses } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function CreateWarModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [campusA, setCampusA] = useState('');
  const [campusB, setCampusB] = useState('');
  const [duration, setDuration] = useState('60'); // Minutes
  const [isLoading, setIsLoading] = useState(false);

  const handleLaunch = async () => {
    if (!firestore || !user || !title || !campusA || !campusB) return;
    if (campusA === campusB) {
        toast({ variant: 'destructive', title: "Conflict Error", description: "A campus cannot declare war on itself." });
        return;
    }

    setIsLoading(true);
    try {
      const cA = staticCampuses.find(c => c.id === campusA);
      const cB = staticCampuses.find(c => c.id === campusB);

      const warData = {
        title: title.trim(),
        campusAId: campusA,
        campusBId: campusB,
        campusAInfo: {
            name: cA?.name || campusA,
            acronym: cA?.acronym || campusA.toUpperCase(),
            primaryColor: cA?.primaryColor || '#3b82f6'
        },
        campusBInfo: {
            name: cB?.name || campusB,
            acronym: cB?.acronym || campusB.toUpperCase(),
            primaryColor: cB?.primaryColor || '#f59e0b'
        },
        votesA: 0,
        votesB: 0,
        viewerCount: 1,
        status: 'live',
        creatorId: user.id,
        createdAt: serverTimestamp(),
        endsAt: new Date(Date.now() + parseInt(duration) * 60 * 1000).toISOString()
      };

      await addDocumentNonBlocking(collection(firestore, 'campus_wars'), warData);
      
      toast({ title: "NATIONAL WAR DECLARED! ⚔️" });
      onOpenChange(false);
      setTitle(''); setCampusA(''); setCampusB('');
    } catch (err) {
      toast({ variant: 'destructive', title: "Mobilization Refused" });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = title.trim().length > 5 && !!campusA && !!campusB && campusA !== campusB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <Globe size={24} className="animate-spin-slow" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">War Architect</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Mobilize the National Hub for Combat</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 bg-background">
          <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">War Directive (Headline)</Label>
                <Input placeholder="e.g. UG vs KNUST: The Battle for Accra" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl border-none bg-muted font-bold h-14 text-lg shadow-inner" />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-indigo-500 px-1">Primary Faction</Label>
                    <Select value={campusA} onValueChange={setCampusA}>
                        <SelectTrigger className="h-14 rounded-xl border-none bg-muted font-black shadow-inner">
                            <SelectValue placeholder="Select Campus" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            {staticCampuses.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-red-500 px-1">Rival Faction</Label>
                    <Select value={campusB} onValueChange={setCampusB}>
                        <SelectTrigger className="h-14 rounded-xl border-none bg-muted font-black shadow-inner">
                            <SelectValue placeholder="Select Campus" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            {staticCampuses.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 px-1">Conflict Duration (Minutes)</Label>
                <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="h-14 rounded-xl border-none bg-muted font-bold shadow-inner">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="30">30 Minutes (Skirmish)</SelectItem>
                        <SelectItem value="60">60 Minutes (Standard War)</SelectItem>
                        <SelectItem value="120">2 Hours (Mass Showdown)</SelectItem>
                        <SelectItem value="1440">24 Hours (Siege)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="p-6 bg-indigo-50 rounded-3xl border-2 border-dashed border-indigo-200 flex items-start gap-4">
             <ShieldCheck className="text-indigo-600 mt-1" size={20} />
             <p className="text-[10px] text-indigo-800 font-bold leading-relaxed">
                Liaison Decree: This war will be broadcasted to every student's dashboard. Ensure the directive is worthy of the National Arena.
             </p>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-8 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Retreat</Button>
            <Button onClick={handleLaunch} disabled={isLoading || !isFormValid} className={cn("flex-1 rounded-2xl font-black px-8 h-16 shadow-2xl transition-all active:scale-95 text-lg", isFormValid ? "bg-red-600 text-white" : "bg-slate-200 text-slate-400")}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Swords size={24} className="mr-2" /> DECLARE NATIONAL WAR</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
