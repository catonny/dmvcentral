import React from "react";
import { AppLayoutClient } from "@/components/app-layout-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <body className="bg-background text-foreground">
      <AppLayoutClient>{children}</AppLayoutClient>
    </body>
  );
}
