'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Users, Lock, Globe } from 'lucide-react';

const groupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters."),
  type: z.enum(['class', 'department', 'social', 'staff-only']),
  isPrivate: z.boolean().default(true),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export function CreateGroupCard() {
  const { user } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      type: 'social',
      isPrivate: true,
    },
  });

  async function onSubmit(data: GroupFormValues) {
    if (!firestore || !user || !user.campusId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not create community: User campus information is missing.',
        });
        return;
    }
    setIsLoading(true);

    const newGroupData = {
      ...data,
      campusId: user.campusId,
      createdBy: user.id,
      members: [user.id],
      admins: [user.id],
      createdAt: new Date().toISOString(),
      description: `A new ${data.type} group for ${user.campusId.toUpperCase()}.`
    };

    try {
        await addDocumentNonBlocking(collection(firestore, 'groups'), newGroupData);
        toast({ title: 'Community Created!', description: `${data.name} is now live.` });
        form.reset();
    } catch (error) {
        console.error("Error creating group:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create community.' });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users /> Create a Community</CardTitle>
        <CardDescription>Start a new group for your class, department, or interests.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl><Input placeholder="e.g., CS Level 300" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Group Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="social">Social Group</SelectItem>
                                <SelectItem value="class">Class Group</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                                {user?.role === 'staff' && <SelectItem value="staff-only">Staff Association</SelectItem>}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="isPrivate" render={({ field }) => (
                     <FormItem className="space-y-3">
                        <FormLabel>Privacy</FormLabel>
                        <FormControl>
                            <div className="flex items-center space-x-2 rounded-lg border p-3">
                                {field.value ? <Lock size={16} /> : <Globe size={16}/>}
                                <span className="flex-1 font-medium">{field.value ? 'Private' : 'Public'}</span>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </div>
                        </FormControl>
                    </FormItem>
                )} />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Launch Community
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
