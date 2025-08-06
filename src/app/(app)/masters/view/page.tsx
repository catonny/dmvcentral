
"use client";

import { ViewMasterData } from "@/components/masters/view-master-data";
import { useRouter } from "next/navigation";

export default function ViewMastersDataPage() {
    const router = useRouter();
    return <ViewMasterData onBack={() => router.push('/masters')} />;
}
