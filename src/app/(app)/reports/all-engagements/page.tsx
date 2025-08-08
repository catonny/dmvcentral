
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// This page has been consolidated into the new /reports/engagements page.
// We redirect users to the new page.
export default function AllEngagementsReportRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/reports/engagements');
    }, [router]);

    return null; 
}
