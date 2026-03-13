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
import { collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { validateVideo } from '@/lib/video-utils';

const productSchema = z.object({
  name: z.string().min(3, 'Product/Service name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  category: z.string().min(2, 'Category is required.'),
  targetAudience: z.enum(['all', 'student', 'staff']),
  tagsInput: z.string().optional(), // For internal use
  imageHint: z.string().optional(),
  videoUrl: z.string().optional().or(z.literal('')),
  // Physical Fields
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // Financial Fields
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
  
  // Media State
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [videoPreview, setVideoPreview] = React.useState<string | null>(null);
  const [multimediaTab, setMultimediaTab] = React.useState<'none' | 'youtube' | 'upload'>('none');

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      stock: 1,
      category: 'General',
      tagsInput: '',
      imageHint: '',
      targetAudience: 'all',
      videoUrl: '',
      interestRate: '',
      actionLabel: 'Apply Now',
    },
  });

  const category = form.watch('category');
  const ytUrl = form.watch('videoUrl');
  const isFinancial = ['Bank', 'Insurance', 'Loans', 'Investments'].includes(category);
  const isYoutubeDetected = ytUrl && (ytUrl.includes('youtube.com') || ytUrl.includes('youtu.be'));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 🛡️ INFRASTRUCTURE: Startup-Safe Validation
      try {
        await validateVideo(file);
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Video Rejected', description: err.message });
        e.target.value = '';
      }
    }
  };

  async function onSubmit(data: ProductFormValues) {
    if (!firestore || !storage || !user) return;
    
    if (!user.campusId) {
      toast({ variant: 'destructive', title: 'Missing Campus ID', description: 'Vendor profile incomplete.' });
      return;
    }

    if (!imageFile) {
        toast({ variant: 'destructive', title: 'Image Required', description: 'Please upload a primary visual.' });
        return;
    }

    setIsLoading(true);

    try {
        // 1. Upload Primary Image
        const imgRef = ref(storage, `products/${user.campusId}/images/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imgRef, imageFile);
        const imageUrl = await getDownloadURL(imgRef);

        // 2. Handle Multimedia
        let nativeVideoUrl = null;
        if (multimediaTab === 'upload' && videoFile) {
            const vidRef = ref(storage, `product_videos/${user.campusId}/${Date.now()}_${videoFile.name}`);
            await uploadBytes(vidRef, videoFile);
            nativeVideoUrl = await getDownloadURL(vidRef);
        }

        // 3. Process Tags
        const tags = data.tagsInput 
            ? data.tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
            : [];

        const newProduct = {
          ...data,
          productType: isFinancial ? 'service' : 'physical',
          price: isFinancial ? 0 : (data.price || 0),
          stock: isFinancial ? 0 : (data.stock || 0),
          interestRate: isFinancial ? data.interestRate : null,
          actionLabel: isFinancial ? data.actionLabel : null,
          tags: tags,
          salesCount: 0,
          viewCount: 0,
          rating: 5.0,
          vendorId: user.id,
          vendorName: user.name || "Verified Vendor",
          campusId: user.campusId,
          campusAcronym: campus?.acronym || user.campusId.toUpperCase() || "GH",
          imageUrl: imageUrl,
          videoUrl: multimediaTab === 'youtube' && isYoutubeDetected ? data.videoUrl : null,
          nativeVideoUrl: nativeVideoUrl,
          imageHint: data.imageHint || data.category,
          createdAt: serverTimestamp(),
        };

        const productsRef = collection(firestore, 'products');
        await addDocumentNonBlocking(productsRef, newProduct);

        toast({
          title: 'Listing Launched!',
          description: `${data.name} is now live in the Yard with recommendation metadata.`,
        });
        
        setOpen(false);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Liaison Error', description: 'Could not push listing to network.' });
    } finally {
        setIsLoading(false);
    }
  }
  
  React.useEffect(() => {
    if (!open) {
        form.reset();
        setImageFile(null);
        setVideoFile(null);
        setPreviewUrl(null);
        setVideoPreview(null);
        setMultimediaTab('none');
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Smart Listing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90vh] p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 border-b bg-muted/20 flex-shrink-0">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl shadow-inner ${isFinancial ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                  {isFinancial ? <Landmark size={28}/> : <ShoppingBag size={28}/>}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black">Smart Market Listing</DialogTitle>
                  <DialogDescription className="font-medium text-muted-foreground">Add metadata to enable personalized campus recommendations.</DialogDescription>
                </div>
            </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
            <Form {...form}>
                <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    
                    {/* LEFT SIDE: MULTIMEDIA SUITE */}
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Primary visual</label>
                            <div className="relative aspect-square w-full rounded-[2.5rem] border-4 border-muted-foreground/10 bg-muted/30 flex flex-col items-center justify-center overflow-hidden group transition-all">
                                {previewUrl ? (
                                    <>
                                      <Image src={previewUrl} layout="fill" className="object-cover" alt="Preview" />
                                      <Button type="button" variant="destructive" size="icon" onClick={() => {setPreviewUrl(null); setImageFile(null);}} className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-lg border-2 border-white"><X size={20} /></Button>
                                    </>
                                ) : (
                                    <Label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-4 text-muted-foreground hover:scale-105 transition-transform">
                                        <div className="p-6 bg-white dark:bg-card rounded-full shadow-sm"><Upload size={32} className="text-primary" /></div>
                                        <div className="text-center"><span className="text-sm font-black text-slate-600 block uppercase tracking-tight">Upload Product Photo</span></div>
                                        <Input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </Label>
                                )}
                            </div>
                        </div>

                        {/* PRODUCT MULTIMEDIA SECTION */}
                        <div className="p-6 bg-slate-50 dark:bg-muted/30 rounded-[2.5rem] border-2 border-primary/5 space-y-6">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Discovery Tags</label>
                                <Tag size={14} className="text-primary" />
                            </div>
                            <FormField control={form.control} name="tagsInput" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input placeholder="earbuds, bluetooth, student-deal" {...field} className="rounded-xl border-none bg-white dark:bg-slate-900 font-bold text-xs shadow-sm" />
                                    </FormControl>
                                    <p className="text-[9px] text-muted-foreground px-2 italic">Comma separated. Helps match your product to student video interests.</p>
                                </FormItem>
                            )}/>
                        </div>
                    </div>

                    {/* RIGHT SIDE: BUSINESS INFO */}
                    <div className="space-y-6">
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem> 
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Category</label>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted/50 border-none font-bold shadow-sm"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                              {['General', 'Electronics', 'Fashion', 'Bank', 'Insurance', 'Loans', 'Investments'].map(cat => (
                                <SelectItem key={cat} value={cat} className="rounded-xl py-3 px-4 font-bold text-sm">{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}/>

                      <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem> 
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Listing Title</label>
                            <FormControl><Input placeholder="e.g. MacBook Pro 2024" {...field} className="p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted/50 border-none font-bold text-lg shadow-sm" /></FormControl> 
                          </FormItem>
                      )}/>
                      
                      {!isFinancial ? (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="price" render={({ field }) => (
                              <FormItem> 
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Price (GHS)</label>
                                <FormControl><Input type="number" {...field} className="p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted/50 border-none font-black text-lg text-primary shadow-sm" /></FormControl> 
                              </FormItem>
                          )}/>
                          <FormField control={form.control} name="targetAudience" render={({ field }) => (
                            <FormItem> 
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Audience Scope</label>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted/50 border-none font-bold text-xs shadow-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-2xl shadow-xl border-none"><SelectItem value="all">Entire Yard</SelectItem><SelectItem value="student">Students Only</SelectItem><SelectItem value="staff">Staff Lounge</SelectItem></SelectContent>
                              </Select>
                            </FormItem>
                          )}/>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="interestRate" render={({ field }) => (
                              <FormItem> 
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Rate / Benefit</label>
                                <FormControl><Input placeholder="e.g. 5% APR" {...field} className="p-4 h-auto rounded-2xl bg-blue-50 text-blue-900 border-none font-black shadow-sm" /></FormControl> 
                              </FormItem>
                          )}/>
                          <FormField control={form.control} name="targetAudience" render={({ field }) => (
                            <FormItem> 
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Audience Scope</label>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="p-4 h-auto rounded-2xl bg-slate-50 dark:bg-muted/50 border-none font-bold text-xs shadow-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-2xl shadow-xl border-none"><SelectItem value="all">Entire Yard</SelectItem><SelectItem value="student">Students Only</SelectItem><SelectItem value="staff">Staff Lounge</SelectItem></SelectContent>
                              </Select>
                            </FormItem>
                          )}/>
                        </div>
                      )}

                      <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem> 
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Description</label>
                            <FormControl><Textarea placeholder="Share the specs, terms, and delivery vibes..." {...field} className="min-h-[120px] rounded-[2rem] bg-slate-50 dark:bg-muted/50 border-none font-medium leading-relaxed shadow-inner no-scrollbar" /></FormControl> 
                          </FormItem>
                      )}/>
                    </div>
                  </div>
                </form>
            </Form>
        </div>
        
        <DialogFooter className="p-8 border-t bg-muted/20 flex-shrink-0 items-center">
          <div className="flex-1 flex items-center gap-3 text-slate-400">
             <div className="p-2 bg-white dark:bg-card rounded-xl shadow-sm"><ShieldCheck size={18} className="text-primary"/></div>
             <span className="text-[10px] font-black uppercase tracking-widest">Liaison discovery Active</span>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold px-6">Cancel</Button>
            <Button type="submit" form="add-product-form" disabled={isLoading} className="rounded-xl px-10 h-14 font-black bg-slate-900 text-white shadow-2xl active:scale-95 transition-all">
                {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Package className="mr-2 h-5 w-5" />}
                Launch Smart Listing
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
