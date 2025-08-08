
"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { ArrowUpDown } from "lucide-react";
import type { RecurringEngagement, Client, EngagementType } from "@/lib/data";
import { useDebounce } from "@/hooks/use-debounce";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

interface DataTableProps {
  data: RecurringEngagement[];
  clients: Client[];
  engagementTypes: EngagementType[];
  onUpdate: (id: string, field: keyof RecurringEngagement, value: any, originalValue?: any) => void;
}

const EditableCell = ({
  getValue,
  row: { original },
  column: { id },
  onUpdate,
}: {
  getValue: () => any;
  row: { original: RecurringEngagement };
  column: { id: string };
  onUpdate: (id: string, field: keyof RecurringEngagement, value: any, originalValue?: any) => void;
}) => {
  const initialValue = getValue();
  const [value, setValue] = React.useState(initialValue);
  const debouncedValue = useDebounce(value, 500);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (debouncedValue !== initialValue) {
      onUpdate(original.id, id as keyof RecurringEngagement, debouncedValue, initialValue);
    }
  }, [debouncedValue, initialValue, original.id, id, onUpdate]);

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      className="w-24"
    />
  );
};

export function RecurringEngagementsTable({ data, clients, engagementTypes, onUpdate }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState([
    { id: "clientName", value: "" },
    { id: "engagementTypeName", value: "" },
  ]);

  const tableData = React.useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));

    return data.map(re => ({
        ...re,
        clientName: clientMap.get(re.clientId)?.name || 'Unknown',
        engagementTypeName: engagementTypeMap.get(re.engagementTypeId)?.name || 'Unknown',
        recurrence: engagementTypeMap.get(re.engagementTypeId)?.recurrence || 'N/A'
    }));
  }, [data, clients, engagementTypes]);


  const columns: ColumnDef<typeof tableData[0]>[] = React.useMemo(() => [
    {
      accessorKey: "clientName",
      header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Client <ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
      cell: ({ row }) => <span>{row.original.clientName}</span>,
    },
    {
      accessorKey: "engagementTypeName",
      header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Engagement Type <ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
      cell: ({ row }) => <span>{row.original.engagementTypeName}</span>,
    },
    {
      accessorKey: "recurrence",
      header: "Recurrence",
    },
    {
      accessorKey: "fees",
      header: "Fees",
      cell: (props) => <EditableCell {...props} onUpdate={onUpdate} />,
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          onCheckedChange={(value) => onUpdate(row.original.id, 'isActive', value)}
        />
      ),
    },
  ], [onUpdate]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
        <div className="flex gap-4">
            <Input
                placeholder="Filter by client..."
                value={table.getColumn("clientName")?.getFilterValue() as string ?? ""}
                onChange={(e) => table.getColumn("clientName")?.setFilterValue(e.target.value)}
            />
            <Input
                placeholder="Filter by engagement type..."
                value={table.getColumn("engagementTypeName")?.getFilterValue() as string ?? ""}
                onChange={(e) => table.getColumn("engagementTypeName")?.setFilterValue(e.target.value)}
            />
        </div>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                    {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                ))}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        <ScrollBar orientation="horizontal"/>
        </ScrollArea>
    </div>
  );
}
