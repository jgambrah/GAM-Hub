'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface RegistryViewerModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  fileUrl: string;
  title: string;
}

export function RegistryViewerModal({ isOpen, setIsOpen, fileUrl, title }: RegistryViewerModalProps) {
  const isPDF = fileUrl?.toLowerCase().includes('.pdf');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-4xl h-[90vh] p-0 flex flex-col rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl font-black truncate pr-8">{title}</DialogTitle>
            <div className="flex items-center gap-2 mr-8">
                <Button variant="outline" size="sm" className="rounded-xl font-bold h-9" onClick={() => window.open(fileUrl, '_blank')}>
                    <ExternalLink size={14} className="mr-2" /> Open Original
                </Button>
                <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="rounded-xl font-black bg-slate-900 text-white h-9">
                        <Download size={14} className="mr-2" /> Download
                    </Button>
                </a>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
            {isPDF ? (
                <iframe 
                    src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                    className="w-full h-full border-none"
                    title="Official Circular PDF"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center p-10">
                    <img 
                        src={fileUrl} 
                        alt={title} 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border-4 border-white dark:border-slate-800" 
                    />
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
