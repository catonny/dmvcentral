
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatabaseZap, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ClientOnly } from "@/components/client-only";

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.01,35.638,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );

function LoginPageContent() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // If user is super admin, let them pass immediately
                if (user.email === 'ca.tonnyvarghese@gmail.com') {
                    router.push('/dashboard');
                    return;
                }

                // Final check to ensure only valid employees stay logged in
                const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
                const employeeSnapshot = await getDocs(employeeQuery);
                if (employeeSnapshot.empty) {
                    await auth.signOut();
                    setLoading(false);
                } else {
                    router.push('/dashboard');
                }
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);


    const handleGoogleSignIn = async () => {
        setIsSigningIn(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (!user.email) {
                throw new Error("Could not retrieve email from Google account.");
            }
            
            // Allow super admin to bypass employee check
            if (user.email === 'ca.tonnyvarghese@gmail.com') {
                // The onAuthStateChanged listener will handle the redirect.
                return;
            }

            // Check if user email exists in the employees collection
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);

            if (employeeSnapshot.empty) {
                // If not an employee, sign them out immediately and show an error
                await auth.signOut();
                toast({
                    title: "Access Denied",
                    description: "You are not authorized to access this application.",
                    variant: "destructive",
                });
            }
            // If they are an employee, the onAuthStateChanged listener will handle the redirect.
            
        } catch (error) {
            console.error("Error signing in with Google: ", error);
            toast({
                title: "Sign-in Failed",
                description: "Could not sign in with Google. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSigningIn(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center bg-gray-900">Loading...</div>;
    }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4 items-center gap-2">
            <h1 className="text-2xl font-bold text-white">DMV Central</h1>
          </div>
          <CardTitle className="text-2xl font-headline text-white">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
           <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSigningIn}>
                {isSigningIn ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                    </>
                ) : (
                    <>
                        <GoogleIcon />
                         Sign in with Google
                    </>
                )}
            </Button>
            <Alert>
              <DatabaseZap className="h-4 w-4" />
              <AlertTitle>First time setup?</AlertTitle>
              <AlertDescription>
                If this is your first time running the app, you need to seed the database.
                <Button variant="link" asChild className="p-0 h-auto ml-1">
                    <Link href="/seed">Click here to add initial data.</Link>
                </Button>
              </AlertDescription>
            </Alert>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <p className="w-full text-center text-sm text-muted-foreground">
            &copy; 2024 DMV Central. All rights reserved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function LoginPage() {
    return (
        <ClientOnly>
            <LoginPageContent />
        </ClientOnly>
    )
}
