'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Campus, SpotlightItem } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Star, Trash2, Megaphone, Send, Gavel, Landmark, Building2, Link as LinkIcon, GraduationCap, Banknote, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';

const spotlightSchema = z.object({
  title: z.string().min(3, "Title is required."),
  type: z.enum(['vendor', 'student', 'vlog', 'event', 'announcement']),
  itemId: z.string().optional(),
  content: z.string().optional(),
  category: z.enum(['urgent', 'event', 'academic', 'general', 'finance', 'security', 'graduation']).optional(),
  sourceType: z.enum(['management', 'src', 'department']).optional(),
  isOfficial: z.boolean().default(false),
  campusId: z.string().default('all'),
  image: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  imageHint: z.string().optional(),
  attachmentUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  vibeColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color.").optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    if (data.type === 'announcement') {
        if (!data.content) {
            ctx.addIssue({ code: 'custom', message: 'Content is required for announcements.', path: ['content'] });
        }
        if (!data.category) {
            ctx.addIssue({ code: 'custom', message: 'Category is required for announcements.', path: ['category'] });
        }
        if (!data.sourceType) {
            ctx.addIssue({ code: 'custom', message: 'Source Type is required for announcements.', path: ['sourceType'] });
        }
    } else if (data.type !== 'vlog' && data.type !== 'event') {
        if (!data.itemId) {
            ctx.addIssue({ code: 'custom', message: 'Item ID is required for this spotlight type.', path: ['itemId'] });
        }
    }
});


type SpotlightFormValues = z.infer<typeof spotlightSchema>;

export function ManualSpotlightList() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const manualSpotlightQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'spotlight'), where('manualOverride', '==', true));
    }, [firestore]);

    const { data: manualSpotlights, isLoading } = useCollection<SpotlightItem>(manualSpotlightQuery);
    
    const handleDelete = (id: string) => {
        if (!firestore) return;
        if (confirm('Are you sure you want to delete this manual spotlight?')) {
            deleteDocumentNonBlocking(doc(firestore, 'spotlight', id));
            toast({ title: "Spotlight item removed." });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Spotlight Items</CardTitle>
                <CardDescription>These items were added manually and will not be overwritten by the algorithm.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Campus</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        ) : manualSpotlights && manualSpotlights.length > 0 ? (
                            manualSpotlights.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.title}</TableCell>
                                    <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
                                    <TableCell>{item.campusId === 'all' ? 'National' : item.campusId?.toUpperCase()}</TableCell>
                                    <TableCell>{item.isOfficial ? <Badge>Official</Badge> : <Badge variant="outline">Standard</Badge>}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No manual spotlight items found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export function SpotlightManager() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    
    const campusesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'campuses') : null, [firestore]);
    const { data: campuses } = useCollection<Campus>(campusesQuery);

    const form = useForm<SpotlightFormValues>({
        resolver: zodResolver(spotlightSchema),
        defaultValues: {
            title: '',
            itemId: '',
            type: 'announcement',
            isOfficial: true,
            campusId: 'all',
            vibeColor: '#DC2626',
            image: '',
            imageHint: '',
            content: '',
            category: 'general',
            sourceType: 'management',
            attachmentUrl: ''
        },
    });

    const selectedType = form.watch('type');

    async function onSubmit(values: SpotlightFormValues) {
        if (!firestore) return;
        setIsLoading(true);

        const newSpotlightData = {
            ...values,
            isOfficial: values.type === 'announcement' ? true : values.isOfficial,
            manualOverride: true,
            updatedAt: new Date().toISOString()
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'spotlight'), newSpotlightData);
            toast({ title: "Spotlight Published", description: `${values.title} is now live on the home screen.` });
            form.reset();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Error", description: "Could not publish spotlight." });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl">
                            <Megaphone size={24} />
                        </div>
                        <div>
                            <CardTitle>Liaison News Creator</CardTitle>
                            <CardDescription>Manually feature items or publish official announcements to the home screen.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title / Headline</FormLabel>
                                    <FormControl><Input placeholder="e.g., Matriculation Ceremony 2026" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem><FormLabel>Content Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="announcement">Official Announcement</SelectItem>
                                                <SelectItem value="event">Campus Event</SelectItem>
                                                <SelectItem value="vendor">Featured Vendor</SelectItem>
                                                <SelectItem value="student">Student Star</SelectItem>
                                                <SelectItem value="vlog">Trending Vlog</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    <FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="campusId" render={({ field }) => (
                                <FormItem><FormLabel>Campus Scope</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">National (All Campuses)</SelectItem>
                                            {campuses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                <FormMessage /></FormItem>
                            )}/>
                            </div>
                            
                            {selectedType === 'announcement' ? (
                                <div className="space-y-4">
                                    <FormField control={form.control} name="content" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Announcement Content</FormLabel>
                                            <FormControl><Textarea placeholder="All freshers are to gather at the Great Hall..." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="category" render={({ field }) => (
                                            <FormItem><FormLabel>Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="general">📢 General News</SelectItem>
                                                        <SelectItem value="urgent">⚠️ Urgent Alert</SelectItem>
                                                        <SelectItem value="academic">📚 Academic</SelectItem>
                                                        <SelectItem value="finance">💰 Finance & Fees</SelectItem>
                                                        <SelectItem value="security">🛡️ Security Notice</SelectItem>
                                                        <SelectItem value="graduation">🎓 Graduation</SelectItem>
                                                        <SelectItem value="event">🎉 Campus Event</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            <FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="sourceType" render={({ field }) => (
                                            <FormItem><FormLabel>Source</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a source"/></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="management"><div className="flex items-center gap-2"><Landmark size={14}/> The Registry (Management)</div></SelectItem>
                                                        <SelectItem value="src"><div className="flex items-center gap-2"><Gavel size={14}/> The Gavel (SRC)</div></SelectItem>
                                                        <SelectItem value="department"><div className="flex items-center gap-2"><Building2 size={14}/> Department Notice</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            <FormMessage /></FormItem>
                                        )}/>
                                    </div>
                                    <FormField control={form.control} name="attachmentUrl" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2"><LinkIcon size={14}/> Attachment URL (Optional)</FormLabel>
                                            <FormControl><Input placeholder="Link to official PDF or document" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                            ) : (
                                <FormField control={form.control} name="itemId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Target User / Post ID</FormLabel>
                                        <FormControl><Input placeholder="The ID of the user, post, or item to feature" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            )}

                             
                            {selectedType !== 'announcement' &&
                                <FormField control={form.control} name="isOfficial" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel>Official Spotlight</FormLabel>
                                            <FormDescription>Official items are pinned to the top and have a unique style.</FormDescription>
                                        </div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    </FormItem>
                                )}/>
                            }

                            {(form.watch('isOfficial') || selectedType === 'announcement') && (
                                <div className="space-y-4 p-4 border-l-4 border-primary bg-muted/50 rounded-r-lg">
                                    <h4 className="font-semibold text-sm">Styling Options</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="vibeColor" render={({ field }) => (
                                            <FormItem> <FormLabel>Card Color</FormLabel> <FormControl><Input type="color" className="p-1 h-10 w-full" {...field} /></FormControl> <FormMessage /> </FormItem>
                                        )}/>
                                        <FormField control={form.control} name="image" render={({ field }) => (
                                            <FormItem> <FormLabel>Image URL</FormLabel> <FormControl><Input placeholder="https://..." {...field} /></FormControl> <FormMessage /> </FormItem>
                                        )}/>
                                    </div>
                                     <FormField control={form.control} name="imageHint" render={({ field }) => (
                                            <FormItem> <FormLabel>Image Hint (for AI)</FormLabel> <FormControl><Input placeholder="e.g., student festival" {...field} /></FormControl> <FormMessage /> </FormItem>
                                    )}/>
                                </div>
                            )}
                            
                            <Button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Broadcast to Community
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <ManualSpotlightList />
        </div>
    );
}
