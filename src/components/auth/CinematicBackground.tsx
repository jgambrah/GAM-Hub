'use client';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CAMPUS_IMAGES = [
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80", // Campus Life
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80", // Collaboration
  "https://images.unsplash.com/photo-1513258496099-48168024adb0?auto=format&fit=crop&q=80", // Focus/Study
  "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&q=80", // Social/Vendor
];

const FEATURES = [
  { icon: "🛡️", text: "The Fortress: Verified .edu.gh Security" },
  { icon: "💰", text: "The Monies: Secure MoMo Escrow" },
  { icon: "🔥", text: "The Arena: National Vibe War" },
  { icon: "🎓", text: "The Lounge: Staff-Only Exclusives" },
  { icon: "🤖", text: "The Guide: Liaison AI Tutor" },
];

export function CinematicBackground() {
  const [imgIndex, setImgIndex] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    const imgInterval = setInterval(() => setImgIndex((p) => (p + 1) % CAMPUS_IMAGES.length), 60000);
    const featInterval = setInterval(() => setFeatureIndex((p) => (p + 1) % FEATURES.length), 4000);
    return () => { 
      clearInterval(imgInterval); 
      clearInterval(featInterval); 
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      {/* Background Image Carousel */}
      <AnimatePresence mode="wait">
        <motion.img
          key={imgIndex}
          src={CAMPUS_IMAGES[imgIndex]}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.4, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 z-[1]" />

      {/* Feature Flipper Overlay */}
      <div className="absolute bottom-10 left-10 z-10 hidden md:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={featureIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 shadow-2xl"
          >
            <span className="text-2xl">{FEATURES[featureIndex].icon}</span>
            <span className="text-white font-black tracking-tight uppercase text-xs tracking-[0.1em]">
              {FEATURES[featureIndex].text}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
