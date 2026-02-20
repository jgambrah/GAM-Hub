'use client';

import { useAuth } from '@/hooks/use-auth';
import { useCampusView } from '@/hooks/use-campus-view';
import { useEffect, useState } from 'react';
import type { Campus } from '@/lib/types';

// Helper function to convert HEX to HSL string. HSL is what tailwind config expects.
function hexToHsl(hex: string): string {
    if (!hex || !hex.startsWith('#')) {
        return '';
    }

    hex = hex.slice(1);

    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
}


export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const { campus: userCampus, isAdmin } = useAuth();
  const { viewAsCampus } = useCampusView();
  
  const [defaultTheme, setDefaultTheme] = useState({ primary: '', accent: ''});

  useEffect(() => {
    // Capture default theme values from CSS on initial mount
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    setDefaultTheme({
      primary: computedStyle.getPropertyValue('--primary').trim(),
      accent: computedStyle.getPropertyValue('--accent').trim(),
    });
  }, []);

  useEffect(() => {
    let themeCampus: Campus | null = null;
    
    if (isAdmin) {
        // For admins, use the "view as" campus, which can be null for global view
        themeCampus = viewAsCampus;
    } else {
        // For other users, just use their assigned campus.
        themeCampus = userCampus;
    }

    const root = document.documentElement;

    if (themeCampus && themeCampus.primaryColor && themeCampus.secondaryColor) {
        const primaryHsl = hexToHsl(themeCampus.primaryColor);
        const accentHsl = hexToHsl(themeCampus.secondaryColor);

        if(primaryHsl) root.style.setProperty('--primary', primaryHsl);
        if(accentHsl) root.style.setProperty('--accent', accentHsl);
    } else {
        // Reset to default theme if no specific campus is selected or colors are missing
        if (defaultTheme.primary) root.style.setProperty('--primary', defaultTheme.primary);
        if (defaultTheme.accent) root.style.setProperty('--accent', defaultTheme.accent);
    }

  }, [userCampus, isAdmin, viewAsCampus, defaultTheme]);

  return <>{children}</>;
}
