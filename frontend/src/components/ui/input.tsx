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
        "aurora-focus flex h-10 w-full rounded-md bg-white/[0.02] px-3.5 py-2 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic shadow-[inset_0_0_0_1px_var(--aurora-rim)] transition-[box-shadow,opacity] duration-200 focus-visible:shadow-[inset_0_0_0_1px_rgba(45,212,191,0.35),0_0_16px_-6px_var(--aurora-accent-interactive-glow),0_0_16px_-6px_var(--aurora-secondary-glow)] disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = "Input"

export { Input }
