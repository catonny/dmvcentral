
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
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { Employee } from "@/lib/data";
import Link from "next/link";


export function UserNav({ impersonatedUser }: { impersonatedUser: Employee | null }) {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    sessionStorage.removeItem('userRole');
    await auth.signOut();
    router.push('/login');
  };

  if (!user) {
    return null;
  }
  
  const displayName = impersonatedUser ? impersonatedUser.name : user.displayName;
  const displayEmail = impersonatedUser ? impersonatedUser.email : user.email;
  const displayAvatar = impersonatedUser ? impersonatedUser.avatar : user.photoURL;

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
