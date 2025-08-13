import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date utilities
export function formatDate(date: string | Date, formatStr: string = 'yyyy/MM/dd') {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr, { locale: ja })
}

export function formatDateTime(date: string | Date, formatStr: string = 'yyyy/MM/dd HH:mm') {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr, { locale: ja })
}

export function calculateDaysFromToday(targetDate: string | Date): number {
  const dateObj = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate
  return differenceInDays(dateObj, new Date())
}

// Progress calculation
export function calculateProgress(startDate: string, endDate: string): number {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const today = new Date()
  
  const totalDays = differenceInDays(end, start)
  const elapsedDays = differenceInDays(today, start)
  
  if (elapsedDays <= 0) return 0
  if (elapsedDays >= totalDays) return 100
  
  return Math.round((elapsedDays / totalDays) * 100)
}

// File utilities
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
}

export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  return imageExtensions.includes(getFileExtension(filename))
}

// Form utilities
export function createFormData(data: Record<string, any>): FormData {
  const formData = new FormData()
  
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item instanceof File) {
          formData.append(`${key}[${index}]`, item)
        } else {
          formData.append(`${key}[${index}]`, String(item))
        }
      })
    } else if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })
  
  return formData
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8
}

// Chart data utilities
export function generateRandomColor(): string {
  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
    '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Error handling utilities
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}