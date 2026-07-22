import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a number as South African Rand: "R 38,500" (no decimals). */
export function formatZAR(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-US")}`
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Formats a Date as "14 Mar 2026". */
export function formatDateDMY(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Formats a Date as "10:23 AM". */
export function formatTime12h(date: Date): string {
  const hours24 = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours24 >= 12 ? "PM" : "AM"
  const hours = hours24 % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

/** Formats a number as compact ZAR for chart axes: "R150k", "R1.3M". */
export function formatZARCompact(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) {
    return `R${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (abs >= 1_000) {
    return `R${Math.round(amount / 1000)}k`
  }
  return `R${amount}`
}

function toCsvField(value: string | number): string {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Builds a CSV from headers + rows and triggers a browser download. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const csv = [headers, ...rows]
    .map((row) => row.map(toCsvField).join(","))
    .join("\r\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
