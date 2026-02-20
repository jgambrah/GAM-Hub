'use client';

import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { ShieldCheck, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import Image from 'next/image';

export default function VendorIDVerification({ vendorData }: { vendorData: User }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { storage, auth, firestore } = useFirebase();
  const { toast } = useToast();

  const status = vendorData?.idVerificationStatus || 'unverified'; // unverified | pending | approved

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleUploadID = async () => {
    if (!file || !auth.currentUser || !firestore) return;

    setLoading(true);
    try {
      // 1. Upload to a PRIVATE storage path
      const storageRef = ref(storage, `verification_docs/${auth.currentUser.uid}/ghana_card`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      // 2. Update Firestore
      const userRef = doc(firestore, 'users', auth.currentUser.uid);
      updateDocumentNonBlocking(userRef, {
        ghanaCardUrl: downloadUrl,
        idVerificationStatus: 'pending',
        idSubmittedAt: serverTimestamp(),
      });

      toast({
        title: "Ghana Card submitted!",
        description: "The Liaison will verify your identity shortly.",
      });
      setPreview(null);
      setFile(null);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: "Upload failed",
        description: "Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-xl max-w-xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-3xl ${status === 'approved' ? 'bg-green-100 dark:bg-green-900/20 text-green-600' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-600'}`}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">Identity Verification</h3>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Official Ghana Card</p>
          </div>
        </div>

        {/* STATUS BADGE */}
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
          status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 
          status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40' : 'bg-red-100 text-red-700 dark:bg-red-900/40'
        }`}>
          {status}
        </span>
      </div>

      {status === 'approved' ? (
        <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/20 flex items-center gap-4">
           <CheckCircle2 className="text-green-600" size={32} />
           <p className="text-sm font-bold text-green-800 dark:text-green-300">Your identity is verified. You can now list high-value items in the Yard!</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-2xl border border-border flex items-start gap-3">
             <AlertCircle className="text-muted-foreground mt-1" size={18} />
             <p className="text-[11px] text-muted-foreground leading-relaxed">
               Please upload a clear photo of your <b>Ghana Card (Front)</b>. This information is encrypted and only visible to the National Liaison for security audits.
             </p>
          </div>

          <div className="relative aspect-[1.6/1] rounded-[2rem] border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
            {preview ? (
              <Image src={preview} layout="fill" className="object-cover" alt="Ghana Card Preview" />
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-3">
                <Upload size={32} className="text-muted-foreground/30" />
                <span className="text-[10px] font-black text-muted-foreground uppercase">Select Ghana Card Photo</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <button 
            disabled={!file || loading || status === 'pending'}
            onClick={handleUploadID}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : status === 'pending' ? "Under Review by Liaison" : "Submit for Verification"}
          </button>
        </div>
      )}
    </div>
  );
}
