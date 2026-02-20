'use client';
import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Order, Campus } from '@/lib/types';
import { campuses } from '@/lib/data';
import { OrdersTable } from '@/components/admin/orders-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

type CampusCategory = Campus['category'] | 'all';

export default function AdminOrdersPage() {
  const firestore = useFirestore();
  const [selectedCategory, setSelectedCategory] = React.useState<CampusCategory>('all');
  const [selectedCampus, setSelectedCampus] = React.useState<string>('all');
  const [filteredCampuses, setFilteredCampuses] = React.useState<Campus[]>(campuses);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    
    const ordersRef = collection(firestore, 'orders');

    // Build query based on filters
    if (selectedCampus !== 'all') {
      // Filter by specific campus
      return query(
        ordersRef,
        where('campusId', '==', selectedCampus),
        orderBy('createdAt', 'desc')
      );
    } else if (selectedCategory !== 'all') {
      // Filter by category
      const campusIdsForCategory = campuses
        .filter(c => c.category === selectedCategory)
        .map(c => c.id);
      
      if (campusIdsForCategory.length > 0) {
        // Firestore 'in' operator supports up to 10 values
        if (campusIdsForCategory.length <= 10) {
          return query(
            ordersRef,
            where('campusId', 'in', campusIdsForCategory),
            orderBy('createdAt', 'desc')
          );
        } else {
          // If more than 10 campuses, just get all orders and filter client-side
          return query(ordersRef, orderBy('createdAt', 'desc'));
        }
      } else {
        // No campuses match - return null to show empty state
        return null;
      }
    }

    // Get all orders (admin can see all)
    return query(ordersRef, orderBy('createdAt', 'desc'));
  }, [firestore, selectedCategory, selectedCampus]);

  const { data: ordersData, isLoading } = useCollection<Order>(ordersQuery);

  // Apply client-side filtering if needed (when category has >10 campuses)
  const orders = React.useMemo(() => {
    if (!ordersData) return [];
    
    if (selectedCategory !== 'all' && selectedCampus === 'all') {
      const campusIdsForCategory = campuses
        .filter(c => c.category === selectedCategory)
        .map(c => c.id);
      
      if (campusIdsForCategory.length > 10) {
        // Client-side filter for large category sets
        return ordersData.filter(order => campusIdsForCategory.includes(order.campusId));
      }
    }
    
    return ordersData;
  }, [ordersData, selectedCategory, selectedCampus]);

  const handleCategoryChange = (category: CampusCategory) => {
    setSelectedCategory(category);
    setSelectedCampus('all');
    if (category === 'all') {
      setFilteredCampuses(campuses);
    } else {
      setFilteredCampuses(campuses.filter(c => c.category === category));
    }
  };

  const uniqueCategories = ['all', ...Array.from(new Set(campuses.map(c => c.category)))];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Global Orders</h1>
        <p className="text-muted-foreground">View and manage orders from all campuses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter orders by university category or a specific campus.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
            {isClient ? (
              <>
                <div className="grid gap-2 w-full sm:w-1/2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={selectedCategory} onValueChange={(value: CampusCategory) => handleCategoryChange(value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 w-full sm:w-1/2">
                    <label className="text-sm font-medium">Campus</label>
                    <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={selectedCategory === 'all' && selectedCampus === 'all' && filteredCampuses.length === campuses.length}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Campus" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Campuses</SelectItem>
                            {filteredCampuses.map(campus => (
                                <SelectItem key={campus.id} value={campus.id}>{campus.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2 w-full sm:w-1/2">
                  <label className="text-sm font-medium">Category</label>
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-2 w-full sm:w-1/2">
                  <label className="text-sm font-medium">Campus</label>
                  <Skeleton className="h-10 w-full" />
                </div>
              </>
            )}
        </CardContent>
      </Card>
      
      <OrdersTable data={orders} isLoading={isLoading} />
    </div>
  );
}
