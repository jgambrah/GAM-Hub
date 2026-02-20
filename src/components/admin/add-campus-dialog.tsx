
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, useFirestore } from '@/firebase';
import { Loader2, PlusCircle, ShieldCheck } from 'lucide-react';
import { doc } from 'firebase/firestore';
import type { Campus } from '@/lib/types';

const campusSchema = z.object({
  name: z.string().min(3, 'Name is required.'),
  acronym: z.string().min(2, 'Acronym is required.'),
  location: z.string().min(2, 'Location is required.'),
  studentDomain: z.string().min(3, 'Student domain is required.').refine(d => d.includes('.'), 'Must be valid.'),
  staffDomain: z.string().min(3, 'Staff domain is required.').refine(d => d.includes('.'), 'Must be valid.'),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color.'),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color.'),
  category: z.enum(['Public', 'Technical', 'Private']),
});

type CampusFormValues = z.infer<typeof campusSchema>;

interface AddCampusDialogProps {
  campus?: Campus;
  children?: React.ReactNode;
}

export function AddCampusDialog({ campus, children }: AddCampusDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const isEditMode = !!campus;

  const form = useForm<CampusFormValues>({
    resolver: zodResolver(campusSchema),
    defaultValues: campus || {
      name: '',
      acronym: '',
      location: '',
      studentDomain: '',
      staffDomain: '',
      primaryColor: '#002147',
      secondaryColor: '#C8A870',
      category: 'Public',
    },
  });
  
  React.useEffect(() => {
    if (open && campus) {
        form.reset(campus);
    }
  }, [open, campus, form]);

  async function onSubmit(data: CampusFormValues) {
    if (!firestore) return;
    setIsLoading(true);
    
    const campusId = campus?.id || data.acronym.toLowerCase().replace(/\s+/g, '-');
    const campusRef = doc(firestore, 'campuses', campusId);

    // Clean domains to ensure auth gate works perfectly
    const cleanedData = {
        ...data,
        studentDomain: data.studentDomain.replace(/^@/, '').trim().toLowerCase(),
        staffDomain: data.staffDomain.replace(/^@/, '').trim().toLowerCase(),
    };

    const newCampusData: Campus = {
        id: campusId,
        ...cleanedData,
    }

    setDocumentNonBlocking(campusRef, newCampusData, { merge: true });

    setIsLoading(false);
    setOpen(false);
    toast({
      title: isEditMode ? 'Fortress Updated' : 'Gate Opened',
      description: `${data.name} domains are now active in the national network.`,
    });
  }

  const trigger = children ? (
    <DialogTrigger asChild>{children}</DialogTrigger>
    ) : (
    <DialogTrigger asChild>
        <Button className="rounded-xl font-bold bg-slate-900 text-white">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Campus
        </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[600px] rounded-[2.5rem]">
        <DialogHeader className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <DialogTitle className="text-2xl font-black">{isEditMode ? 'Modify Fortress' : 'Open a New Gate'}</DialogTitle>
          </div>
          <DialogDescription className="font-medium">
            Define the university domains. This controls who can enter the Yard as Student or Staff.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
            <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem> <FormLabel>Full Institution Name</FormLabel> <FormControl><Input placeholder="University of Ghana" {...field} className="rounded-xl" /></FormControl> <FormMessage /> </FormItem>
                 )}/>
                 <FormField control={form.control} name="acronym" render={({ field }) => (
                    <FormItem> <FormLabel>Acronym</FormLabel> <FormControl><Input placeholder="UG" {...field} className="rounded-xl font-black" /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            {/* DOMAIN COMMAND CENTER */}
            <div className="bg-slate-50 dark:bg-muted/30 p-6 rounded-[2rem] border-2 border-primary/10 space-y-4">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Gatekeeper Settings</p>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="studentDomain" render={({ field }) => (
                        <FormItem> 
                            <FormLabel className="text-xs">Student Email Domain</FormLabel> 
                            <FormControl><Input placeholder="st.ug.edu.gh" {...field} className="rounded-xl bg-white dark:bg-card border-none font-bold" /></FormControl> 
                            <FormDescription className="text-[10px]">Recognized as "Student"</FormDescription>
                            <FormMessage /> 
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="staffDomain" render={({ field }) => (
                        <FormItem> 
                            <FormLabel className="text-xs">Staff Email Domain</FormLabel> 
                            <FormControl><Input placeholder="ug.edu.gh" {...field} className="rounded-xl bg-white dark:bg-card border-none font-bold" /></FormControl> 
                            <FormDescription className="text-[10px]">Recognized as "Staff"</FormDescription>
                            <FormMessage /> 
                        </FormItem>
                    )}/>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem> <FormLabel>City / Location</FormLabel> <FormControl><Input {...field} className="rounded-xl" /></FormControl> <FormMessage /> </FormItem>
                )}/>
                <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Institution Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="Public">Public</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Private">Private</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="primaryColor" render={({ field }) => (
                    <FormItem> <FormLabel>Signature Color</FormLabel> <FormControl><Input type="color" className="p-1 h-12 w-full rounded-xl" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
                <FormField control={form.control} name="secondaryColor" render={({ field }) => (
                    <FormItem> <FormLabel>Accent Color</FormLabel> <FormControl><Input type="color" className="p-1 h-12 w-full rounded-xl" {...field} /></FormControl> <FormMessage /> </FormItem>
                )}/>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl px-8 bg-slate-900 text-white font-black active:scale-95 transition-all">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Update Fortress' : 'Open Gate'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
