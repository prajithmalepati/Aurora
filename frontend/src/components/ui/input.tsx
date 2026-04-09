"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--aurora-border)] bg-[var(--aurora-bg)] px-3 py-2 text-sm text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--aurora-teal)] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = "Input"

export { Input }