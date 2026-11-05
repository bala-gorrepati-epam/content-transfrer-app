import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn helper: merges Tailwind classes so later classes override earlier ones.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
