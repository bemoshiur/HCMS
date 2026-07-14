"use client";

// Reset a user's password (PATCH /api/users/[id] with a new password → re-hashed).
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
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
import { useT } from "@/components/providers";
import { DEMO_PASSWORD, fetchJson, jsonBody, type UserRow } from "./types";

const schema = z.object({
  password: z.string().min(6, "At least 6 characters").max(72),
});
type FormValues = z.infer<typeof schema>;

export function ResetPasswordDialog({
  user,
  onOpenChange,
  onDone,
}: {
  user: UserRow | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const t = useT();
  const open = user != null;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { password: DEMO_PASSWORD },
  });
  const { register, formState } = form;

  React.useEffect(() => {
    if (open) form.reset({ password: DEMO_PASSWORD });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson(`/api/users/${user!.id}`, jsonBody({ password: values.password }, "PATCH")),
    onSuccess: () => {
      toast.success(`Password reset for ${user?.name}`);
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            Reset password
          </DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-medium">{user?.name}</span>. It is hashed server-side.
          </DialogDescription>
        </DialogHeader>
        <form id="reset-password-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <Input id="rp-password" type="text" aria-invalid={!!formState.errors.password} {...register("password")} />
            {formState.errors.password ? (
              <p className="text-sm text-destructive" role="alert">{formState.errors.password.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Prefilled with the demo default <span className="font-mono">{DEMO_PASSWORD}</span>.
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="reset-password-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
