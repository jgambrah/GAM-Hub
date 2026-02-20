'use client';

import * as React from 'react';
import type { Campus } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

interface CampusViewContextType {
  viewAsCampus: Campus | null;
  setViewAsCampus: (campus: Campus | null) => void;
}

const CampusViewContext = React.createContext<CampusViewContextType | undefined>(undefined);

export function CampusViewProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  // For admins, default to null (GAM Hub view). For others, this state is not used.
  const [viewAsCampus, setViewAsCampus] = React.useState<Campus | null>(null);

  // Memoize the value to prevent unnecessary re-renders of consumers
  const value = React.useMemo(() => {
    // Only provide state management for admins
    if (isAdmin) {
      return { viewAsCampus, setViewAsCampus };
    }
    // For non-admins, provide a static, non-functional value
    return { viewAsCampus: null, setViewAsCampus: () => {} };
  }, [isAdmin, viewAsCampus]);

  return (
    <CampusViewContext.Provider value={value}>
      {children}
    </CampusViewContext.Provider>
  );
}

export function useCampusView() {
  const context = React.useContext(CampusViewContext);
  if (context === undefined) {
    throw new Error('useCampusView must be used within a CampusViewProvider');
  }
  return context;
}
