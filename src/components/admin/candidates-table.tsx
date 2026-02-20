'use client';

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
import type { CandidateApplication } from "@/lib/types" // Changed type
import { Badge } from "../ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { MoreHorizontal, ExternalLink } from "lucide-react" // Added ExternalLink
import { useFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { Skeleton } from "../ui/skeleton"

export function CandidatesTable({ data, isLoading }: { data: CandidateApplication[], isLoading: boolean }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const handleApprove = (app: CandidateApplication) => {
        if (!firestore) return;
        
        const appRef = doc(firestore, 'candidate_applications', app.id);
        updateDocumentNonBlocking(appRef, { status: 'approved' });
        
        toast({ title: "Candidate Approved", description: `${app.name}'s candidacy is being processed and they will be notified shortly.` });
    };

    const handleReject = (app: CandidateApplication) => {
        if (!firestore) return;
        const appRef = doc(firestore, 'candidate_applications', app.id);
        deleteDocumentNonBlocking(appRef);
        toast({ title: "Candidate Rejected", description: `${app.name}'s application has been rejected.`, variant: "destructive" });
    };

    const columns: ColumnDef<CandidateApplication>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "position",
        header: "Position",
    },
    {
        accessorKey: "campusId",
        header: "Campus",
        cell: ({ row }) => <span className="uppercase">{row.getValue("campusId")}</span>
    },
    {
        accessorKey: "studentIdCardUrl",
        header: "Student ID",
        cell: ({ row }) => {
            const url = row.getValue("studentIdCardUrl") as string;
            return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">View ID <ExternalLink size={12}/></a>
        }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as CandidateApplication['status'];
            let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
            if (status === 'approved') variant = 'default';
            if (status === 'pending') variant = 'outline';
            if (status === 'rejected') variant = 'destructive';

            return <Badge variant={variant}>{status}</Badge>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
          const app = row.original;
          const status = app.status;

          if (status === 'approved') {
              return <div className="text-sm text-green-600 font-semibold flex justify-end">Approved</div>
          }
          if (status === 'rejected') {
            return <div className="text-sm text-red-600 font-semibold flex justify-end">Rejected</div>
          }
     
          if (status === 'pending') {
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
                        <DropdownMenuItem onClick={() => handleApprove(app)}>Approve</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleReject(app)}>Reject</DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              )
          }

          return null;
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
                    No pending applications.
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
