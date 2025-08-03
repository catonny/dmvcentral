import { cn } from "@/lib/utils";
import { useSidebar } from "./ui/sidebar";
import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  const { isCollapsed } = useSidebar();
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2 text-white", className)}>
        <div className={cn("flex items-center justify-center", isCollapsed ? "block" : "hidden")}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                width="36"
                height="36"
                rx="8"
                fill="#374151"
              />
              <text
                x="50%"
                y="50%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="#FBBF24"
                fontSize="14"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                DMV
              </text>
            </svg>
        </div>
        <h1 className={cn("text-xl font-bold transition-opacity duration-300", isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto")}>
            DMV Central
        </h1>
    </Link>
  );
}
