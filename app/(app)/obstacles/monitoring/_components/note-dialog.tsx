"use client";

// Append a timestamped monitoring note to an obstacle's remarks (PATCH).
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, NotebookPen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/components/providers";
import { fetchJson, type ObstacleRow } from "../../_components/types";

const schema = z.object({
  note: z.string().trim().min(5, "Enter the note (at least 5 characters)").max(1500),
});

type FormValues = z.infer<typeof schema>;

export function NoteDialog({
  obstacle,
  onOpenChange,
}: {
  obstacle: ObstacleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { note: "" },
  });

  React.useEffect(() => {
    if (obstacle) form.reset({ note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obstacle?.id]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const stamped = `[${formatDateTime(new Date())}] ${values.note}`;
      const remarks = obstacle!.remarks ? `${obstacle!.remarks}\n${stamped}` : stamped;
      return fetchJson<{ obstacle: ObstacleRow }>(`/api/obstacles/${obstacle!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks }),
      });
    },
    onSuccess: (data) => {
      toast.success("Note logged", {
        description: `Added to ${data.obstacle.name ?? data.obstacle.structureType}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

  return (
    <Dialog
      open={obstacle !== null}
      onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="size-5 text-primary" aria-hidden />
            Log monitoring note
          </DialogTitle>
          <DialogDescription>
            The note is appended to the obstacle&apos;s remarks with a timestamp and recorded
            in the audit trail.
          </DialogDescription>
        </DialogHeader>

        {obstacle && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-0.5">
            <p className="font-medium">{obstacle.name ?? obstacle.structureType}</p>
            <p className="text-muted-foreground">
              {obstacle.structureType} · {obstacle.airport.icao} — {obstacle.airport.name}
            </p>
          </div>
        )}

        <form
          id="obstacle-note-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-2"
        >
          <Label htmlFor="obstacle-note">Note</Label>
          <Textarea
            id="obstacle-note"
            rows={3}
            placeholder="Field observation, complainant follow-up, enforcement update…"
            aria-invalid={!!form.formState.errors.note}
            {...form.register("note")}
          />
          {form.formState.errors.note && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.note.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="obstacle-note-form"
            disabled={!form.formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : "Log note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
