<<<<<<< HEAD

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
=======
"use client";

import * as React from "react";
import { EmailCenter } from "@/components/administration/email-center";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EmailCenterPage() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
            <EmailCenter />
        </div>
    );
>>>>>>> 427bbe4834aecff0226c1ff95dd39457723b1fb2
}
