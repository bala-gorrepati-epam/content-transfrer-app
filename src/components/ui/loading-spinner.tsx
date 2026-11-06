import { cn } from "@/src/lib/utils";

// Ring spinner drawn with CSS: a faint full ring with one coloured arc that rotates. Uses theme
// colours, so it follows light and dark mode, and needs no image file.
export function LoadingSpinner({ label, className }: { label: string; className?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary",
        className,
      )}
    />
  );
}
