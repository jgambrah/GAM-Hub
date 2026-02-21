'use client';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CAMPUS_IMAGES = [
  // 1-5: Academic Excellence (Black Students in Libraries/Labs)
  "https://images.unsplash.com/photo-1523240715639-99a8088fb98e", // Group of Black students studying
  "https://images.unsplash.com/photo-1543269865-cbf427effbad", // Students collaborating in a modern hall
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f", // Students walking on a lush campus
  "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846", // Student with laptop in cafe
  "https://images.unsplash.com/photo-1523287562758-66c7fc58967f", // Focused study in a library

  // 6-10: The "Monies" & Shopping (Typical Market/Vendor Vibes)
  "https://images.unsplash.com/photo-1531053326607-9d349096d887", // Outdoor market/vendor setup
  "https://images.unsplash.com/photo-1472851294608-062f824d29cc", // Small business/shop vibe
  "https://plus.unsplash.com/premium_photo-1664371205096-27719665287a", // Transaction/MoMo vibe (hands/phone)
  "https://images.unsplash.com/photo-1556742044-3c52d6e88c62", // Digital payment/Shopping focus
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3", // Student checking phone (The Arena)

  // 11-15: Campus Landscapes (Architectural Vibes similar to Ghana)
  "https://images.unsplash.com/photo-1590013332441-1f953c483f05", // Red-roof architecture/tropical campus
  "https://images.unsplash.com/photo-1498243639351-a6c01e6a1006", // Concrete modern university walkway
  "https://images.unsplash.com/photo-1562774053-701939374585", // University main building/tower
  "https://images.unsplash.com/photo-1525921429624-479b6a29d810", // Open-air campus plaza
  "https://images.unsplash.com/photo-1519452575417-564c1401ecc0", // Tropical trees and campus paths

  // 16-20: Social Life & Leadership (The SRC & Vibe War)
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac", // Friends laughing/socializing
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18", // Event/Social gathering
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1", // Graduation/Success
  "https://images.unsplash.com/photo-1571260899304-425eee4c7efc", // University Gateway
  "https://images.unsplash.com/photo-1521791136064-7986c2923216", // Professional staff lounge vibe
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
    // 10 Second Interval for a fast, viby transition as requested
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
      {/* Background Image Carousel with Localized Identity Logic */}
      <AnimatePresence mode="wait">
        <motion.div
          key={imgIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.65, scale: 1 }} // Slightly higher opacity for darker Ghanaian skin tones to pop
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 h-full w-full"
        >
          <img
            src={CAMPUS_IMAGES[imgIndex]}
            alt="Ghanaian Campus Life"
            className="h-full w-full object-cover"
          />
          {/* Enhanced Vignette for that Premium "Lifestyle" look */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-transparent to-black/60 z-[1]" />
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
