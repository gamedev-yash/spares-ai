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
