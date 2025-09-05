import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generatePlayerId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function calculateScore(isCorrect: boolean, timeRemaining: number, totalTime: number): number {
  if (!isCorrect) return 0
  
  // Base score for correct answer
  const baseScore = 1000
  
  // Time bonus (up to 50% extra for quick answers)
  const timeBonus = Math.floor((timeRemaining / totalTime) * 500)
  
  return baseScore + timeBonus
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function getAnswerOptionClass(optionIndex: number): string {
  const classes = [
    'answer-option-a',
    'answer-option-b', 
    'answer-option-c',
    'answer-option-d'
  ]
  return classes[optionIndex] || 'answer-option-a'
}

export function getAnswerOptionLabel(optionIndex: number): string {
  return String.fromCharCode(65 + optionIndex) // A, B, C, D
}
