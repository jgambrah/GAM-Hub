'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X } from 'lucide-react';

interface RegistryViewerModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  fileUrl: string;
  title: string;
}

/**
 * RegistryViewerModal Component
 * 
 * Implements "Focus Mode" for official directives.
 * Uses a high-compatibility PDF wrapper for seamless mobile viewing.
 */
export function RegistryViewerModal({ isOpen, setIsOpen, fileUrl, title }: RegistryViewerModalProps) {
  const isPDF = fileUrl?.toLowerCase().includes('.pdf');
  
  // Liaison Strategy: Google Docs Viewer wrapper handles mobile PDF rendering hurdles
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col gap-0 border-none rounded-[2.5rem] shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between space-y-0 flex-shrink-0">
          <div className="flex flex-col min-w-0">
            <DialogTitle className="text-lg font-black truncate max-w-[250px] sm:max-w-md">
              {title}
            </DialogTitle>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Official Registry Record</p>
          </div>
          
          <div className="flex items-center gap-2 mr-8">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/10 rounded-xl"
              onClick={() => window.open(fileUrl, '_blank')}
            >
              <ExternalLink size={18} className="mr-2" /> 
              <span className="hidden sm:inline">Original</span>
            </Button>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              download
              className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
              <Download size={18} className="text-white" />
            </a>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
          {isPDF ? (
            <iframe
              src={viewerUrl}
              className="w-full h-full border-none"
              title="Registry Viewer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="relative max-w-full max-h-full">
                <img 
                  src={fileUrl} 
                  alt={title} 
                  className="max-h-full max-w-full object-contain shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-2xl border-4 border-white dark:border-slate-800" 
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center flex-shrink-0">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">GAM Hub Security Protocol Active</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
