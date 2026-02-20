'use client';

import { useMemo } from 'react';
import { Users, Building, UserCheck, DollarSign, TrendingUp, Link as LinkIcon, Shuffle } from 'lucide-react';
import { StatsCard } from './stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { User, Order, Campus, Connection } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import LiaisonRevenue from '../admin/LiaisonRevenue';

export default function AdminDashboard() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // Data Fetching
    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
    const ordersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders')) : null, [firestore]);
    const campusesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'campuses')) : null, [firestore]);
    const connectionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'connections')) : null, [firestore]);
    

    const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);
    const { data: campuses, isLoading: isLoadingCampuses } = useCollection<Campus>(campusesQuery);
    const { data: connections, isLoading: isLoadingConnections } = useCollection<Connection>(connectionsQuery);
    
    const isLoading = isLoadingUsers || isLoadingOrders || isLoadingCampuses || isLoadingConnections;

    // Data Aggregation
    const {
        activeStudents,
        activeCampuses,
        pendingVendors,
        topCampuses,
        totalLinkUps,
        interCampusLinkUps,
        totalOrders
    } = useMemo(() => {
        if (!users || !orders || !campuses || !connections) {
            return {
                activeStudents: 0, activeCampuses: 0, pendingVendors: [],
                topCampuses: [], totalLinkUps: 0, interCampusLinkUps: 0, totalOrders: 0
            };
        }

        const activeStudents = users.filter(u => u.role === 'student').length;
        
        const activeCampuses = campuses.length;
        const pendingVendors = users.filter(u => u.role === 'vendor' && !u.isVerified);

        const salesByCampus = orders.reduce((acc, order) => {
            acc[order.campusId] = (acc[order.campusId] || 0) + order.amount;
            return acc;
        }, {} as Record<string, number>);

        const topCampusesData = Object.entries(salesByCampus)
            .map(([campusId, totalSales]) => ({
                campusId,
                name: campuses.find(c => c.id === campusId)?.name || campusId,
                acronym: campuses.find(c => c.id === campusId)?.acronym || campusId.toUpperCase(),
                totalSales,
            }))
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5);
        
        const totalLinkUps = connections.length;
        const interCampusLinkUps = connections.filter(c => c.isInterCampus).length;
        const totalOrders = orders.filter(o => o.status !== 'pending').length;
        
        return { activeStudents, activeCampuses, pendingVendors, topCampuses: topCampusesData, totalLinkUps, interCampusLinkUps, totalOrders };

    }, [users, orders, campuses, connections]);

    // Vendor Approval Logic
    const handleApprove = (vendor: User) => {
        if (!firestore) return;
        const vendorRef = doc(firestore, 'users', vendor.id);
        updateDocumentNonBlocking(vendorRef, { isVerified: true });
        toast({ title: "Vendor approved", description: `${vendor.name} has been verified.` });
    };

    const handleReject = (vendor: User) => {
        if (!firestore) return;
        if (confirm(`Are you sure you want to reject and delete ${vendor.name}? This cannot be undone.`)) {
            const vendorRef = doc(firestore, 'users', vendor.id);
            deleteDocumentNonBlocking(vendorRef);
            toast({ title: "Vendor rejected", description: `${vendor.name}'s application has been removed.`, variant: "destructive" });
        }
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "GHS" }).format(amount);
    const interCampusPercentage = totalLinkUps > 0 ? Math.round((interCampusLinkUps / totalLinkUps) * 100) : 0;

  return (
    <div className="space-y-8">
      <h1 className="font-headline text-3xl font-bold tracking-tight">National Command Center</h1>
      
      <LiaisonRevenue />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard title="Active Students" value={isLoading ? <Skeleton className="h-8 w-1/2" /> : activeStudents.toLocaleString()} icon={Users} />
        <StatsCard title="Active Campuses" value={isLoading ? <Skeleton className="h-8 w-1/2" /> : activeCampuses} icon={Building} />
        <StatsCard title="Pending Vendors" value={isLoading ? <Skeleton className="h-8 w-1/2" /> : pendingVendors.length} icon={UserCheck} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Vibe vs. Buy</CardTitle>
                    <CardDescription>Comparing social engagement with market transactions.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-6 text-center">
                        <LinkIcon className="h-8 w-8 text-primary" />
                        <p className="text-sm font-medium text-muted-foreground">Total Link-Ups</p>
                        <div className="text-3xl font-bold">{isLoading ? <Skeleton className="h-8 w-20" /> : totalLinkUps.toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-6 text-center">
                        <DollarSign className="h-8 w-8 text-green-600" />
                        <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                        <div className="text-3xl font-bold">{isLoading ? <Skeleton className="h-8 w-20" /> : totalOrders.toLocaleString()}</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5" /> Inter-Campus Unity</CardTitle>
                    <CardDescription>Percentage of connections between different campuses.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
                     {isLoading ? (
                         <div className="space-y-4 w-full">
                            <Skeleton className="h-12 w-1/2 mx-auto" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-4 w-3/4 mx-auto" />
                         </div>
                     ) : (
                        <>
                            <div className="flex w-full items-baseline justify-center gap-2">
                                <p className="text-5xl font-bold tracking-tight">{interCampusPercentage}</p>
                                <p className="text-2xl text-muted-foreground">%</p>
                            </div>
                            <Progress value={interCampusPercentage} className="h-3 w-full" />
                            <p className="text-sm text-muted-foreground">{interCampusLinkUps.toLocaleString()} of {totalLinkUps.toLocaleString()} connections are inter-campus.</p>
                        </>
                     )}
                </CardContent>
            </Card>
        </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Top 5 Campuses</CardTitle>
                <CardDescription>By total sales volume across the platform.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : topCampuses.length > 0 ? (
                    <ul className="space-y-2">
                        {topCampuses.map((campus, index) => (
                            <li key={campus.campusId} className="flex items-center justify-between rounded-md border p-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-muted-foreground w-4">{index + 1}.</span>
                                    <p className="font-medium">{campus.name} <span className="text-muted-foreground">({campus.acronym})</span></p>
                                </div>
                                <Badge variant="secondary">{formatCurrency(campus.totalSales)}</Badge>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No sales data available yet.</p>
                )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Vendor Approvals</CardTitle>
            <CardDescription>Review and approve new vendor registrations.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                         <div key={i} className="flex items-center justify-between space-x-4 rounded-md border p-4">
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            </div>
                            <Skeleton className="h-9 w-24" />
                        </div>
                    ))}
                 </div>
            ) : pendingVendors.length > 0 ? (
                 <div className="space-y-4">
                    {pendingVendors.map(vendor => (
                        <div key={vendor.id} className="flex items-center justify-between space-x-4 rounded-md border p-4">
                            <div className="flex items-center space-x-4">
                                <Avatar>
                                    <AvatarImage src={vendor.avatarUrl} />
                                    <AvatarFallback>{vendor.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium leading-none">{vendor.name}</p>
                                    <p className="text-sm text-muted-foreground">{vendor.email}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleApprove(vendor)}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(vendor)}>Reject</Button>
                            </div>
                        </div>
                    ))}
                 </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No pending vendor approvals.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
