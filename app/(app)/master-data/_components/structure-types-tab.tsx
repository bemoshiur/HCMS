"use client";

// Master data → Structure Types tab: DataTable + add/edit/delete dialogs.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { fetchJson, jsonBody, type StructureTypeRow } from "./types";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  nameBn: z.string().trim().max(120).optional(),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function StructureTypesTab() {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StructureTypeRow | null>(null);
  const [deleting, setDeleting] = React.useState<StructureTypeRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["md-structure-types"],
    queryFn: () => fetchJson<{ items: StructureTypeRow[] }>("/api/master-data/structure-types"),
  });
  const items = data?.items ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["md-structure-types"] });

  const toggleMutation = useMutation({
    mutationFn: (row: StructureTypeRow) =>
      fetchJson(`/api/master-data/structure-types/${row.id}`, {
        ...jsonBody({ active: !row.active }),
        method: "PATCH",
      }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/master-data/structure-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Structure type deleted");
      invalidate();
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const columns = React.useMemo<ColumnDef<StructureTypeRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        accessorKey: "nameBn",
        header: "Name (Bangla)",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.nameBn ?? "—"}</span>
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
              aria-label={`Toggle ${row.original.name}`}
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
              <Button variant="ghost" size="icon-sm" aria-label={`${t("common.actions")} — ${row.original.name}`}>
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
      <DataTable<StructureTypeRow>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder="Search structure types…"
        initialSorting={[{ id: "name", desc: false }]}
        emptyTitle="No structure types"
        emptyDescription="Define the structure categories applicants choose from."
        emptyAction={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add structure type
          </Button>
        }
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add structure type
          </Button>
        }
        exportCsv={{
          filename: "caab-structure-types.csv",
          headers: ["Name", "Name (Bangla)", "Active"],
          row: (i) => [i.name, i.nameBn ?? "", i.active ? "Yes" : "No"],
        }}
      />

      <StructureTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete structure type?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.name}&rdquo; will be removed. Existing applications keep their
              recorded structure type. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
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

function StructureTypeDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: StructureTypeRow | null;
  onSaved: () => void;
}) {
  const t = useT();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", nameBn: "", active: true },
  });
  const { register, formState, setValue, watch } = form;

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        nameBn: editing?.nameBn ?? "",
        active: editing?.active ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { name: values.name, nameBn: values.nameBn?.trim() || undefined, active: values.active };
      return editing
        ? fetchJson(`/api/master-data/structure-types/${editing.id}`, {
            ...jsonBody(payload),
            method: "PATCH",
          })
        : fetchJson("/api/master-data/structure-types", jsonBody(payload));
    },
    onSuccess: () => {
      toast.success(editing ? "Structure type updated" : "Structure type added");
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
            <Shapes className="size-5 text-primary" aria-hidden />
            {editing ? "Edit structure type" : "Add structure type"}
          </DialogTitle>
          <DialogDescription>
            Structure categories drive fee bands and appear in the applicant form.
          </DialogDescription>
        </DialogHeader>
        <form
          id="structure-type-form"
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="st-name">Name</Label>
            <Input id="st-name" placeholder="e.g. Telecom Tower" aria-invalid={!!formState.errors.name} {...register("name")} />
            {formState.errors.name && (
              <p className="text-sm text-destructive" role="alert">{formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-name-bn">
              Name (Bangla) <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input id="st-name-bn" placeholder="যেমন টেলিকম টাওয়ার" {...register("nameBn")} />
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
          <Button type="submit" form="structure-type-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
