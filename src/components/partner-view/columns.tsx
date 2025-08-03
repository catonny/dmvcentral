
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { PartnerViewEngagement } from "@/app/(app)/partner-view/page"
import { ArrowUpDown, Edit, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { DataTableColumnFilter } from "./data-table-column-filter"
import { engagementStatuses } from "./engagement-statuses"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"

const statusColors: { [key: string]: string } = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};

export const getPartnerViewColumns = (
  engagementTypes: string[],
  employeeNames: string[],
  openEditSheet: (engagement: PartnerViewEngagement) => void
): ColumnDef<PartnerViewEngagement>[] => [
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
            <DropdownMenuItem onClick={() => openEditSheet(engagement)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Engagement
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
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
    accessorKey: "assignedToName",
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
            <DataTableColumnFilter column={column} title="Employee" options={employeeNames} />
        </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 px-4">
        {row.original.assignedToName !== 'Unassigned' && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.assignedToAvatar} alt={row.original.assignedToName} />
            <AvatarFallback>{row.original.assignedToName.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
        <span>{row.original.assignedToName}</span>
      </div>
    ),
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
    },
  },
]

    