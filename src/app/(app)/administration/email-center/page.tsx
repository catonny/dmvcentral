
"use client";

import { EmailCenter } from "@/components/administration/email-center";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";


export default function EmailCenterPage() {
    return (
        <div className="space-y-6">
            <Button asChild variant="outline" size="sm">
                <Link href="/administration">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Administration
                </Link>
            </Button>
            <EmailCenter />
        </div>
    )
}
