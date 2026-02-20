'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { campuses } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

const signInSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const studentSignUpSchema = z.object({
  name: z.string().min(2, 'Full name is required.'),
  email: z.string().email('Invalid email address.').refine(
    (email) => {
      if (email === 'admin@gamhub.com') return true; // Admin bypass
      return email.toLowerCase().endsWith('.edu.gh');
    },
    'Please use a valid university email (Staff or Student).'
  ),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const vendorSignUpSchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  campusId: z.string().min(1, 'Please select a campus.'),
});

type SignInValues = z.infer<typeof signInSchema>;
type StudentSignUpValues = z.infer<typeof studentSignUpSchema>;
type VendorSignUpValues = z.infer<typeof vendorSignUpSchema>;

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const { auth, firestore } = useFirebase();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: 'admin@gamhub.com', password: 'password' },
  });

  const studentSignUpForm = useForm<StudentSignUpValues>({
    resolver: zodResolver(studentSignUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const vendorSignUpForm = useForm<VendorSignUpValues>({
    resolver: zodResolver(vendorSignUpSchema),
    defaultValues: { companyName: '', email: '', password: '', campusId: '' },
  });

  async function onSignInSubmit(data: SignInValues) {
    if (!auth) return;
    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      // ✅ THE CRITICAL LIAISON FIX:
      // Force discard old cached token and fetch fresh one with new claims
      // injected by injectClaimsOnSignIn. This MUST happen before we redirect.
      await credential.user.getIdToken(true);

      toast({ title: 'Login Successful', description: 'Redirecting to your dashboard...' });
      router.push('/dashboard');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onStudentSignUpSubmit(data: StudentSignUpValues) {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      const campus = campuses.find(c => 
        data.email.endsWith(`@st.${c.domain}`) || 
        data.email.endsWith(`@stu.${c.domain}`) || 
        data.email.endsWith(`@${c.domain}`)
      );
      const domain = data.email.split('@')[1];
      const isStudent = domain.includes('st.') || domain.includes('stu.');

      const newUser = {
        id: user.uid,
        name: data.name,
        email: data.email,
        role: data.email === 'admin@gamhub.com' ? 'admin' : (isStudent ? 'student' : 'staff'),
        campusId: data.email === 'admin@gamhub.com' ? 'ug' : (campus?.id || ''),
        avatarUrl: `https://picsum.photos/seed/${user.uid}/100/100`,
        isVerified: true,
        bio: `A new member of the GAM Hub community.`,
        interests: [],
        visibility: 'public',
      };
      
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, newUser);
      await sendEmailVerification(user);

      toast({ title: 'Verification Email Sent', description: 'Please check your university webmail to verify your account.' });
      studentSignUpForm.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message || 'Could not create your account.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function onVendorSignUpSubmit(data: VendorSignUpValues) {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;
        const userDocRef = doc(firestore, 'users', user.uid);
        const newUser = {
            id: user.uid, name: data.companyName, email: data.email,
            role: 'vendor', campusId: data.campusId, isVerified: false,
            onboardingStatus: 'needs_submission', avatarUrl: `https://picsum.photos/seed/${user.uid}/100/100`,
        };
        await setDoc(userDocRef, newUser);
        toast({ title: "Registration Submitted", description: "Your vendor account is pending admin approval." });
        vendorSignUpForm.reset();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Registration Failed", description: error.message || "Could not create vendor account." });
    } finally {
        setIsLoading(false);
    }
  }

  if (!isClient) {
    return (
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-1 h-10 p-1 bg-muted rounded-md">
                <Skeleton className="h-full w-full rounded-sm" />
                <Skeleton className="h-full w-full rounded-sm" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full mt-2" />
        </div>
    );
  }

  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>
      
      <TabsContent value="signin">
        <form onSubmit={signInForm.handleSubmit(onSignInSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" type="email" autoComplete="email" disabled={isLoading} {...signInForm.register('email')} />
              {signInForm.formState.errors.email && <p className="text-xs text-destructive">{signInForm.formState.errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input id="signin-password" type="password" disabled={isLoading} {...signInForm.register('password')} />
              {signInForm.formState.errors.password && <p className="text-xs text-destructive">{signInForm.formState.errors.password.message}</p>}
            </div>
            <Button disabled={isLoading} className="mt-2" type="submit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="signup">
        <Tabs defaultValue="student" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="student">Student / Staff</TabsTrigger>
                <TabsTrigger value="vendor">Vendor</TabsTrigger>
            </TabsList>
            <TabsContent value="student">
                <form onSubmit={studentSignUpForm.handleSubmit(onStudentSignUpSubmit)}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="signup-name">Full Name</Label>
                            <Input id="signup-name" disabled={isLoading} {...studentSignUpForm.register('name')} />
                            {studentSignUpForm.formState.errors.name && <p className="text-xs text-destructive">{studentSignUpForm.formState.errors.name.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="signup-email">University Email</Label>
                            <Input id="signup-email" placeholder="name@st.ug.edu.gh" type="email" disabled={isLoading} {...studentSignUpForm.register('email')} />
                            {studentSignUpForm.formState.errors.email && <p className="text-xs text-destructive">{studentSignUpForm.formState.errors.email.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="signup-password">Password</Label>
                            <Input id="signup-password" type="password" disabled={isLoading} {...studentSignUpForm.register('password')} />
                            {studentSignUpForm.formState.errors.password && <p className="text-xs text-destructive">{studentSignUpForm.formState.errors.password.message}</p>}
                        </div>
                        <Button disabled={isLoading} className="mt-2" type="submit">
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </div>
                </form>
            </TabsContent>
            <TabsContent value="vendor">
                <form onSubmit={vendorSignUpForm.handleSubmit(onVendorSignUpSubmit)}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-company">Company Name</Label>
                      <Input id="vendor-company" disabled={isLoading} {...vendorSignUpForm.register('companyName')} />
                      {vendorSignUpForm.formState.errors.companyName && <p className="text-xs text-destructive">{vendorSignUpForm.formState.errors.companyName.message}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-email">Business Email</Label>
                      <Input id="vendor-email" type="email" disabled={isLoading} {...vendorSignUpForm.register('email')} />
                      {vendorSignUpForm.formState.errors.email && <p className="text-xs text-destructive">{vendorSignUpForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-password">Password</Label>
                      <Input id="vendor-password" type="password" disabled={isLoading} {...vendorSignUpForm.register('password')} />
                      {vendorSignUpForm.formState.errors.password && <p className="text-xs text-destructive">{vendorSignUpForm.formState.errors.password.message}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-campus">Primary Campus</Label>
                      <Select onValueChange={(value) => vendorSignUpForm.setValue('campusId', value)} disabled={isLoading}>
                          <SelectTrigger id="vendor-campus"><SelectValue placeholder="Select a campus" /></SelectTrigger>
                          <SelectContent>
                              {campuses.map((campus) => (<SelectItem key={campus.id} value={campus.id}>{campus.name}</SelectItem>))}
                          </SelectContent>
                      </Select>
                      {vendorSignUpForm.formState.errors.campusId && <p className="text-xs text-destructive">{vendorSignUpForm.formState.errors.campusId.message}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">Vendor accounts require manual approval by an admin.</p>
                    <Button disabled={isLoading} className="mt-2" variant="secondary" type="submit">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Register as Vendor
                    </Button>
                  </div>
                </form>
            </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}
