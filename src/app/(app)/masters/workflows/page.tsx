
"use client";

import { WorkflowEditor } from "@/components/masters/workflow-editor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WorkflowEditorPage() {
    const router = useRouter();
    return <WorkflowEditor onBack={() => router.push('/masters')} />
}
