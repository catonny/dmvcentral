

import * as React from 'react';
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default async function DashboardPage() {
    // Reverted to client-side fetching.
    // The DashboardClient component will now handle all data loading.
    return <DashboardClient />;
}
