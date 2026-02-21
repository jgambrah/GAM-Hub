'use client';

import { AuthForm } from '@/components/auth/auth-form';
import { FirebaseClientProvider } from '@/firebase';
import { CinematicBackground } from '@/components/auth/CinematicBackground';
import { motion } from 'framer-motion';

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <div className="relative min-h-screen overflow-hidden bg-black">
        {/* CINEMATIC BACKDROP */}
        <CinematicBackground />

        {/* GLASSMORPHIC CONTAINER */}
        <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="w-full max-w-[480px] overflow-hidden rounded-[3.5rem] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.6)]"
          >
            <div className="p-10 md:p-12 flex flex-col items-center">
              
              {/* BRANDING */}
              <div className="flex flex-col items-center mb-10 text-center">
                <div className="p-4 bg-primary text-primary-foreground rounded-[2rem] shadow-xl mb-4 rotate-3 hover:rotate-0 transition-transform">
                  <span className="text-2xl">🛡️</span>
                </div>
                <h1 className="font-headline text-5xl font-black tracking-tighter text-white uppercase italic">
                  GAM <span className="text-yellow-500">HUB</span>
                </h1>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-2">
                  National Campus Signal
                </p>
              </div>

              <div className="w-full">
                <div className="mb-8 text-center">
                  <h2 className="text-xl font-bold text-white">Welcome to the Yard</h2>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Verify your identity to enter the fortress.</p>
                </div>
                
                <AuthForm />
              </div>

              <div className="mt-10 pt-8 border-t border-white/10 w-full text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Only verified <span className="text-white font-black">.edu.gh</span> accounts permitted.<br/>
                  By entering, you salute the Yard & agree to our Protocols.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* FOOTER BADGE */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-[0.3em]">
            Official Liaison Infrastructure • GH 🇬🇭
          </div>
        </div>
      </div>
    </FirebaseClientProvider>
  );
}
