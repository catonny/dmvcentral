
"use client";

import * as React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileText, Percent, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ActionCard = ({ title, description, icon: Icon, onClick }: { title: string, description: string, icon: React.ElementType, onClick: () => void }) => (
  <Card
    className="transition-all group cursor-pointer hover:border-primary/80 hover:shadow-primary/20"
    onClick={onClick}
  >
    <CardHeader>
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Icon className="h-6 w-6 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="mt-2">{description}</CardDescription>
        </div>
         <div className="flex flex-col items-end gap-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </CardHeader>
  </Card>
);

export default function AccountingMastersPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/masters')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Masters
        </Button>
        <div className="flex items-center justify-between">
            <div>
            <h2 className="text-3xl font-bold tracking-tight font-headline">Accounting Masters</h2>
            <p className="text-muted-foreground">
                Manage reusable items for invoicing and billing.
            </p>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ActionCard 
                title="Sales Items"
                description="Manage reusable line items for invoices, including price and tax."
                icon={FileText}
                onClick={() => router.push('/masters/accounting/sales-items')}
            />
             <ActionCard 
                title="Taxes (Rates & Codes)"
                description="Configure tax rates, HSN, and SAC codes for billing."
                icon={Percent}
                onClick={() => router.push('/masters/accounting/taxes')}
            />
        </div>
    </div>
  );
}
