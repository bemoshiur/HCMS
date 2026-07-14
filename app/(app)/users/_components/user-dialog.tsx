"use client";

// Add / edit a user. Create hashes the password server-side (default Demo@1234).
// Edit updates name/role/org/jurisdiction/phone/active (email & password are
// managed separately — password via the reset dialog).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useT } from "@/components/providers";
import {
  ALL_ROLES,
  DEMO_PASSWORD,
  fetchJson,
  jsonBody,
  ROLE_LABELS,
  type OrgOption,
  type Role,
  type UserRow,
} from "./types";

const ROLE_VALUES = ALL_ROLES as [Role, ...Role[]];
const NO_ORG = "none";

type FormValues = {
  name: string;
  email: string;
  role: Role;
  orgId: string;
  jurisdiction: string;
  phone: string;
  password: string;
  active: boolean;
};

export function UserDialog({
  open,
  onOpenChange,
  editing,
  orgs,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: UserRow | null;
  orgs: OrgOption[];
  onSaved: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const isEdit = !!editing;

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, "Name is required").max(120),
        email: isEdit
          ? z.string().optional()
          : z.string().trim().toLowerCase().email("Enter a valid email").max(160),
        role: z.enum(ROLE_VALUES),
        orgId: z.string(),
        jurisdiction: z.string().trim().max(120).optional(),
        phone: z.string().trim().max(40).optional(),
        password: isEdit
          ? z.string().optional()
          : z.string().min(6, "At least 6 characters").max(72),
        active: z.boolean(),
      }),
    [isEdit]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      role: "APPLICANT",
      orgId: NO_ORG,
      jurisdiction: "",
      phone: "",
      password: DEMO_PASSWORD,
      active: true,
    },
  });
  const { register, control, formState, watch, setValue } = form;

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        email: editing?.email ?? "",
        role: editing?.role ?? "APPLICANT",
        orgId: editing?.orgId ?? NO_ORG,
        jurisdiction: editing?.jurisdiction ?? "",
        phone: editing?.phone ?? "",
        password: DEMO_PASSWORD,
        active: editing?.active ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const orgId = values.orgId === NO_ORG ? null : values.orgId;
      if (editing) {
        return fetchJson(
          `/api/users/${editing.id}`,
          jsonBody(
            {
              name: values.name,
              role: values.role,
              orgId,
              jurisdiction: values.jurisdiction?.trim() || null,
              phone: values.phone?.trim() || null,
              active: values.active,
            },
            "PATCH"
          )
        );
      }
      return fetchJson(
        "/api/users",
        jsonBody({
          name: values.name,
          email: values.email,
          role: values.role,
          orgId,
          jurisdiction: values.jurisdiction?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          password: values.password,
        })
      );
    },
    onSuccess: () => {
      toast.success(editing ? "User updated" : "User created");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const err = (name: keyof FormValues) =>
    formState.errors[name] ? (
      <p className="text-sm text-destructive" role="alert">{formState.errors[name]?.message as string}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" aria-hidden />
            {editing ? "Edit user" : "Add user"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update role, organization and access. Use “Reset password” to change credentials."
              : "Create an account. The password is hashed server-side."}
          </DialogDescription>
        </DialogHeader>

        <form id="user-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" aria-invalid={!!formState.errors.name} {...register("name")} />
              {err("name")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                disabled={isEdit}
                aria-invalid={!!formState.errors.email}
                {...register("email")}
              />
              {isEdit ? (
                <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
              ) : (
                err("email")
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="u-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-org">Organization</Label>
              <Controller
                control={control}
                name="orgId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="u-org">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ORG}>No organization</SelectItem>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                          <span className="ml-1 text-muted-foreground">({o.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-jurisdiction">
                Jurisdiction <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="u-jurisdiction" placeholder="e.g. Dhaka" {...register("jurisdiction")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-phone">
                Phone <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="u-phone" placeholder="+8801…" {...register("phone")} />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="u-password">Password</Label>
              <Input id="u-password" type="text" aria-invalid={!!formState.errors.password} {...register("password")} />
              {err("password") ?? (
                <p className="text-xs text-muted-foreground">
                  Defaults to <span className="font-mono">{DEMO_PASSWORD}</span> for demo accounts — the user can change it later.
                </p>
              )}
            </div>
          )}

          {isEdit && (
            <label className="flex items-center gap-3">
              <Switch checked={watch("active")} onCheckedChange={(v) => setValue("active", v)} />
              <span className="text-sm">Active</span>
            </label>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="user-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : editing ? t("common.save") : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
