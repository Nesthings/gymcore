'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  className,
  ariaLabel = 'Código de verificación',
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.split('').slice(0, length)

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  const setDigitAt = (idx: number, digit: string) => {
    const cleaned = digit.replace(/\D/g, '').slice(0, 1)
    const next = digits.slice()
    next[idx] = cleaned
    onChange(next.join(''))
    if (cleaned && idx < length - 1) refs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        const next = digits.slice()
        next[idx] = ''
        onChange(next.join(''))
      } else if (idx > 0) {
        const next = digits.slice()
        next[idx - 1] = ''
        onChange(next.join(''))
        refs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
    }
  }

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={2}
          value={digits[i] ?? ''}
          onChange={(e) => setDigitAt(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
            onChange(text)
            const target = Math.min(text.length, length - 1)
            refs.current[target]?.focus()
          }}
          disabled={disabled}
          aria-label={`${ariaLabel} dígito ${i + 1}`}
          className={cn(
            'h-14 w-11 rounded-xl border border-input bg-background text-center text-2xl font-bold text-foreground shadow-xs outline-none transition-all',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'placeholder:text-muted-foreground',
            disabled && 'opacity-50',
          )}
        />
      ))}
    </div>
  )
}