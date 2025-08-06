
"use client";

import { AlterMasterData } from "@/components/masters/alter-master-data";
import { useRouter } from "next/navigation";

export default function AlterMastersDataPage() {
    const router = useRouter();
    return <AlterMasterData onBack={() => router.push('/masters')} />;
}
