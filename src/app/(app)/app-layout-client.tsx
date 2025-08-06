

"use client";

import { Logo } from "@/components/logo";
import { UserNav } from "@/components/user-nav";
import { Briefcase, ClipboardList, Database, Group, LayoutDashboard, Pin, PinOff, Settings, UploadCloud, Users, Eye, Receipt, GitBranch, GripVertical, ShieldCheck, Workflow, UserCog, Timer, User as UserIcon, Calendar, Search, Mail, LineChart } from "lucide-react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, SidebarInset, SidebarFooter } from "@/components/ui/sidebar";
import { ClockWidget } from "@/components/clock-widget";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Employee, Permission, FeatureName, Client, Engagement, EngagementType } from "@/lib/data";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ClientOnly } from "./client-only";
import { Button } from "./ui/button";
import { UniversalSearch } from "./universal-search";

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
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allEngagements, setAllEngagements] = useState<Engagement[]>([]);
  const [allEngagementTypes, setAllEngagementTypes] = useState<EngagementType[]>([]);

  const [currentUserEmployeeProfile, setCurrentUserEmployeeProfile] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Super admin status depends on role selected at login
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user?.email === 'ca.tonnyvarghese@gmail.com') {
        const role = sessionStorage.getItem('userRole');
        setIsSuperAdmin(role === 'developer');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  // Effect to fetch all employees for impersonation dropdown
  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setAllEmployees(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
    });
    
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
        setAllClients(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Client)));
    });
    
    const unsubEngagements = onSnapshot(collection(db, "engagements"), (snapshot) => {
        setAllEngagements(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Engagement)));
    });

    const unsubEngagementTypes = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
        setAllEngagementTypes(snapshot.docs.map(d => ({id: d.id, ...d.data()} as EngagementType)));
    });

    return () => {
      unsubEmployees();
      unsubClients();
      unsubEngagements();
      unsubEngagementTypes();
    };
  }, []);


  useEffect(() => {
    if (user) {
      setProfileLoading(true);

      const targetEmail = impersonatedUserId 
          ? allEmployees.find(e => e.id === impersonatedUserId)?.email
          : user.email;

      if (isSuperAdmin && !impersonatedUserId) {
          setCurrentUserEmployeeProfile({
              id: 'super-admin',
              name: 'Developer',
              email: user.email!,
              role: ['Admin'],
              avatar: ''
          });
      } else if (targetEmail) {
          const employeeQuery = query(collection(db, "employees"), where("email", "==", targetEmail));
          getDocs(employeeQuery).then(employeeSnapshot => {
            if (!employeeSnapshot.empty) {
              const userEmployeeProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
              setCurrentUserEmployeeProfile(userEmployeeProfile);
            } else {
                 setCurrentUserEmployeeProfile(null);
            }
          });
      }
      
      setProfileLoading(false);
      
      const permissionsUnsub = onSnapshot(collection(db, "permissions"), (snapshot) => {
          const permsData = snapshot.docs.map(doc => ({ ...doc.data() } as Permission));
          setPermissions(permsData);
      });
      
      return () => permissionsUnsub();
    } else if (!loading) {
        setProfileLoading(false);
    }
  }, [user, loading, impersonatedUserId, isSuperAdmin, allEmployees]);

  useEffect(() => {
    if (profileLoading) return;
    
    const userRoles = currentUserEmployeeProfile?.role || [];
    
    const checkPermission = (feature: FeatureName) => {
        if (isSuperAdmin) return true;
        const permission = permissions.find(p => p.feature === feature);
        if (!permission) return false;
        return userRoles.some(role => permission.departments.includes(role));
    }

    const defaultItems: NavItem[] = [
        { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, tooltip: 'Dashboard', label: 'Dashboard', condition: true },
        { id: 'workflow', href: '/workflow', icon: Workflow, tooltip: 'Workflow', label: 'Workflow', condition: true },
        { id: 'timesheet', href: '/timesheet', icon: Timer, tooltip: 'Timesheet', label: 'Timesheet', condition: checkPermission('timesheet') },
        { id: 'leave-management', href: '/leave-management', icon: UserCog, tooltip: 'Leave Management', label: 'Leave Management', condition: checkPermission('leave-management') },
        { id: 'reports', href: '/reports', icon: Eye, tooltip: 'Reports', label: 'Reports', condition: checkPermission('reports') },
        { id: 'administration', href: '/administration', icon: Receipt, tooltip: 'Administration', label: 'Administration', condition: checkPermission('administration') },
        { id: 'clients', href: '/clients', icon: Users, tooltip: 'Clients', label: 'Clients', condition: true },
        { id: 'profile', href: '/profile', icon: UserIcon, tooltip: 'My Profile', label: 'My Profile', condition: true },
        { id: 'masters', href: '/masters', icon: Database, tooltip: 'Masters', label: 'Masters', condition: checkPermission('masters') },
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
  }, [currentUserEmployeeProfile, profileLoading, permissions, isSuperAdmin]);
  
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

  // Universal Search Keyboard Shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  if (loading || profileLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  if (!user) {
    return null; 
  }
  
  const currentDisplayName = impersonatedUserId 
    ? allEmployees.find(e => e.id === impersonatedUserId)?.name?.split(' ')[0] || 'User'
    : user?.displayName?.split(' ')[0] || 'there';
  
  const checkPermission = (feature: FeatureName) => {
    if (isSuperAdmin) return true;
    const userRoles = currentUserEmployeeProfile?.role || [];
    const permission = permissions.find(p => p.feature === feature);
    if (!permission) return false;
    return userRoles.some(role => permission.departments.includes(role));
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
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-bold tracking-tight text-white">
                            Hi, {currentDisplayName}!
                        </h2>
                        <p className="text-muted-foreground text-sm">
                        {impersonatedUserId ? `You are currently viewing the app as ${currentDisplayName}.` : "What would you like to solve next?"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/10">
                        <Link href="/workspace"><Briefcase />Workspace</Link>
                    </Button>
                    {checkPermission('inbox') && (
                        <Button asChild variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/10">
                            <Link href="/inbox"><Mail />Inbox</Link>
                        </Button>
                    )}
                    {checkPermission('calendar') && (
                        <Button asChild variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/10">
                            <Link href="/calendar"><Calendar />Calendar</Link>
                        </Button>
                    )}

                    <div className="h-6 w-px bg-white/20 mx-2"></div>
                    
                   <Button variant="outline" className="gap-2" onClick={() => setIsSearchOpen(true)}>
                        <Search className="h-4 w-4" />
                        Search...
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                           <span className="text-xs">⌘</span>K
                        </kbd>
                   </Button>
                  {isSuperAdmin && (
                      <div className="flex items-center gap-2 text-white">
                          <UserCog className="h-5 w-5" />
                          <Select value={impersonatedUserId || "none"} onValueChange={(value) => setImpersonatedUserId(value === "none" ? null : value)}>
                              <SelectTrigger className="w-[180px] bg-transparent border-white/50">
                                <SelectValue placeholder="Impersonate User" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="none">Stop Impersonating</SelectItem>
                                  {allEmployees.map(emp => (
                                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  )}
                  <ClockWidget />
                  <UserNav impersonatedUser={impersonatedUserId ? allEmployees.find(e => e.id === impersonatedUserId) : null} />
                </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                {children}
            </main>
             <UniversalSearch 
                open={isSearchOpen}
                onOpenChange={setIsSearchOpen}
                clients={allClients}
                engagements={allEngagements}
                engagementTypes={allEngagementTypes}
                employees={allEmployees}
                currentUser={currentUserEmployeeProfile}
             />
          </SidebarInset>
    </SidebarProvider>
  );
}

export function AppLayoutClient({ children }: { children: React.ReactNode;}) {
  return (
    <AuthProvider>
        <ClientOnly>
            <LayoutRenderer>{children}</LayoutRenderer>
        </ClientOnly>
    </AuthProvider>
  )
}
