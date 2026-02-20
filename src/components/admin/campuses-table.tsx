"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Campus } from "@/lib/types"
import { Button } from "../ui/button"
import { MoreHorizontal, Trash, Edit, ShieldCheck } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { useFirestore, deleteDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "../ui/skeleton"

export function CampusesTable({ data, isLoading, onEdit }: { data: Campus[], isLoading: boolean, onEdit: (campus: Campus) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleDelete = (campus: Campus) => {
        if (!firestore) return;
        if (confirm(`Are you sure you want to delete ${campus.name}? This cannot be undone.`)) {
            const campusRef = doc(firestore, 'campuses', campus.id);
            deleteDocumentNonBlocking(campusRef);
            toast({
                title: "Campus Deleted",
                description: `${campus.name} has been removed from the network.`,
                variant: "destructive"
            });
        }
    }

    const columns: ColumnDef<Campus>[] = [
    {
        accessorKey: "name",
        header: "Institution",
        cell: ({ row }) => {
            const campus = row.original;
            return (
                <div className="flex items-center gap-4">
                    <div className="h-8 w-1 rounded-full" style={{ backgroundColor: campus.primaryColor }} />
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-foreground">{campus.acronym}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest truncate max-w-[150px]">{campus.name}</span>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "studentDomain",
        header: "Student Access",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-mono font-bold">@{row.getValue("studentDomain")}</span>
            </div>
        )
    },
    {
        accessorKey: "staffDomain",
        header: "Staff Access",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-mono font-bold">@{row.getValue("staffDomain")}</span>
            </div>
        )
    },
    {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => <span className="text-xs font-bold text-slate-500">{row.getValue("location")}</span>
    },
    {
        id: "actions",
        cell: ({ row }) => {
          const campus = row.original;
     
          return (
            <div className="text-right">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-none shadow-2xl">
                    <DropdownMenuLabel>Fortress Admin</DropdownMenuLabel>
                    
                    <DropdownMenuItem onClick={() => onEdit(campus)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Update Domains
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(campus)}>
                        <Trash className="mr-2 h-4 w-4" />
                        Close Gate
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
          )
        },
      },
    ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
        <div className="rounded-[2rem] border overflow-hidden bg-card">
        <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-muted/20">
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                            )}
                    </TableHead>
                    )
                })}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {isLoading ? (
                [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={columns.length}>
                            <Skeleton className="h-6 w-full" />
                        </TableCell>
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow
                    key={row.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-muted/10 transition-colors"
                >
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground italic">
                    No active gates found in the network.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-xl font-bold"
            >
            Previous
            </Button>
            <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-xl font-bold"
            >
            Next
            </Button>
        </div>
    </div>
  )
}
