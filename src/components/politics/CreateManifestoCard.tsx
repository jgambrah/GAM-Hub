'use client';

import { useAuth } from '@/hooks/use-auth';
import ManifestoEditor from './ManifestoEditor';
import { Skeleton } from '../ui/skeleton';

export default function CreateManifestoCard() {
    const { user, isUserLoading, isCandidate } = useAuth();

    if (isUserLoading) {
        return <Skeleton className="h-96 w-full rounded-3xl" />;
    }

    if (!isCandidate || !user) {
        return null; // Don't show anything if user is not a candidate
    }

    return <ManifestoEditor userProfile={user} />;
}
