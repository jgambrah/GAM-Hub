'use client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateApplicationCard } from '@/components/settings/CandidateApplicationCard';
import VendorMomoSettings from '@/components/vendor/VendorMomoSettings';

export default function SettingsPage() {
  const { user, isUserLoading } = useAuth();
  const { toast } = useToast();

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
        title: "Settings Saved",
        description: "Your profile information has been updated.",
    })
  };

  if (isUserLoading || !user) {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="space-y-2">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
  }

  const isVendor = user.role === 'vendor';

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-20">
        <div className="space-y-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
      
      <form onSubmit={handleSaveChanges}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>This is how others will see you on the site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={user.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button>Save Changes</Button>
          </CardFooter>
        </Card>
      </form>

      {isVendor && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <VendorMomoSettings vendorData={user} />
        </div>
      )}

      {!isVendor && <CandidateApplicationCard />}
      
    </div>
  );
}
