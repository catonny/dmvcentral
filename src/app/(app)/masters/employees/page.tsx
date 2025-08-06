
"use client";

import { EmployeeManager } from "@/components/masters/employee-manager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EmployeeManagerPage() {
    return (
        <div className="space-y-6">
            <Button asChild variant="outline" size="sm">
                <Link href="/masters">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Masters
                </Link>
            </Button>
            <EmployeeManager onBack={() => {}} />
        </div>
    )
}
