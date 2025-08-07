

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Client, Employee } from "@/lib/data"
import { format, parseISO } from "date-fns"
import { Checkbox } from "../ui/checkbox"
import Link from "next/link"


export const getColumns = (
  openEditSheet: (client: Client) => void,
  partners: Employee[],
  allClients: Client[],
  allEmployees: Employee[]
): ColumnDef<Client>[] => {
  
  const clientNameMap = new Map(allClients.map(c => [c.id, c.name]));
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
      size: 40,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const client = row.original

        return (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSheet(client)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit Client</span>
            </Button>
        )
      },
      enableResizing: false,
      enableHiding: false,
      size: 50,
    },
    {
      accessorKey: "name",
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
      cell: ({ row }) => (
        <Button variant="link" asChild className="p-0 h-auto font-medium">
            <Link href={`/workspace/${row.original.id}`}>
                {row.original.name}
            </Link>
        </Button>
      ),
      enableResizing: true,
      size: 250,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <div className="px-3 py-2 text-sm">{row.original.category || ''}</div>
    },
    {
      accessorKey: "pan",
      header: "PAN",
      cell: ({ row }) => <div className="px-3 py-2">{row.original.pan}</div>
    },
    {
        accessorKey: "gstin",
        header: "GSTN",
        cell: ({ row }) => <div className="px-3 py-2">{row.original.gstin}</div>
    },
    {
      accessorKey: "mailId",
      header: "Email",
      cell: ({ row }) => <div className="px-3 py-2 truncate max-w-xs">{row.original.mailId}</div>,
      size: 250,
    },
    {
        accessorKey: "mobileNumber",
        header: "Mobile",
        cell: ({ row }) => <div className="px-3 py-2">{row.original.mobileNumber}</div>
    },
    {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => <div className="px-3 py-2">{row.original.phoneNumber}</div>
    },
    {
        accessorKey: "dateOfBirth",
        header: "Date of Birth",
        cell: ({ row }) => {
            const dob = row.original.dateOfBirth;
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
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: ({ row }) => {
        if (row.original.category === 'Individual') return null;
        return <div className="px-3 py-2">{row.original.contactPerson}</div>;
      },
    },
    {
      accessorKey: "contactPersonDesignation",
      header: "Designation",
      cell: ({ row }) => {
        if (row.original.category === 'Individual') return null;
        return <div className="px-3 py-2">{row.original.contactPersonDesignation}</div>;
      },
    },
  ]
}
