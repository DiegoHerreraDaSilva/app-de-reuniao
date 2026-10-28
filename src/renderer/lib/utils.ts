import { clsx, type ClassValue } from 'clsx'
import type { CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export type CardTone = 'brand' | 'ok' | 'warn' | 'bad'

// O contorno aceso de baixo do card assume a cor do estado.
export function toneVars(tone: CardTone = 'brand'): CSSProperties {
  if (tone === 'brand') return {}
  const v = `var(--${tone})`
  return {
    '--card-accent': v,
    '--card-accent-hi': v,
    '--card-glow': `color-mix(in srgb, ${v} 40%, transparent)`
  } as CSSProperties
}

export const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
