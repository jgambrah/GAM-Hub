'use client';

import RegistryCreator from "@/components/admin/RegistryCreator";
import { ManualSpotlightList } from "@/components/admin/spotlight-manager";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = 'force-dynamic';

export default function AdminSpotlightPage() {
    const { user, isUserLoading } = useAuth();

    if (isUserLoading || !user) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-96 w-full max-w-3xl mx-auto" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <RegistryCreator userProfile={user} />
            <ManualSpotlightList />
        </div>
    );
}
