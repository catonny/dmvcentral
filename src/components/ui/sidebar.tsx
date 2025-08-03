
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_COLLAPSED_WIDTH = "4rem"

type SidebarContextValue = {
  isCollapsed: boolean
  isPinned: boolean
  isMobile: boolean
  setOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

const SidebarProvider = ({
  isPinned,
  children,
}: {
  isPinned: boolean
  children: React.ReactNode
}) => {
  const [open, setOpen] = React.useState(isPinned)
  const isMobile = typeof window !== 'undefined' && /Mobi/i.test(window.navigator.userAgent)


  React.useEffect(() => {
    setOpen(isPinned)
  }, [isPinned])

  const isCollapsed = !isPinned && !open

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, isPinned, isMobile, setOpen }}
    >
      <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isCollapsed, isPinned, setOpen } = useSidebar()

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-y-0 left-0 z-50 h-screen transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[--sidebar-collapsed-width]" : "w-[--sidebar-width]",
        className
      )}
      onMouseEnter={() => !isPinned && setOpen(true)}
      onMouseLeave={() => !isPinned && setOpen(false)}
      style={
        {
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-collapsed-width": SIDEBAR_COLLAPSED_WIDTH,
        } as React.CSSProperties
      }
      {...props}
    >
      <div className="flex h-full flex-col p-3 bg-white/5 backdrop-blur-lg border-r border-white/10">
        {children}
      </div>
    </div>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isCollapsed } = useSidebar()
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-300 ease-in-out",
        isCollapsed ? "pl-[--sidebar-collapsed-width]" : "pl-[--sidebar-width]",
        className
      )}
      style={
        {
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-collapsed-width": SIDEBAR_COLLAPSED_WIDTH,
        } as React.CSSProperties
      }
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isCollapsed } = useSidebar()
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-16 items-center transition-all duration-300",
        isCollapsed ? "justify-center" : "justify-start pl-2",
        className
      )}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex-grow overflow-y-auto", className)}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-auto", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("relative", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
    "group flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm font-medium text-gray-300 outline-none ring-primary transition-all hover:bg-white/10 hover:text-white focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-white/10 data-[active=true]:text-white",
    {
        variants: {
            isCollapsed: {
                true: "justify-center",
                false: "justify-start",
            },
        },
    }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string
  }
>(
  (
    {
      asChild = false,
      isActive = false,
      tooltip,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isCollapsed } = useSidebar()
    const Comp = asChild ? Slot : "button"

    const buttonContent = React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === 'span' && isCollapsed) {
            return null;
        }
        return child;
    });

    const button = (
      <Comp
        ref={ref}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ isCollapsed }), className)}
        {...props}
      >
        {buttonContent}
      </Comp>
    )

    if (!tooltip || !isCollapsed) {
      return button
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"


const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
    // This is a placeholder now, pinning is handled in the layout
    return null;
});
SidebarTrigger.displayName = "SidebarTrigger";


export {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
}
