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
        "flex h-10 w-full rounded-md bg-white/[0.02] px-3.5 py-2 text-[13px] text-[var(--aurora-text)] placeholder:text-[var(--aurora-text-tertiary)] placeholder:font-display-italic outline-none shadow-[inset_0_0_0_1px_var(--aurora-rim)] transition-all duration-200 focus:shadow-[inset_0_0_0_1px_rgba(77,184,164,0.3),0_0_16px_-6px_var(--aurora-accent-interactive-glow),0_0_16px_-6px_var(--aurora-secondary-glow)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = "Input"

export { Input }
