'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Hash, Zap } from 'lucide-react';
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
        { label: 'Level 400 Stress', value: 'stress' },
        { label: '#Matriculation2026', value: '#matriculation' },
        { label: 'Hostel Payouts', value: 'hostel' },
        { label: 'Night Market Vibes', value: 'night market' },
        { label: '#SRC_Elections', value: '#elections' },
        { label: 'Liaison AI Guide', value: 'ai' }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % trends.length);
        }, 3500);
        return () => clearInterval(interval);
    }, [trends.length]);

    return (
        <div className="flex items-center gap-4 px-6 overflow-hidden">
            <div className="flex items-center gap-2 text-blue-600 flex-shrink-0">
                <TrendingUp size={14} className="animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-widest">Hot Vibrations:</span>
            </div>
            
            <div className="relative h-8 flex-1">
                {trends.map((trend, idx) => (
                    <button
                        key={trend.label}
                        onClick={() => onSelect(trend.value)}
                        className={cn(
                            "absolute inset-0 flex items-center gap-2 transition-all duration-700 transform",
                            idx === activeIndex 
                                ? "opacity-100 translate-y-0" 
                                : "opacity-0 translate-y-4 pointer-events-none"
                        )}
                    >
                        <div className="bg-white border border-slate-100 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 hover:border-blue-500 transition-colors">
                            {trend.value.startsWith('#') ? <Hash size={10} className="text-blue-500" /> : <Zap size={10} className="text-amber-500 fill-amber-500" />}
                            <span className="text-xs font-bold text-slate-700">{trend.label}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
