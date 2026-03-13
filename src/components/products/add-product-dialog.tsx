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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { addDocumentNonBlocking, useFirebase } from '@/firebase';
import { Loader2, PlusCircle, Upload, X, ShieldCheck, Package, Video, Youtube, CheckCircle2, ShoppingBag, Landmark, Tag } from 'lucide-react';
import { collection, serverTimestamp, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { validateVideo, generateFileHash } from '@/lib/video-utils';

const productSchema = z.object({
  name: z.string().min(3, 'Name is too short.'),
  description: z.string().min(10, 'Description is too short.'),
  category: z.string().min(2, 'Category required.'),
  targetAudience: z.enum(['all', 'student', 'staff']),
  tagsInput: z.string().optional(),
  imageHint: z.string().optional(),
  videoUrl: z.string().optional().or(z.literal('')),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  interestRate: z.string().optional(),
  actionLabel: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function AddProductDialog() {
  const { user, campus } = useAuth();
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [videoPreview, setVideoPreview] = React.useState<string | null>(null);
  const [multimediaTab, setMultimediaTab] = React.useState<'none' | 'youtube' | 'upload'>('none');

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', description: '', price: 0, stock: 1, category: 'General',
      tagsInput: '', imageHint: '', targetAudience: 'all', videoUrl: '',
      interestRate: '', actionLabel: 'Apply Now',
    },
  });

  const category = form.watch('category');
  const isFinancial = ['Bank', 'Insurance', 'Loans', 'Investments'].includes(category);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await validateVideo(file);
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Rejected', description: err.message });
      }
    }
  };

  async function onSubmit(data: ProductFormValues) {
    if (!firestore || !storage || !user || !user.campusId || !imageFile) return;

    setIsLoading(true);
    try {
        const imgRef = ref(storage, `products/${user.campusId}/images/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imgRef, imageFile);
        const imageUrl = await getDownloadURL(imgRef);

        let nativeVideoUrl = null;
        let videoHash = null;

        if (multimediaTab === 'upload' && videoFile) {
            // 🧬 DEDUPLICATION HANDSHAKE
            videoHash = await generateFileHash(videoFile);
            const hashRef = doc(firestore, 'video_hashes', videoHash);
            const hashSnap = await getDoc(hashRef);

            if (hashSnap.exists()) {
                const existing = hashSnap.data();
                nativeVideoUrl = existing.mediaUrl;
                
                // Increment uploads count in the registry
                await setDoc(hashRef, { uploads: increment(1) }, { merge: true });
                
                toast({ title: "Smart Reuse!", description: "Video already exists in Yard repository. Bypassing upload." });
            } else {
                const vidPath = `product_videos/${user.campusId}/${Date.now()}_${videoFile.name}`;
                const vidRef = ref(storage, vidPath);
                await uploadBytes(vidRef, videoFile, { customMetadata: { hash: videoHash } });
                nativeVideoUrl = await getDownloadURL(vidRef);
                
                // Create pending registry entry
                await setDoc(hashRef, {
                    mediaUrl: nativeVideoUrl,
                    storagePath: vidPath,
                    storageTier: 'hot',
                    processed: false,
                    uploads: 1,
                    updatedAt: serverTimestamp()
                });
            }
        }

        const tags = data.tagsInput ? data.tagsInput.split(',').map(t => t.trim().toLowerCase()) : [];

        const newProduct = {
          ...data,
          productType: isFinancial ? 'service' : 'physical',
          price: isFinancial ? 0 : (data.price || 0),
          stock: isFinancial ? 0 : (data.stock || 0),
          tags,
          vendorId: user.id, vendorName: user.name || "Vendor",
          campusId: user.campusId, campusAcronym: campus?.acronym || "GH",
          imageUrl, nativeVideoUrl, videoHash,
          createdAt: serverTimestamp(),
        };

        await addDocumentNonBlocking(collection(firestore, 'products'), newProduct);
        toast({ title: 'Listing Launched!' });
        setOpen(false);
    } catch (err) { toast({ variant: 'destructive', title: 'Liaison Error' }); }
    finally { setIsLoading(false); }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-black bg-slate-900 text-white shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Listing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 border-b bg-muted/20">
            <DialogTitle className="text-2xl font-black">Smart Market Listing</DialogTitle>
            <DialogDescription>Deduplication & AI Indexing Active 🧬</DialogDescription>
        </DialogHeader>
        <div className="p-8 overflow-y-auto max-h-[70vh] no-scrollbar">
            <Form {...form}>
                <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="relative aspect-square rounded-[2.5rem] bg-muted/30 flex flex-col items-center justify-center overflow-hidden border-4 border-dashed border-muted-foreground/10">
                            {previewUrl ? <Image src={previewUrl} layout="fill" className="object-cover" alt="" /> : 
                            <Label className="cursor-pointer flex flex-col items-center gap-2"><Upload size={32}/><span className="text-xs font-black uppercase">Photo Required</span><Input type="file" className="hidden" accept="image/*" onChange={handleImageChange}/></Label>}
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-muted/30 rounded-[2rem] border-2 border-primary/5">
                            <label className="text-[10px] font-black uppercase mb-2 block">Deduplicated Video Upload</label>
                            <Input type="file" accept="video/*" onChange={handleVideoChange} onClick={() => setMultimediaTab('upload')} />
                            {videoPreview && <video src={videoPreview} className="mt-2 rounded-xl aspect-video bg-black" muted />}
                        </div>
                    </div>
                    <div className="space-y-6">
                      <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. MacBook Pro" {...field} className="rounded-xl"/></FormControl></FormItem>
                      )}/>
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger></FormControl><SelectContent>{['General', 'Electronics', 'Fashion', 'Bank', 'Insurance', 'Loans'].map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></FormItem>
                      )}/>
                      {!isFinancial && <FormField control={form.control} name="price" render={({ field }) => (
                          <FormItem><FormLabel>Price (GHS)</FormLabel><FormControl><Input type="number" {...field} className="rounded-xl font-bold"/></FormControl></FormItem>
                      )}/>}
                      <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="rounded-xl h-32"/></FormControl></FormItem>
                      )}/>
                    </div>
                  </div>
                </form>
            </Form>
        </div>
        <DialogFooter className="p-8 border-t bg-muted/20">
          <Button type="submit" form="add-product-form" disabled={isLoading} className="rounded-xl px-10 h-14 font-black bg-slate-900 text-white shadow-2xl">
            {isLoading ? <Loader2 className="animate-spin" /> : "Launch Smart Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
