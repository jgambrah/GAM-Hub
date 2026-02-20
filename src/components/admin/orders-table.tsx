
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
import type { Order } from "@/lib/types"
import { Badge } from "../ui/badge"
import { Skeleton } from "../ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useFirebase, updateDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function OrdersTable({ data, isLoading }: { data: Order[], isLoading: boolean }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [updatingIds, setUpdatingIds] = React.useState<string[]>([]);

    const handleReleaseFunds = (order: Order) => {
        if (!firestore) return;
        setUpdatingIds(prev => [...prev, order.id]);
        const orderRef = doc(firestore, 'orders', order.id);
        
        updateDocumentNonBlocking(orderRef, { status: 'completed', payoutStatus: 'pending' });
        
        toast({
            title: "Funds Released",
            description: `Funds for order ${order.productName} have been released to the vendor.`,
        });
    };

    const columns: ColumnDef<Order>[] = [
    {
        accessorKey: "productName",
        header: "Product",
    },
    {
        accessorKey: "buyerName",
        header: "Buyer",
    },
    {
        accessorKey: "campusId",
        header: "Campus",
        cell: ({ row }) => <span className="uppercase">{row.getValue("campusId")}</span>,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status: string = row.getValue("status");
            let variant: "default" | "secondary" | "destructive" | "outline" | null | undefined = "secondary";
            if (status === 'paid') variant = 'default';
            if (status === 'picked-up') variant = 'outline';
            if (status === 'completed') variant = 'default';
            if (status === 'disputed') variant = 'destructive';
            if (status === 'refunded') variant = 'destructive';
            if (status === 'archived') variant = 'secondary';

            let statusText = status.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            return <Badge variant={variant} className={cn(
                status === 'completed' && 'bg-green-600 hover:bg-green-700 text-white',
                status === 'disputed' && 'bg-amber-600 hover:bg-amber-700 text-white',
                status === 'refunded' && 'bg-red-700 hover:bg-red-800 text-white',
                status === 'archived' && 'bg-gray-500 hover:bg-gray-600 text-white'
            )}>{statusText}</Badge>
        }
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        const formatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "GHS",
        }).format(amount)
    
        return <div className="text-right font-medium">{formatted}</div>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
          const order = row.original;
          const isUpdating = updatingIds.includes(order.id);

          if (order.status === 'disputed') {
            return (
              <div className="text-right text-sm font-semibold text-destructive">
                In Dispute
              </div>
            )
          }

          if (order.status === 'picked-up') {
            return (
              <div className="text-right">
                <Button 
                    size="sm" 
                    onClick={() => handleReleaseFunds(order)}
                    disabled={isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Release Funds
                </Button>
              </div>
            )
          }
          if (order.status === 'completed' || order.status === 'refunded' || order.status === 'archived') {
             return <div className="text-right text-sm text-muted-foreground">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
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
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
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
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
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
