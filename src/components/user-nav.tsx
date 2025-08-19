
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { Employee } from "@/lib/data";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";


export function UserNav({ impersonatedUser }: { impersonatedUser: Employee | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentUserProfile, setCurrentUserProfile] = useState<Employee | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Listen for real-time updates to the user's profile
    const q = query(collection(db, "employees"), where("email", "==", user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            setCurrentUserProfile(snapshot.docs[0].data() as Employee);
        }
    });

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = async () => {
    sessionStorage.removeItem('userRole');
    await auth.signOut();
    router.push('/login');
  };

  if (!user) {
    return null;
  }
  
  // Use the live profile from Firestore for the logged-in user if not impersonating
  const activeProfile = impersonatedUser || currentUserProfile;

  const displayName = activeProfile ? activeProfile.name : user.displayName;
  const displayEmail = activeProfile ? activeProfile.email : user.email;
  const displayAvatar = activeProfile ? activeProfile.avatar : user.photoURL;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
             {displayAvatar && <AvatarImage src={displayAvatar} alt={displayName || 'User'} />}
            <AvatarFallback>
              <User />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {displayEmail}
            </p>
            {impersonatedUser && (
                <p className="text-xs leading-none text-blue-500 pt-1">(Impersonating)</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
