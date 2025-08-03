

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Client, Employee } from "@/lib/data"
import { format, parseISO } from "date-fns"
import { Checkbox } from "../ui/checkbox"


export const getColumns = (
  openEditSheet: (client: Client) => void,
  confirmDeleteClient: (client: Client) => void,
  updateData: (clientId: string, columnId: keyof Client, value: any) => void,
  partners: Employee[],
  allClients: Client[],
  allEmployees: Employee[]
): ColumnDef<Client>[] => {
  
  const clientNameMap = new Map(allClients.map(c => [c.id, c.Name]));
  const employeeNameMap = new Map(allEmployees.map(e => [e.id, e.name]));

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const client = row.original

        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSheet(client)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit Client</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(client.id)}
                >
                  Copy client ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openEditSheet(client)}>
                  Edit Client Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => confirmDeleteClient(client)}
                  className="text-destructive"
                >
                  Delete Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      enableResizing: false,
      enableHiding: false,
    },
    {
      accessorKey: "Name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Client
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <div className="font-medium px-3 py-2">{row.original.Name}</div>,
      enableResizing: true,
      size: 250,
    },
    {
      accessorKey: "Category",
      header: "Category",
      cell: ({ row }) => <div className="px-3 py-2 text-sm">{row.original.Category || ''}</div>
    },
    {
      accessorKey: "PAN",
      header: "PAN",
      cell: ({ row }) => <div className="px-3 py-2">{row.original.PAN}</div>
    },
    {
        accessorKey: "GSTN",
        header: "GSTN",
        cell: ({ row }) => <div className="px-3 py-2">{row.original.GSTN}</div>
    },
    {
      accessorKey: "Mail ID",
      header: "Email",
      cell: ({ row }) => <div className="px-3 py-2 truncate max-w-xs">{row.original['Mail ID']}</div>,
      size: 250,
    },
    {
        accessorKey: "Mobile Number",
        header: "Mobile",
        cell: ({ row }) => <div className="px-3 py-2">{row.original['Mobile Number']}</div>
    },
    {
        accessorKey: "Phone Number",
        header: "Phone",
        cell: ({ row }) => <div className="px-3 py-2">{row.original['Phone Number']}</div>
    },
    {
        accessorKey: "Date of Birth",
        header: "Date of Birth",
        cell: ({ row }) => {
            const dob = row.original['Date of Birth'];
            if (!dob) return null;
            try {
                 return <div className="px-3 py-2 text-sm">{format(new Date(dob), "dd/MM/yyyy")}</div>;
            } catch (e) {
                return <div className="px-3 py-2 text-sm text-destructive">Invalid Date</div>
            }
        }
    },
    {
      accessorKey: "partnerId",
      header: "Assigned Partner",
       cell: ({ row }) => <div className="px-3 py-2">{employeeNameMap.get(row.original.partnerId) || "N/A"}</div>,
      filterFn: (row, id, value) => {
          const partnerName = employeeNameMap.get(row.getValue(id));
          if (!partnerName) return false;
          return value.includes(partnerName);
      },
    },
    {
        accessorKey: "linkedClientIds",
        header: "Linked Clients",
        cell: ({ row }) => {
            const linkedIds = row.original.linkedClientIds || [];
            if (linkedIds.length === 0) return null;
            const linkedNames = linkedIds.map(id => clientNameMap.get(id) || id).join(", ");
            return <div className="px-3 py-2 text-sm truncate max-w-xs">{linkedNames}</div>
        },
    },
    {
      accessorKey: "Contact Person",
      header: "Contact Person",
      cell: ({ row }) => {
        if (row.original.Category === 'Individual') return null;
        return <div className="px-3 py-2">{row.original['Contact Person']}</div>;
      },
    },
    {
      accessorKey: "Contact Person Designation",
      header: "Designation",
      cell: ({ row }) => {
        if (row.original.Category === 'Individual') return null;
        return <div className="px-3 py-2">{row.original['Contact Person Designation']}</div>;
      },
    },
  ]
}

    
