'use client';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CAMPUS_IMAGES = [
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1", // Campus Plaza
  "https://images.unsplash.com/photo-1541339907198-e08756ebafe3", // Graduation/Authority
  "https://images.unsplash.com/photo-1525921429624-479b6a29d810", // Modern Architecture
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c", // Tech/Shopping
  "https://images.unsplash.com/photo-1523240715639-99a8088fb98e", // Group Discussion
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac", // Social Vibes
  "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a", // Market/Vendors
  "https://images.unsplash.com/photo-1552664730-d307ca884978", // Strategy/Meeting
  "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846", // Cafe/Shopping
  "https://images.unsplash.com/photo-1523287562758-66c7fc58967f", // Library/Focus
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655", // Lecture Hall
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18", // Event/Arena Hype
  "https://images.unsplash.com/photo-1501503060800-5fa24abf7446", // Dorm Life
  "https://images.unsplash.com/photo-1521791136064-7986c2923216", // Professional Staff Lounge
  "https://images.unsplash.com/photo-1531482615713-2afd69097998", // Collaboration
  "https://images.unsplash.com/photo-1434039347661-90f42067f267", // Writing/Registry
  "https://images.unsplash.com/photo-1571260899304-425eee4c7efc", // University Gateway
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f", // Students Walking
  "https://images.unsplash.com/photo-1492538368677-f6e0afe31dcc", // Laptop/Online Shopping
  "https://images.unsplash.com/photo-1558021212-51b6ecfa0db9", // Books/Knowledge
].map(url => `${url}?auto=format&fit=crop&q=80&w=1600`);

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
    // 10 Second Pulse for Images
    const imgInterval = setInterval(() => {
      setImgIndex((prev) => (prev + 1) % CAMPUS_IMAGES.length);
    }, 10000);

    // 4 Second Cycle for Features
    const featInterval = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % FEATURES.length);
    }, 4000);

    return () => {
      clearInterval(imgInterval);
      clearInterval(featInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      {/* Background Image Carousel with Live Pulse Logic */}
      <AnimatePresence mode="wait">
        <motion.div
          key={imgIndex}
          initial={{ opacity: 0, scale: 1.1, filter: "blur(4px)" }}
          animate={{ opacity: 0.6, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 h-full w-full"
        >
          <img
            src={CAMPUS_IMAGES[imgIndex]}
            alt="Campus Life"
            className="h-full w-full object-cover"
          />
          {/* Multi-Layer Gradient for Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 z-[1]" />
        </motion.div>
      </AnimatePresence>

      {/* Feature Flipper Overlay */}
      <div className="absolute bottom-10 left-10 z-10 hidden md:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={featureIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-2xl px-6 py-3 rounded-full border border-white/20 shadow-2xl"
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
