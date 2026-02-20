'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Campus } from '@/lib/types';

const pickupPointSchema = z.object({
  name: z.string().min(3, "Location name is required."),
  description: z.string().min(10, "A detailed description is required."),
  latitude: z.coerce.number().min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.'),
  longitude: z.coerce.number().min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.'),
});

type PickupPointFormValues = z.infer<typeof pickupPointSchema>;

interface AddPickupPointFormProps {
  campus: Campus;
}

export function AddPickupPointForm({ campus }: AddPickupPointFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<PickupPointFormValues>({
    resolver: zodResolver(pickupPointSchema),
    defaultValues: { name: '', description: '', latitude: 0, longitude: 0 },
  });

  async function onSubmit(data: PickupPointFormValues) {
    if (!firestore) return;
    setIsLoading(true);

    const newPointData = {
      ...data,
      campusId: campus.id,
      isOfficial: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    
    try {
        await addDocumentNonBlocking(collection(firestore, 'pickup_points'), newPointData);
        toast({
            title: "Safe Zone Added",
            description: `${data.name} has been added for ${campus.name}.`,
        });
        form.reset();
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add pickup point.' });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-2xl">
            <MapPin size={24} />
          </div>
          <div>
            <CardTitle>Add Safe Zone to {campus.name}</CardTitle>
            <CardDescription>Define a new verified meeting spot for this campus.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Republic Hall Gate" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Near the ATM, by the main road" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="latitude" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl><Input type="number" step="any" placeholder="e.g., 5.6506" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="longitude" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl><Input type="number" step="any" placeholder="e.g., -0.1974" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Verified Safe Zone
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}