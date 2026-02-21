'use client';

import { FlameKindling } from 'lucide-react';
import { AuthForm } from '@/components/auth/auth-form';
import { FirebaseClientProvider } from '@/firebase';
import { CinematicBackground } from '@/components/auth/CinematicBackground';
import { motion } from 'framer-motion';

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* CINEMATIC BACKDROP */}
        <CinematicBackground />

        {/* LOGIN FORTRESS */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className="relative z-10 w-full max-w-[480px]"
        >
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.4)] border border-white/20 overflow-hidden">
            <div className="p-10 md:p-12 flex flex-col items-center">
              
              {/* BRANDING */}
              <div className="flex flex-col items-center mb-10">
                <div className="p-4 bg-primary text-primary-foreground rounded-[2rem] shadow-xl mb-4 rotate-3 hover:rotate-0 transition-transform">
                  <FlameKindling className="h-10 w-10" />
                </div>
                <h1 className="font-headline text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">
                  GAM Hub
                </h1>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-2">
                  National Campus Signal
                </p>
              </div>

              <div className="w-full">
                <div className="mb-8 text-center">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Welcome to the Yard</h2>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Verify your identity to enter the fortress.</p>
                </div>
                
                <AuthForm />
              </div>

              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 w-full text-center">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                  By entering, you salute the Yard & agree to our<br/> 
                  <a href="/terms" className="text-primary hover:underline underline-offset-4 mx-1">Terms</a> 
                  & 
                  <a href="/privacy" className="text-primary hover:underline underline-offset-4 mx-1">Privacy Protocol</a>
                </p>
              </div>
            </div>
          </div>

          {/* FOOTER BADGE */}
          <div className="mt-8 flex justify-center">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-[0.3em]">
              Official Liaison Infrastructure • GH 🇬🇭
            </div>
          </div>
        </motion.div>
      </div>
    </FirebaseClientProvider>
  );
}
