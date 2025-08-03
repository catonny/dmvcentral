
"use client";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
    const { loading } = useAuth();
    
    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading Dashboard...</p>
            </div>
        );
    }
    
    return (
        <DashboardClient />
    )
}
