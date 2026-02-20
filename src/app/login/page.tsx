import { FlameKindling } from 'lucide-react';
import { AuthForm } from '@/components/auth/auth-form';
import Image from 'next/image';
import { FirebaseClientProvider } from '@/firebase';

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="relative grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-lg border shadow-lg md:grid-cols-2">
          <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r md:flex">
            <Image
              src="https://picsum.photos/seed/login/1000/1200"
              alt="University campus"
              fill
              className="object-cover"
              data-ai-hint="university campus"
            />
            <div className="absolute inset-0 bg-primary/80" />
            <div className="relative z-20 flex items-center text-2xl font-medium font-headline">
              <FlameKindling className="mr-2 h-8 w-8" />
              GAM Hub
            </div>
            <div className="relative z-20 mt-auto">
              <blockquote className="space-y-2">
                <p className="text-lg">
                  &ldquo;Your one-stop platform for campus life in Ghana. Shop, socialize, and succeed.&rdquo;
                </p>
                <footer className="text-sm">Connect & Thrive</footer>
              </blockquote>
            </div>
          </div>
          <div className="flex items-center justify-center p-8">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="font-headline text-3xl font-semibold tracking-tight">
                  GAM Hub Access
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to continue
                </p>
              </div>
              <AuthForm />
              <p className="px-8 text-center text-xs text-muted-foreground">
                By clicking continue, you agree to our{' '}
                <a
                  href="/terms"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </FirebaseClientProvider>
  );
}
