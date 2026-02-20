'use client';

import * as React from 'react';
import { useFirebase, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { PickupPoint, Campus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface PickupPointsListProps {
    campus: Campus;
}

export function PickupPointsList({ campus }: PickupPointsListProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const pointsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pickup_points'), where('campusId', '==', campus.id));
    }, [firestore, campus]);

    const { data: pickupPoints, isLoading } = useCollection<PickupPoint>(pointsQuery);

    const handleDelete = (point: PickupPoint) => {
        if (!firestore) return;
        if (confirm(`Are you sure you want to delete the pickup point: ${point.name}?`)) {
            deleteDocumentNonBlocking(doc(firestore, 'pickup_points', point.id));
            toast({
                title: "Pickup Point Removed",
                description: `${point.name} has been deleted.`,
                variant: "destructive"
            });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Existing Safe Zones</CardTitle>
                <CardDescription>All designated pickup points for {campus.name}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Coordinates</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {isLoading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        ) : pickupPoints && pickupPoints.length > 0 ? (
                            pickupPoints.map(point => (
                                <TableRow key={point.id}>
                                    <TableCell className="font-medium">{point.name}</TableCell>
                                    <TableCell className="text-xs font-mono">{point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</TableCell>
                                    <TableCell><Badge variant={point.status === 'active' ? 'default' : 'secondary'}>{point.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(point)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">No pickup points found for this campus.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
