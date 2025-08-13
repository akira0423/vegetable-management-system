import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}
