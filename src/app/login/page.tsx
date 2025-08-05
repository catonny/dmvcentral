
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { Loader2, Building } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ClientOnly } from "@/components/client-only";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.01,35.638,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );

function RoleSelectionDialog({ onSelectRole }: { onSelectRole: (role: 'developer' | 'employee') => void }) {
    return (
        <Dialog open={true}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Choose Your Role</DialogTitle>
                    <DialogDescription>
                        Select how you want to log in for this session.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-around py-4">
                     <Button variant="outline" className="flex flex-col h-24 w-32 gap-2" onClick={() => onSelectRole('developer')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        <span>Developer</span>
                    </Button>
                    <Button variant="outline" className="flex flex-col h-24 w-32 gap-2" onClick={() => onSelectRole('employee')}>
                        <Building className="h-8 w-8" />
                        <span>Partner</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function LoginPageContent() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [showRoleDialog, setShowRoleDialog] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (sessionStorage.getItem('userRole')) {
                    router.push('/dashboard');
                    return;
                }
                
                if (user.email === 'ca.tonnyvarghese@gmail.com') {
                    setLoading(false);
                    return;
                }

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
            
            if (user.email === 'ca.tonnyvarghese@gmail.com') {
                setShowRoleDialog(true);
                return;
            }

            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);

            if (employeeSnapshot.empty) {
                await auth.signOut();
                toast({
                    title: "Access Denied",
                    description: "You are not authorized to access this application.",
                    variant: "destructive",
                });
            }
            
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
    
    const handleRoleSelection = (role: 'developer' | 'employee') => {
        sessionStorage.setItem('userRole', role);
        setShowRoleDialog(false);
        router.push('/dashboard');
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (showRoleDialog) {
        return <RoleSelectionDialog onSelectRole={handleRoleSelection} />;
    }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col items-start justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2 text-xl font-bold">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="36"
              height="36"
              rx="8"
              fill="white"
            />
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              fill="hsl(var(--primary))"
              fontSize="14"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              DMV
            </text>
          </svg>
          DMV Central
        </div>
        <div className="space-y-4">
            <h1 className="text-4xl font-bold font-headline">Davis Martin & Varghese Chartered Accountants</h1>
        </div>
        <p className="text-sm text-primary-foreground/60">&copy; {new Date().getFullYear()} Davis Martin & Varghese Chartered Accountants. All Rights Reserved.</p>
      </div>
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
            <CardDescription>
              Sign in with your official Google account to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
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
