'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { User } from '@/lib/types';

type ViewMode = User['role'];

interface ViewContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isImpersonating: boolean;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('admin');

  useEffect(() => {
    if (isAdmin) {
      const saved = localStorage.getItem('gamhub_view_mode') as ViewMode;
      if (saved) {
        setViewMode(saved);
      }
    }
  }, [isAdmin]);

  const handleSetViewMode = (mode: ViewMode) => {
    if (isAdmin) {
      localStorage.setItem('gamhub_view_mode', mode);
      setViewMode(mode);
    }
  };

  // The effective role is either the admin's chosen viewMode or the user's actual role.
  const effectiveViewMode = isAdmin ? viewMode : (user?.role || 'student');

  return (
    <ViewContext.Provider
      value={{
        viewMode: effectiveViewMode,
        setViewMode: handleSetViewMode,
        isImpersonating: isAdmin && viewMode !== 'admin',
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
};
