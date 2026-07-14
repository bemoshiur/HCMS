"use client";

// User / role management (brief §17) — ADMIN only. Stat cards, filters,
// data table with inline active toggle, add/edit/reset-password/delete.
import * as React from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  UserX,
} from "lucide-react";
import { PageTransition, Stagger, SkeletonSwap } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useT } from "@/components/providers";
import { formatDate } from "@/lib/format";
import {
  ALL_ROLES,
  fetchJson,
  jsonBody,
  ROLE_LABELS,
  type UserRow,
  type UsersPayload,
} from "./types";
import { UserDialog } from "./user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export function UsersClient() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const selfId = session?.user?.id;

  const [roleFilter, setRoleFilter] = React.useState("all");
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [resetting, setResetting] = React.useState<UserRow | null>(null);
  const [deleting, setDeleting] = React.useState<UserRow | null>(null);

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (activeFilter !== "all") params.set("active", activeFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [roleFilter, activeFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["users", roleFilter, activeFilter],
    queryFn: () => fetchJson<UsersPayload>(`/api/users${queryString}`),
  });
  const items = data?.items ?? [];
  const stats = data?.stats;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const toggleMutation = useMutation({
    mutationFn: (row: UserRow) =>
      fetchJson(`/api/users/${row.id}`, jsonBody({ active: !row.active }, "PATCH")),
    onSuccess: (_d, row) => {
      toast.success(row.active ? `${row.name} deactivated` : `${row.name} activated`);
      invalidate();
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      invalidate();
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Cannot delete user", { description: e.message }),
  });

  const rolesInUse = React.useMemo(
    () => ALL_ROLES.filter((r) => (stats?.byRole?.[r] ?? 0) > 0),
    [stats]
  );

  const columns = React.useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-64">
            <p className="flex items-center gap-1.5 truncate font-medium">
              {row.original.name}
              {row.original.id === selfId && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">You</Badge>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">{ROLE_LABELS[row.original.role]}</Badge>
        ),
      },
      {
        id: "org",
        accessorFn: (r) => r.org?.name ?? "",
        header: "Organization",
        cell: ({ row }) =>
          row.original.org ? (
            <span className="truncate">{row.original.org.name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "jurisdiction",
        header: "Jurisdiction",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.jurisdiction ?? "—"}</span>
        ),
      },
      {
        accessorKey: "active",
        header: t("common.status"),
        cell: ({ row }) => {
          const isSelf = row.original.id === selfId;
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={row.original.active}
                disabled={isSelf || toggleMutation.isPending}
                onCheckedChange={() => toggleMutation.mutate(row.original)}
                aria-label={`Toggle ${row.original.name}`}
              />
              <StatusBadge status={row.original.active ? "APPROVED" : "EXPIRED"} showDot={false} />
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        size: 48,
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        cell: ({ row }) => {
          const u = row.original;
          const isSelf = u.id === selfId;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`${t("common.actions")} — ${u.name}`}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-52 truncate text-xs">{u.name}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => { setEditing(u); setDialogOpen(true); }}>
                  <Pencil aria-hidden />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setResetting(u)}>
                  <KeyRound aria-hidden />
                  Reset password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isSelf || toggleMutation.isPending}
                  onSelect={() => toggleMutation.mutate(u)}
                >
                  {u.active ? <UserX aria-hidden /> : <ShieldCheck aria-hidden />}
                  {u.active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isSelf}
                  onSelect={() => setDeleting(u)}
                >
                  <Trash2 aria-hidden />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [t, selfId, toggleMutation]
  );

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.users") }]}
        title={t("nav.users")}
        description="Manage accounts, roles and organization membership. Deactivate rather than delete to preserve the audit trail."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" aria-hidden />
            Add user
          </Button>
        }
      />

      <SkeletonSwap
        loading={isLoading}
        skeleton={
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <Stagger className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={stats?.total ?? 0} icon={UserRound} />
          <StatCard label="Active" value={stats?.active ?? 0} icon={ShieldCheck} tone="success" />
          <StatCard label="Inactive" value={stats?.inactive ?? 0} icon={UserX} tone="warning" />
          <StatCard label="Roles in use" value={rolesInUse.length} icon={UserCog} tone="info" />
        </Stagger>
      </SkeletonSwap>

      {/* Role distribution */}
      {!isLoading && stats && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {ALL_ROLES.map((r) => (
            <Badge key={r} variant="secondary" className="font-normal">
              {ROLE_LABELS[r]}
              <span className="ml-1 tabular-nums font-medium text-foreground">{stats.byRole[r] ?? 0}</span>
            </Badge>
          ))}
        </div>
      )}

      <DataTable<UserRow>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder="Search — name, email, org…"
        initialSorting={[{ id: "createdAt", desc: true }]}
        emptyTitle="No users match"
        emptyDescription="Adjust the filters or add a new user."
        emptyAction={
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" aria-hidden />
            Add user
          </Button>
        }
        toolbar={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-44" aria-label="Role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")} — roles</SelectItem>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="h-9 w-36" aria-label={t("common.status")}>
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")} — status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        exportCsv={{
          filename: "caab-users.csv",
          headers: ["Name", "Email", "Role", "Organization", "Jurisdiction", "Active", "Created"],
          row: (u) => [
            u.name,
            u.email,
            ROLE_LABELS[u.role],
            u.org?.name ?? "",
            u.jurisdiction ?? "",
            u.active ? "Yes" : "No",
            u.createdAt,
          ],
        }}
      />

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        orgs={data?.orgs ?? []}
        onSaved={invalidate}
      />
      <ResetPasswordDialog user={resetting} onOpenChange={(o) => !o && setResetting(null)} onDone={invalidate} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hard-deletes the account. If it is linked to any case records, deletion is blocked —
              deactivate it instead to keep the audit trail intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
