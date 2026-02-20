
"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "../ui/button"
import type { User } from "@/lib/types"
import { Badge } from "../ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { useFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { Skeleton } from "../ui/skeleton"

export function VendorsTable({ data, isLoading }: { data: User[], isLoading: boolean }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const handleApprove = (vendor: User) => {
        if (!firestore) return;
        const vendorRef = doc(firestore, 'users', vendor.id);
        updateDocumentNonBlocking(vendorRef, { isVerified: true, onboardingStatus: 'approved' });
        toast({ title: "Vendor approved", description: `${vendor.name} has been verified.` });
    };

    const handleReject = (vendor: User) => {
        if (!firestore) return;
        const vendorRef = doc(firestore, 'users', vendor.id);
        deleteDocumentNonBlocking(vendorRef);
        toast({ title: "Vendor rejected", description: `${vendor.name}'s application has been removed.`, variant: "destructive" });
    };

    const columns: ColumnDef<User>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "email",
        header: "Email",
    },
    {
        accessorKey: "campusId",
        header: "Campus",
        cell: ({ row }) => <span className="uppercase">{row.getValue("campusId")}</span>
    },
    {
        accessorKey: "isVerified",
        header: "Status",
        cell: ({ row }) => {
            const isVerified = row.getValue("isVerified");
            return <Badge variant={isVerified ? "default" : "outline"}>{isVerified ? "Verified" : "Pending"}</Badge>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
          const vendor = row.original
          if (vendor.isVerified) return <div className="text-sm text-muted-foreground flex justify-end">Approved</div>
     
          return (
            <div className="flex justify-end">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleApprove(vendor)}>Approve</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleReject(vendor)}>Reject</DropdownMenuItem>
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
        <div className="rounded-md border">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id}>
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
                    No vendors found.
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
  )
}
