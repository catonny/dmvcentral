
"use client"

import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Briefcase, FileText, User as UserIcon } from "lucide-react"
import type { Client, Employee, Engagement, EngagementType } from "@/lib/data"
import { useRouter } from "next/navigation"

interface UniversalSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    engagements: Engagement[];
    engagementTypes: EngagementType[];
    employees: Employee[];
    currentUser: Employee | null;
}

export function UniversalSearch({ 
    open, 
    onOpenChange,
    clients,
    engagements,
    engagementTypes,
    employees,
    currentUser
}: UniversalSearchProps) {
    const router = useRouter();

    const runCommand = React.useCallback((command: () => unknown) => {
        onOpenChange(false)
        command()
    }, [onOpenChange])

    // Filter data based on user role
    const visibleData = React.useMemo(() => {
        if (!currentUser) return { clients: [], engagements: [], employees: [] };
        
        const isPartnerOrAdmin = currentUser.role.includes("Partner") || currentUser.role.includes("Admin");

        if (isPartnerOrAdmin) {
             return { clients, engagements, employees };
        }

        // Regular employee view
        const employeeEngagements = engagements.filter(e => e.assignedTo.includes(currentUser.id));
        const employeeClientIds = new Set(employeeEngagements.map(e => e.clientId));
        const employeeClients = clients.filter(c => employeeClientIds.has(c.id));
        const relevantEmployeeIds = new Set(employeeEngagements.flatMap(e => e.assignedTo));
        const relevantEmployees = employees.filter(e => relevantEmployeeIds.has(e.id));
        
        return { 
            clients: employeeClients, 
            engagements: employeeEngagements, 
            employees: relevantEmployees
        };

    }, [currentUser, clients, engagements, employees]);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search for clients, engagements, or team members..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                {visibleData.clients.length > 0 && (
                    <CommandGroup heading="Clients">
                        {visibleData.clients.map((client) => (
                            <CommandItem
                                key={`client-${client.id}`}
                                value={`Client: ${client.name}`}
                                onSelect={() => runCommand(() => router.push(`/workspace/${client.id}`))}
                            >
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>{client.name}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                
                {visibleData.engagements.length > 0 && (
                    <CommandGroup heading="Engagements">
                        {visibleData.engagements.map((engagement) => {
                            const engagementType = engagementTypes.find(et => et.id === engagement.type);
                            return (
                                <CommandItem
                                    key={`engagement-${engagement.id}`}
                                    value={`Engagement: ${engagement.remarks} ${engagementType?.name}`}
                                    onSelect={() => runCommand(() => router.push(`/workflow/${engagement.id}`))}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>{engagement.remarks}</span>
                                </CommandItem>
                            )
                        })}
                    </CommandGroup>
                )}

                 {visibleData.employees.length > 0 && (
                     <CommandGroup heading="Team">
                        {visibleData.employees.map((employee) => (
                            <CommandItem
                                key={`employee-${employee.id}`}
                                value={`Employee: ${employee.name} ${employee.email}`}
                                onSelect={() => runCommand(() => router.push(`/profile`))} // Could eventually link to a public profile page
                            >
                                <Briefcase className="mr-2 h-4 w-4" />
                                <span>{employee.name}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                 )}
            </CommandList>
        </CommandDialog>
    )
}
