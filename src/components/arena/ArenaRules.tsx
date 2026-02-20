'use client';

import { ShieldAlert } from 'lucide-react';

export function ArenaRules() {
  return (
    <div className="mx-4 mb-8 p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-[2.5rem] flex items-start gap-4 dark:bg-amber-900/20 dark:border-amber-800">
      <div className="p-3 bg-amber-500 text-white rounded-2xl">
        <ShieldAlert size={24} />
      </div>
      <div>
        <h4 className="font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest text-xs">Liaison's Decree: Rules of the Yard</h4>
        <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
          The Arena is a <b>Battle of Ideas & Wit.</b> Throw shade at the systems, the hostels, or the grades—but <b>never insult the person.</b> Keep it viby, keep it funny, and may the best Campus win! ⚔️🇬🇭
        </p>
      </div>
    </div>
  );
}
