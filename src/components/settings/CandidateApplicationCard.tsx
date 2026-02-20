'use client';
import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gavel, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { CandidateApplication } from '@/lib/types';

function CandidateApplicationForm({ onFormSubmit }: { onFormSubmit: () => void }) {
    const { user } = useAuth();
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({ position: '', hall: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !formData.position || !formData.hall || !firestore || !storage || !user) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all fields and select your Student ID card.' });
            return;
        }
        setIsLoading(true);
        try {
            const storageRef = ref(storage, `candidate_ids/${user.id}/${file.name}`);
            await uploadBytes(storageRef, file);
            const idCardUrl = await getDownloadURL(storageRef);

            const appData = {
                userId: user.id,
                name: user.name,
                position: formData.position,
                campusId: user.campusId,
                hall: formData.hall,
                studentIdCardUrl: idCardUrl,
                status: 'pending',
                createdAt: new Date().toISOString(),
            };
            await addDocumentNonBlocking(collection(firestore, 'candidate_applications'), appData);
            toast({ title: "Application Submitted!", description: "Your candidacy application is pending Liaison approval." });
            onFormSubmit();
        } catch (error) {
            console.error("Application submission error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your application.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="position">Position Contesting For</Label>
                <Input id="position" placeholder="e.g., SRC President" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="hall">Hall of Affiliation</Label>
                <Input id="hall" placeholder="e.g., Unity Hall, Sarbah Hall" value={formData.hall} onChange={(e) => setFormData({ ...formData, hall: e.target.value })} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="id-card">Student ID Card</Label>
                <Input id="id-card" type="file" accept="image/*" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} required />
                <p className="text-xs text-muted-foreground">Please upload a clear picture of your Student ID card for verification.</p>
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gavel className="mr-2 h-4 w-4" />}
                    Submit Application
                </Button>
            </DialogFooter>
        </form>
    );
}


export function CandidateApplicationCard() {
    const { user } = useAuth();
    const { firestore } = useFirebase();
    const [open, setOpen] = useState(false);

    const applicationQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'candidate_applications'), where('userId', '==', user.id));
    }, [firestore, user]);

    const { data: applications, isLoading } = useCollection<CandidateApplication>(applicationQuery);
    
    // Find the most recent application status
    const latestApplication = applications?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const status = latestApplication?.status;

    if (!user || user.role !== 'student') {
        return null;
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <CardFooter className="pt-6">
                    <Button disabled variant="outline" className="w-full">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking Status...
                    </Button>
                </CardFooter>
            );
        }

        switch (status) {
            case 'pending':
                return (
                    <>
                        <CardDescription>Your application to become a candidate is currently under review by the Liaison.</CardDescription>
                        <CardFooter className="pt-6">
                            <Button disabled variant="outline" className="w-full">
                                <Clock className="mr-2 h-4 w-4" /> Pending Review
                            </Button>
                        </CardFooter>
                    </>
                );
            case 'approved':
                return (
                    <>
                        <CardDescription>Congratulations! Your application has been approved. You can now create your manifesto on the politics page.</CardDescription>
                        <CardFooter className="pt-6">
                            <Button disabled className="w-full bg-green-600 hover:bg-green-700">
                                <CheckCircle className="mr-2 h-4 w-4" /> Approved Candidate
                            </Button>
                        </CardFooter>
                    </>
                );
            case 'rejected':
                 return (
                    <>
                        <CardDescription>Your previous application was not approved. You may re-apply if you believe this was an error.</CardDescription>
                        <CardFooter className="pt-6">
                            <DialogTrigger asChild>
                                <Button className="w-full">
                                    <Gavel className="mr-2 h-4 w-4" /> Re-apply Now
                                </Button>
                            </DialogTrigger>
                        </CardFooter>
                    </>
                );
            default:
                return (
                    <>
                        <CardDescription>Run for an SRC position and share your vision with the entire campus.</CardDescription>
                        <CardFooter className="pt-6">
                             <DialogTrigger asChild>
                                <Button className="w-full">
                                    <Gavel className="mr-2 h-4 w-4" /> Apply to be a Candidate
                                </Button>
                            </DialogTrigger>
                        </CardFooter>
                    </>
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Card>
                <CardHeader>
                    <CardTitle>Campus Elections</CardTitle>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Candidacy Application</DialogTitle>
                    <DialogDescription>Fill out the form below to apply to run in the campus elections.</DialogDescription>
                </DialogHeader>
                <CandidateApplicationForm onFormSubmit={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
