
import React from "react";
import { AppLayoutClient } from "@/components/app-layout-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
      <AppLayoutClient>{children}</AppLayoutClient>
    </div>
  );
}
