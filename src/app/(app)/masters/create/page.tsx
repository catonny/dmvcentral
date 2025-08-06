
"use client";

import { CreateMasterData } from "@/components/masters/create-master-data";
import { useRouter } from "next/navigation";

export default function CreateMasterDataPage() {
    const router = useRouter();
    return <CreateMasterData onBack={() => router.push('/masters')} />;
}
