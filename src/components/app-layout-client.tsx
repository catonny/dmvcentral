
"use client";

import { Logo } from "@/components/logo";
import { UserNav } from "@/components/user-nav";
import { Briefcase, ClipboardList, Database, Group, LayoutDashboard, Pin, PinOff, Settings, UploadCloud, Users, Eye, Receipt, GitBranch, GripVertical, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, SidebarInset, SidebarFooter } from "@/components/ui/sidebar";
import { ClockWidget } from "@/components/clock-widget";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Employee, Permission, FeatureName } from "@/lib/data";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NavItem {
  id: string;
  href: string;
  icon: React.ElementType;
  tooltip: string;
  label: string;
  condition: boolean;
}

const NavLink = ({ href, children, icon: Icon, tooltip }: { href: string; children: React.ReactNode, icon: React.ElementType, tooltip: string }) => (
    <SidebarMenuItem>
      <Link href={href} passHref>
          <SidebarMenuButton tooltip={tooltip}>
              <Icon />
              <span>{children}</span>
          </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
);

const SortableNavLink = ({ item }: { item: NavItem }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="group relative">
            <div {...attributes} {...listeners} className="absolute inset-y-0 right-1 z-10 flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <NavLink href={item.href} icon={item.icon} tooltip={item.tooltip}>
                {item.label}
            </NavLink>
        </div>
    );
};


function LayoutRenderer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(true);
  const [currentUserEmployeeProfile, setCurrentUserEmployeeProfile] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const fetchEmployeeProfile = async () => {
        setProfileLoading(true);
        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        const employeeSnapshot = await getDocs(employeeQuery);
        if (!employeeSnapshot.empty) {
          const userEmployeeProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
          setCurrentUserEmployeeProfile(userEmployeeProfile);
        } else {
             // If no profile found for a logged-in user, they can still proceed.
             // Role-based checks will handle permissions gracefully.
             setCurrentUserEmployeeProfile(null);
        }
        setProfileLoading(false);
      };
      fetchEmployeeProfile();
      
      const permissionsUnsub = onSnapshot(collection(db, "permissions"), (snapshot) => {
          const permsData = snapshot.docs.map(doc => ({ ...doc.data() } as Permission));
          setPermissions(permsData);
      });
      
      return () => permissionsUnsub();
    } else if (!loading) {
        setProfileLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    if (profileLoading) return;
    
    const userRoles = currentUserEmployeeProfile?.role || [];
    const isSuperAdmin = user?.email === 'ca.tonnyvarghese@gmail.com';
    
    const checkPermission = (feature: FeatureName) => {
        if (isSuperAdmin || userRoles.includes("Admin")) return true;
        const permission = permissions.find(p => p.feature === feature);
        if (!permission) return false;
        return userRoles.some(role => permission.departments.includes(role));
    }

    const defaultItems: NavItem[] = [
        { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, tooltip: 'Dashboard', label: 'Dashboard', condition: true },
        { id: 'workspace', href: '/workspace', icon: Briefcase, tooltip: 'Workspace', label: 'Workspace', condition: true },
        { id: 'workflow', href: '/workflow', icon: Workflow, tooltip: 'Workflow', label: 'Workflow', condition: true },
        { id: 'partner-view', href: '/partner-view', icon: Eye, tooltip: 'Partner View', label: 'Partner View', condition: checkPermission('partner-view') },
        { id: 'accounts', href: '/accounts', icon: Receipt, tooltip: 'Accounts', label: 'Accounts', condition: checkPermission('accounts') },
        { id: 'clients', href: '/clients', icon: Users, tooltip: 'Clients', label: 'Clients', condition: true },
        { id: 'masters', href: '/masters', icon: Database, tooltip: 'Masters', label: 'Masters', condition: checkPermission('masters') },
        { id: 'employee', href: '/employee', icon: Group, tooltip: 'Employee', label: 'Employee', condition: checkPermission('employee-management') },
        { id: 'bulk-import', href: '/bulk-import', icon: UploadCloud, tooltip: 'Bulk Import', label: 'Bulk Import', condition: checkPermission('bulk-import') },
        { id: 'settings', href: '/settings', icon: Settings, tooltip: 'Settings', label: 'Settings', condition: checkPermission('settings-data-management') || checkPermission('settings-access-control') }
    ];
    
    const storedOrder = localStorage.getItem('sidebarOrder');
    const visibleItems = defaultItems.filter(item => item.condition);

    if (storedOrder) {
        try {
            const orderedIds = JSON.parse(storedOrder) as string[];
            const orderedItems = orderedIds
                .map(id => visibleItems.find(item => item.id === id))
                .filter((item): item is NavItem => !!item);
            
            const newItems = visibleItems.filter(item => !orderedIds.includes(item.id));
            setNavItems([...orderedItems, ...newItems]);

        } catch(e) {
             setNavItems(visibleItems);
        }
    } else {
         setNavItems(visibleItems);
    }
  }, [currentUserEmployeeProfile, profileLoading, permissions, user?.email]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        setNavItems((items) => {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            const newOrder = arrayMove(items, oldIndex, newIndex);
            
            localStorage.setItem('sidebarOrder', JSON.stringify(newOrder.map(item => item.id)));

            return newOrder;
        });
    }
  }

  if (loading || profileLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  if (!user) {
    return null; 
  }
  
  return (
      <SidebarProvider isPinned={isPinned}>
          <Sidebar>
              <SidebarHeader>
                <Logo />
              </SidebarHeader>
              <SidebarContent>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={navItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                        <SidebarMenu>
                            {navItems.map(item => (
                                <SortableNavLink key={item.id} item={item} />
                            ))}
                        </SidebarMenu>
                    </SortableContext>
                </DndContext>
              </SidebarContent>
              <SidebarFooter>
                 <SidebarMenu>
                    <SidebarMenuItem>
                         <SidebarMenuButton onClick={() => setIsPinned(p => !p)} tooltip={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}>
                            {isPinned ? <PinOff /> : <Pin />}
                            <span>{isPinned ? "Unpin Sidebar" : "Pin Sidebar"}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                 </SidebarMenu>
              </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="flex items-center justify-between gap-4 border-b border-white/20 bg-transparent px-4 py-3 lg:px-6">
                <div className="flex flex-col">
                     <h2 className="text-2xl font-bold tracking-tight text-white">
                        Hi, {user?.displayName?.split(' ')[0] || 'there'}!
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      What would you like to solve next?
                    </p>
                </div>
                <div className="flex items-center gap-4">
                  <ClockWidget />
                  <UserNav />
                </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                {children}
            </main>
          </SidebarInset>
    </SidebarProvider>
  );
}

export function AppLayoutClient({ children }: { children: React.ReactNode;}) {
  return (
    <AuthProvider>
      <LayoutRenderer>{children}</LayoutRenderer>
    </AuthProvider>
  )
}
