'use client';

import React, { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import type { User } from '@/lib/types';
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function ContactSetupCard({ userProfile }: { userProfile: User }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // If user already has a phone number, or if there's no user profile, don't show the card.
  if (!userProfile || userProfile.contactPhone) return null;

  const handleSave = async () => {
    if (!phone.trim() || !firestore) {
        toast({ variant: 'destructive', title: 'Invalid number', description: 'Please enter a valid phone number.' });
        return;
    }
    setLoading(true);
    const userRef = doc(firestore, 'users', userProfile.id);
    try {
        updateDocumentNonBlocking(userRef, { contactPhone: phone });
        toast({ title: 'Profile Updated!', description: 'Your contact number has been saved.' });
        // The component will disappear on next re-render as userProfile will have the number.
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save your phone number.' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="mx-4 mb-6 p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 dark:shadow-blue-900/50">
      <h3 className="font-black text-lg flex items-center gap-2">
        <Phone size={20} /> Complete Your Profile
      </h3>
      <p className="text-xs opacity-80 mt-1 mb-4">Add your number so vendors can call you for delivery.</p>
      <div className="flex gap-2">
        <input 
          type="tel" 
          placeholder="024XXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1 p-3 rounded-xl bg-white/10 border border-white/20 outline-none text-sm placeholder:text-white/50"
          disabled={loading}
        />
        <button 
            onClick={handleSave} 
            disabled={loading || !phone.trim()}
            className="bg-white text-blue-600 px-6 py-3 rounded-xl font-black text-xs disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}
        </button>
      </div>
    </div>
  );
}
