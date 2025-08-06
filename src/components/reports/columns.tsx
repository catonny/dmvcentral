
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ReportsEngagement } from "@/app/(app)/reports/page"
import { ArrowUpDown, Edit, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { DataTableColumnFilter } from "./data-table-column-filter"
import { engagementStatuses } from "./engagement-statuses"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip"

const statusColors: { [key: string]: string } = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "On Hold": "bg-orange-200 text-orange-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};

export const getReportsColumns = (
  engagementTypes: string[],
  employeeMap: Map<string, { name: string, avatar?: string }>,
  openEditSheet: (engagement: ReportsEngagement) => void
): ColumnDef<ReportsEngagement>[] => [
  {
    accessorKey: "clientName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Client
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-4 font-medium">{row.original.clientName}</div>,
  },
  {
    accessorKey: "engagementTypeName",
    header: ({ column }) => (
        <div className="flex items-center space-x-2">
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-1 h-auto"
            >
                Engagement Type
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <DataTableColumnFilter column={column} title="Type" options={engagementTypes} />
        </div>
    ),
    cell: ({ row }) => <div className="px-4">{row.original.engagementTypeName}</div>,
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "remarks",
    header: "Remarks",
    cell: ({ row }) => <div className="px-4 truncate max-w-xs">{row.original.remarks}</div>,
  },
   {
    accessorKey: "partnerId",
    header: ({ column }) => (
        <div className="flex items-center space-x-2">
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-1 h-auto"
            >
                Partner
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <DataTableColumnFilter column={column} title="Partner" options={Array.from(employeeMap.values()).map(e => e.name)} />
        </div>
    ),
    cell: ({ row }) => <div className="px-4">{employeeMap.get(row.original.partnerId!)?.name || "N/A"}</div>,
    filterFn: (row, id, value) => {
        const partnerName = employeeMap.get(row.getValue(id) as string)?.name;
        if (!partnerName) return false;
        return value.includes(partnerName);
    },
  },
  {
    accessorKey: "reportedTo",
    header: ({ column }) => (
        <div className="flex items-center space-x-2">
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-1 h-auto"
            >
                Manager
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
             <DataTableColumnFilter column={column} title="Manager" options={Array.from(employeeMap.values()).map(e => e.name)} />
        </div>
    ),
    cell: ({ row }) => <div className="px-4">{employeeMap.get(row.original.reportedTo)?.name || "N/A"}</div>,
    filterFn: (row, id, value) => {
        const managerName = employeeMap.get(row.getValue(id) as string)?.name;
        if (!managerName) return false;
        return value.includes(managerName);
    },
  },
  {
    accessorKey: "assignedTo",
    header: ({ column }) => (
        <div className="flex items-center space-x-2">
             <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-1 h-auto"
            >
                Assigned To
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <DataTableColumnFilter column={column} title="Employee" options={Array.from(employeeMap.values()).map(e => e.name)} />
        </div>
    ),
    cell: ({ row }) => {
        const assignedToValue = row.original.assignedTo;
        const assignedIds = Array.isArray(assignedToValue) ? assignedToValue : (assignedToValue ? [assignedToValue] : []);
        
        if (assignedIds.length === 0) {
            return <div className="px-4 text-muted-foreground">Unassigned</div>
        }

        return (
             <div className="flex items-center px-4 -space-x-2">
                <TooltipProvider>
                    {assignedIds.map(id => {
                        const employee = employeeMap.get(id);
                        if (!employee) return null;
                        return (
                            <Tooltip key={id}>
                                <TooltipTrigger asChild>
                                     <Avatar className="h-8 w-8 border-2 border-background">
                                        <AvatarImage src={employee.avatar} alt={employee.name} />
                                        <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{employee.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </TooltipProvider>
            </div>
        )
    },
    filterFn: (row, id, value) => {
        const assignedIds = row.getValue(id) as string[];
        const assignedNames = assignedIds.map(id => employeeMap.get(id)?.name).filter(Boolean);
        return value.some((v: string) => assignedNames.includes(v))
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Due Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
        try {
            return <div className="px-4">{format(new Date(row.original.dueDate), "dd/MM/yyyy")}</div>;
        } catch (e) {
            return <div className="px-4 text-destructive">Invalid Date</div>
        }
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
        <div className="flex items-center space-x-2">
             <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-1 h-auto"
            >
                Status
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
            <DataTableColumnFilter column={column} title="Status" options={engagementStatuses} />
        </div>
    ),
    cell: ({ row }) => (
        <div className="px-4">
            <Badge className={`${statusColors[row.original.status] || ''} hover:${statusColors[row.original.status] || ''}`}>
                {row.original.status}
            </Badge>
        </div>
    ),
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const engagement = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditSheet(engagement); }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Engagement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
]
