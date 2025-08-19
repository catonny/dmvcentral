

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalizeWords(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function cleanUndefined<T extends object>(data: T): Partial<T> {
  const cleanedData: Partial<T> = {};
  for (const key in data) {
    if (data[key as keyof T] !== undefined) {
      cleanedData[key as keyof T] = data[key as keyof T];
    }
  }
  return cleanedData;
};
