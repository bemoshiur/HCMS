"use client";

// Master data → Fees tab: fee schedule items (structure type × height band → amount).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/components/providers";
import { fetchJson, jsonBody, type FeeRow, type StructureTypeRow } from "./types";

const schema = z.object({
  structureType: z.string().trim().min(2, "Structure type is required").max(80),
  heightBandM: z.string().trim().min(1, "Height band is required").max(30),
  amount: z.number("Enter an amount").min(0, "Must be ≥ 0").max(10_000_000),
  currency: z.string().trim().min(2).max(6),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const CURRENCIES = ["BDT", "USD"];

export function FeesTab() {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FeeRow | null>(null);
  const [deleting, setDeleting] = React.useState<FeeRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["md-fees"],
    queryFn: () => fetchJson<{ items: FeeRow[] }>("/api/master-data/fees"),
  });
  const structuresQ = useQuery({
    queryKey: ["md-structure-types"],
    queryFn: () => fetchJson<{ items: StructureTypeRow[] }>("/api/master-data/structure-types"),
    staleTime: 5 * 60_000,
  });
  const items = data?.items ?? [];
  const structureTypes = structuresQ.data?.items ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["md-fees"] });

  const toggleMutation = useMutation({
    mutationFn: (row: FeeRow) =>
      fetchJson(`/api/master-data/fees/${row.id}`, { ...jsonBody({ active: !row.active }), method: "PATCH" }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/master-data/fees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Fee item deleted");
      invalidate();
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const columns = React.useMemo<ColumnDef<FeeRow, unknown>[]>(
    () => [
      { accessorKey: "structureType", header: "Structure type", cell: ({ row }) => <span className="font-medium">{row.original.structureType}</span> },
      {
        accessorKey: "heightBandM",
        header: "Height band (m)",
        cell: ({ row }) => <span className="tabular-nums">{row.original.heightBandM}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.amount.toLocaleString()} {row.original.currency}
          </span>
        ),
      },
      {
        accessorKey: "active",
        header: t("common.status"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.active}
              onCheckedChange={() => toggleMutation.mutate(row.original)}
              aria-label={`Toggle ${row.original.structureType} ${row.original.heightBandM}`}
            />
            <StatusBadge status={row.original.active ? "COMPLIANT" : "EXPIRED"} showDot={false} />
          </div>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        size: 48,
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEditing(row.original);
                  setDialogOpen(true);
                }}
              >
                <Pencil aria-hidden />
                {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row.original)}>
                <Trash2 aria-hidden />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, toggleMutation]
  );

  return (
    <>
      <DataTable<FeeRow>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder="Search fee schedule…"
        initialSorting={[{ id: "structureType", desc: false }]}
        emptyTitle="No fee items"
        emptyDescription="Define fees per structure type and height band."
        emptyAction={
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" aria-hidden />
            Add fee item
          </Button>
        }
        toolbar={
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" aria-hidden />
            Add fee item
          </Button>
        }
        exportCsv={{
          filename: "caab-fee-schedule.csv",
          headers: ["Structure Type", "Height Band (m)", "Amount", "Currency", "Active"],
          row: (i) => [i.structureType, i.heightBandM, i.amount, i.currency, i.active ? "Yes" : "No"],
        }}
      />

      <FeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        structureTypes={structureTypes}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fee item?</AlertDialogTitle>
            <AlertDialogDescription>
              The {deleting?.structureType} / {deleting?.heightBandM} m fee will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FeeDialog({
  open,
  onOpenChange,
  editing,
  structureTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: FeeRow | null;
  structureTypes: StructureTypeRow[];
  onSaved: () => void;
}) {
  const t = useT();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { structureType: "", heightBandM: "", amount: 0, currency: "BDT", active: true },
  });
  const { register, control, formState, setValue, watch } = form;

  // Structure-type options: defined types plus the editing value (may be legacy).
  const structureOptions = React.useMemo(() => {
    const set = new Set(structureTypes.map((s) => s.name));
    if (editing?.structureType) set.add(editing.structureType);
    return Array.from(set).sort();
  }, [structureTypes, editing]);

  React.useEffect(() => {
    if (open) {
      form.reset({
        structureType: editing?.structureType ?? "",
        heightBandM: editing?.heightBandM ?? "",
        amount: editing?.amount ?? 0,
        currency: editing?.currency ?? "BDT",
        active: editing?.active ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        structureType: values.structureType,
        heightBandM: values.heightBandM,
        amount: values.amount,
        currency: values.currency,
        active: values.active,
      };
      return editing
        ? fetchJson(`/api/master-data/fees/${editing.id}`, { ...jsonBody(payload), method: "PATCH" })
        : fetchJson("/api/master-data/fees", jsonBody(payload));
    },
    onSuccess: () => {
      toast.success(editing ? "Fee item updated" : "Fee item added");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" aria-hidden />
            {editing ? "Edit fee item" : "Add fee item"}
          </DialogTitle>
          <DialogDescription>Fee charged per structure type and height band.</DialogDescription>
        </DialogHeader>
        <form id="fee-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fee-structure">Structure type</Label>
            <Controller
              control={control}
              name="structureType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="fee-structure" aria-invalid={!!formState.errors.structureType}>
                    <SelectValue placeholder="Select a structure type" />
                  </SelectTrigger>
                  <SelectContent>
                    {structureOptions.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No structure types defined
                      </SelectItem>
                    ) : (
                      structureOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {formState.errors.structureType && (
              <p className="text-sm text-destructive" role="alert">{formState.errors.structureType.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee-band">Height band (m)</Label>
            <Input id="fee-band" placeholder="e.g. 0-50, 50-150, 150+" aria-invalid={!!formState.errors.heightBandM} {...register("heightBandM")} />
            {formState.errors.heightBandM && (
              <p className="text-sm text-destructive" role="alert">{formState.errors.heightBandM.message}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fee-amount">Amount</Label>
              <Input
                id="fee-amount"
                type="number"
                step="any"
                inputMode="decimal"
                aria-invalid={!!formState.errors.amount}
                {...register("amount", { valueAsNumber: true })}
              />
              {formState.errors.amount && (
                <p className="text-sm text-destructive" role="alert">{formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-currency">Currency</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="fee-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <label className="flex items-center gap-3">
            <Switch checked={watch("active")} onCheckedChange={(v) => setValue("active", v)} />
            <span className="text-sm">Active</span>
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="fee-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
