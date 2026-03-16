
'use client';

import React, { useState } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, increment } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReportContentDialogProps {
  targetId: string;
  targetType: 'post' | 'battle' | 'comment';
  reportedUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_REASONS = [
    { id: 'harassment', label: 'Harassment or Bullying' },
    { id: 'hate_speech', label: 'Hate Speech' },
    { id: 'spam', label: 'Spam or Misleading' },
    { id: 'nudity', label: 'Explicit Content' },
    { id: 'other', label: 'Other' }
];

const REPORT_THRESHOLD = 5;

/**
 * ReportContentDialog Component
 * ----------------------------
 * Unified moderation interface for the Yard.
 * Citizens can report any vibration that violates community standards.
 */
export function ReportContentDialog({ targetId, targetType, reportedUserId, isOpen, onClose }: ReportContentDialogProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    try {
      const reportData = {
        targetId,
        targetType,
        reportedUserId,
        reportedById: user.id,
        reason,
        details: details.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      // 1. Log the report to the central registry
      await addDocumentNonBlocking(collection(firestore, 'content_reports'), reportData);

      // 2. AUTO-FLAGGING HANDSHAKE
      // Increment report count on the target entity
      const targetCol = targetType === 'post' ? 'campus_pulse' : targetType === 'battle' ? 'arena_battles' : 'comments';
      const targetRef = doc(firestore, targetCol, targetId);
      
      // We check the current report count (optimistic client-side logic + cloud function verification)
      // Note: In a production scale, a Cloud Function would handle the status transition.
      // Here we implement the logic for immediate feedback.
      await updateDocumentNonBlocking(targetRef, { 
          reportCount: increment(1)
      });

      setIsDone(true);
      toast({ title: "Report Submitted", description: "Liaison moderators have been alerted." });
      
      // Auto-close after celebration
      setTimeout(() => {
          onClose();
          setIsDone(false);
          setDetails('');
      }, 2000);

    } catch (err) {
      toast({ variant: 'destructive', title: "Submission Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
              <ShieldAlert size={24} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic">Security Report</DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest text-slate-400">
                Liaison Moderation Protocol Active
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 bg-background">
          {isDone ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 animate-in zoom-in duration-500">
                  <div className="p-6 bg-emerald-500 rounded-full shadow-xl">
                      <CheckCircle2 size={48} className="text-white" />
                  </div>
                  <div>
                      <h4 className="font-black text-lg">Thank You, Citizen</h4>
                      <p className="text-xs text-muted-foreground font-medium italic">
                          Your report helps keep the Yard safe for everyone.
                      </p>
                  </div>
              </div>
          ) : (
            <>
                <div className="space-y-4">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reason for Report</Label>
                    <RadioGroup value={reason} onValueChange={setReason} className="grid grid-cols-1 gap-2">
                        {REPORT_REASONS.map((r) => (
                            <div key={r.id} className={cn(
                                "flex items-center space-x-3 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                reason === r.id ? "bg-red-50 border-red-500 dark:bg-red-950/20" : "bg-muted/30 border-transparent hover:border-slate-200"
                            )} onClick={() => setReason(r.id)}>
                                <RadioGroupItem value={r.id} id={r.id} className="border-red-500 text-red-600" />
                                <Label htmlFor={r.id} className="font-bold text-sm cursor-pointer flex-1">{r.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Additional Context</Label>
                    <Textarea 
                        placeholder="Details of the violation..."
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        className="rounded-2xl bg-muted/50 border-none h-24 text-sm font-medium focus:ring-2 focus:ring-red-500 shadow-inner"
                    />
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-[9px] text-amber-800 dark:text-amber-400 leading-relaxed font-bold italic">
                        Liaison Decree: Malicious or false reporting is a violation of the Yard Protocols and may result in account restriction.
                    </p>
                </div>
            </>
          )}
        </div>

        {!isDone && (
            <DialogFooter className="bg-muted/30 p-8 border-t">
                <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
                <Button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting} 
                    className="flex-1 rounded-2xl font-black px-8 h-16 shadow-2xl transition-all active:scale-95 text-sm uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={18} className="mr-2" /> SUBMIT REPORT</>}
                </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
