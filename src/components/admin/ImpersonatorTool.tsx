'use client';

import React, { useState, useEffect } from 'react';
import { User, Store, ShieldAlert, Zap, Landmark, Users, Briefcase } from 'lucide-react';

// This is the list of perspectives the Liaison can take
const ROLES = [
  { id: 'admin', label: 'Super Admin', icon: ShieldAlert, color: 'bg-red-600' },
  { id: 'management', label: 'URO Portal', icon: Landmark, color: 'bg-slate-900' },
  { id: 'src', label: 'SRC Portal', icon: Users, color: 'bg-blue-600' },
  { id: 'vendor', label: 'Vendor View', icon: Store, color: 'bg-orange-600' },
  { id: 'staff', label: 'Staff Lounge', icon: Briefcase, color: 'bg-emerald-600' },
  { id: 'student', label: 'Student View', icon: User, color: 'bg-indigo-600' },
];

export default function ImpersonatorTool({ onRoleChange }: { onRoleChange: (role: string) => void }) {
  const [activeRole, setActiveRole] = useState('admin');

  // Load the last used test role from local storage so it persists across refreshes
  useEffect(() => {
    const saved = localStorage.getItem('gamhub_view_mode');
    if (saved) {
      setActiveRole(saved);
      onRoleChange(saved);
    }
  }, [onRoleChange]);

  const handleSwitch = (roleId: string) => {
    setActiveRole(roleId);
    localStorage.setItem('gamhub_view_mode', roleId);
    onRoleChange(roleId);
    // Force a minor refresh to reset components
    window.location.reload(); 
  };

  return (
    <div className="fixed bottom-4 left-4 z-[10000] flex flex-col gap-2 scale-90 origin-bottom-left">
      <div className="bg-card/80 backdrop-blur-xl border border-border p-2 rounded-3xl shadow-2xl flex gap-1">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => handleSwitch(role.id)}
              title={role.label}
              className={`p-3 rounded-2xl transition-all flex items-center gap-2 ${
                isActive 
                ? `${role.color} text-white shadow-lg scale-105` 
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={18} />
              {isActive && <span className="text-xs font-black uppercase tracking-widest">{role.label}</span>}
            </button>
          );
        })}
      </div>
      <div className="bg-foreground text-background py-1 px-4 rounded-full text-[10px] font-bold flex items-center gap-2 w-fit mx-auto">
        <Zap size={10} className="text-amber-400" />
        LIAISON HYPER-VIEW ACTIVE
      </div>
    </div>
  );
}
