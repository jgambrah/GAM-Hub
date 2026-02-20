'use client';

import { CreateGroupCard } from "@/components/groups/create-group-card";
import { GroupsList } from "@/components/groups/groups-list";
import { DiscoverGroupsList } from "@/components/groups/discover-groups-list";

export default function GroupsPage() {
    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="space-y-2">
                <h1 className="font-headline text-4xl font-black tracking-tight text-foreground">Campus Communities</h1>
                <p className="text-muted-foreground font-medium text-lg">
                    Connect with peers, join study cells, or find others who share your vibes.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Creation Sidebar */}
                <div className="lg:col-span-1">
                    <CreateGroupCard />
                </div>
                
                {/* Active and Discoverable Communities */}
                <div className="lg:col-span-2">
                    <GroupsList />
                    <DiscoverGroupsList />
                </div>
            </div>
        </div>
    )
}
