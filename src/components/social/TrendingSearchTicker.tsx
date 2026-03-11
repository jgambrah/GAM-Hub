'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Hash, Zap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendingSearchTickerProps {
    onSelect: (keyword: string) => void;
}

/**
 * TrendingSearchTicker Component
 * 
 * Displays a rotating list of hot keywords and hashtags.
 * Students can click these to instantly trigger the search engine.
 */
export default function TrendingSearchTicker({ onSelect }: TrendingSearchTickerProps) {
    const [activeIndex, setActiveIndex] = useState(0);

    const trends = [
        { label: 'Level 400 Stress', value: 'stress', icon: '😫' },
        { label: '#Matriculation2026', value: '#matriculation', icon: '🎓' },
        { label: 'Hostel Payouts', value: 'hostel', icon: '💰' },
        { label: 'Night Market Vibes', value: 'night market', icon: '🌙' },
        { label: '#SRC_Elections', value: '#elections', icon: '🗳️' },
        { label: 'Liaison AI Guide', value: 'ai', icon: '🤖' }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % trends.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [trends.length]);

    return (
        <div className="flex items-center gap-4 px-6 h-12 overflow-hidden bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <Sparkles size={14} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Pulse:</span>
            </div>
            
            <div className="relative h-full flex-1">
                {trends.map((trend, idx) => (
                    <button
                        key={trend.label}
                        onClick={() => onSelect(trend.value)}
                        className={cn(
                            "absolute inset-0 flex items-center gap-3 transition-all duration-1000 transform text-left",
                            idx === activeIndex 
                                ? "opacity-100 translate-y-0" 
                                : idx < activeIndex ? "opacity-0 -translate-y-4" : "opacity-0 translate-y-4"
                        )}
                    >
                        <span className="text-base leading-none">{trend.icon}</span>
                        <div className="flex items-center gap-2 group">
                            {trend.value.startsWith('#') ? (
                                <Hash size={10} className="text-blue-500" />
                            ) : (
                                <Zap size={10} className="text-amber-500 fill-amber-500" />
                            )}
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">
                                {trend.label}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            <div className="hidden sm:flex items-center gap-1">
                {[1, 2, 3].map(i => (
                    <div key={i} className={cn(
                        "w-1 h-1 rounded-full transition-all duration-500",
                        activeIndex === i - 1 ? "bg-indigo-500 w-3" : "bg-slate-300 dark:bg-slate-700"
                    )} />
                ))}
            </div>
        </div>
    );
}
