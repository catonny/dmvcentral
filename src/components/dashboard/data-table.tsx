
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnSizingState,
  ColumnOrderState,
} from "@tanstack/react-table"
import { PlusCircle, Search, ChevronDown, GripVertical } from "lucide-react"
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import type { Client } from "@/lib/data"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"
import { Card, CardContent } from "../ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useDebounce } from "@/hooks/use-debounce";


const reorderColumn = (
    draggedColumnId: string,
    targetColumnId: string,
    columnOrder: string[]
): string[] => {
    const newColumnOrder = [...columnOrder];
    const draggedColumnIndex = newColumnOrder.indexOf(draggedColumnId);
    const targetColumnIndex = newColumnOrder.indexOf(targetColumnId);
    
    newColumnOrder.splice(draggedColumnIndex, 1);
    newColumnOrder.splice(targetColumnIndex, 0, draggedColumnId);
    return newColumnOrder;
};

const DraggableColumnHeader: React.FC<{ header: any; table: any }> = ({ header, table }) => {
    const { getState, setColumnOrder } = table;
    const { columnOrder } = getState();
    const { column } = header;

    const [, dropRef] = useDrop({
        accept: 'column',
        drop: (draggedColumn: any) => {
            const newColumnOrder = reorderColumn(
                draggedColumn.id,
                column.id,
                columnOrder
            );
            setColumnOrder(newColumnOrder);
        },
    });

    const [{ isDragging }, dragRef, previewRef] = useDrag({
        collect: monitor => ({
            isDragging: monitor.isDragging(),
        }),
        item: () => column,
        type: 'column',
    });

    return (
        <TableHead
            ref={dropRef}
            colSpan={header.colSpan}
            style={{ width: header.getSize(), opacity: isDragging ? 0.5 : 1 }}
            className="relative"
        >
            <div className="flex items-center gap-2">
                 <Button
                    ref={dragRef}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-grab"
                >
                    <GripVertical className="h-4 w-4" />
                </Button>
                {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
            </div>
            {header.column.getCanResize() && (
                <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                />
            )}
        </TableHead>
    );
};


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  openEditSheet: (client: Client | null) => void
}

export function DataTable<TData extends Client, TValue>({
  columns,
  data,
  openEditSheet,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    columns.map(c => c.id || (c as any).accessorKey)
  );

  React.useEffect(() => {
    const storedVisibility = localStorage.getItem('clientTableColumnVisibility');
    if (storedVisibility) {
        setColumnVisibility(JSON.parse(storedVisibility));
    } else {
         setColumnVisibility({
            'Phone Number': false,
            'Date of Birth': false,
            'GSTN': false,
            'linkedClientIds': false,
            'Contact Person Designation': false,
        });
    }
    const storedOrder = localStorage.getItem('clientTableColumnOrder');
    if (storedOrder) {
        setColumnOrder(JSON.parse(storedOrder));
    }
  }, []);

  const debouncedColumnVisibility = useDebounce(columnVisibility, 500);
  const debouncedColumnOrder = useDebounce(columnOrder, 500);

  React.useEffect(() => {
    localStorage.setItem('clientTableColumnVisibility', JSON.stringify(debouncedColumnVisibility));
  }, [debouncedColumnVisibility]);
  
  React.useEffect(() => {
    localStorage.setItem('clientTableColumnOrder', JSON.stringify(debouncedColumnOrder));
  }, [debouncedColumnOrder]);


  const table = useReactTable({
    data,
    columns,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    initialState: {
        pagination: {
            pageSize: 10,
        }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnOrder,
    },
  })

  return (
    <DndProvider backend={HTML5Backend}>
    <Card>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                placeholder="Search clients..."
                value={(table.getColumn("Name")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                    table.getColumn("Name")?.setFilterValue(event.target.value)
                }
                className="pl-8 w-full md:w-[250px] lg:w-[300px]"
                />
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-auto">
                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                        return (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            className="capitalize"
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                            }
                        >
                            {column.id === 'linkedClientIds' ? 'Linked Clients' : column.id.replace(/([A-Z])/g, ' $1')}
                        </DropdownMenuCheckboxItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <Button onClick={() => openEditSheet(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>
      <CardContent className="p-0">
        <ScrollArea className="w-full whitespace-nowrap">
            <Table style={{width: table.getCenterTotalSize()}}>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-white/10">
                    {headerGroup.headers.map((header) => (
                        <DraggableColumnHeader key={header.id} header={header} table={table} />
                    ))}
                </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-white/10"
                    >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} style={{width: cell.column.getSize()}}>
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
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
      <div className="flex items-center justify-between space-x-2 py-4 px-6 border-t border-white/10">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} row(s).
        </div>
        <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                    table.setPageSize(Number(value))
                }}
            >
                <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                    {[10, 25, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center space-x-2">
            <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            >
            Previous
            </Button>
            <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            >
            Next
            </Button>
        </div>
      </div>
    </Card>
    </DndProvider>
  )
}
