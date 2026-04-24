"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "relative inline-flex items-center justify-center rounded-md font-medium tracking-tight transition-all duration-150 aurora-focus disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]"

    const variants = {
      default:
        "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] bg-white/[0.02] hover:bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--aurora-rim)] hover:shadow-[inset_0_0_0_1px_var(--aurora-rim-bright)]",
      primary:
        "text-[#050608] shadow-[0_0_22px_-6px_rgba(94,234,212,0.45)] hover:shadow-[0_0_28px_-4px_rgba(94,234,212,0.6)]",
      secondary:
        "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] bg-white/[0.02] hover:bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--aurora-rim)]",
      ghost:
        "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] hover:bg-white/[0.03]",
      outline:
        "text-[var(--aurora-text-secondary)] hover:text-[var(--aurora-text)] shadow-[inset_0_0_0_1px_var(--aurora-rim)] hover:shadow-[inset_0_0_0_1px_var(--aurora-rim-bright)]",
    }

    const sizes = {
      default: "h-10 px-4 text-[13px]",
      sm: "h-8 px-3 text-[12px]",
      lg: "h-11 px-6 text-[14px]",
      icon: "h-9 w-9",
    }

    const primaryStyle =
      variant === "primary"
        ? { background: "var(--aurora-gradient)" }
        : undefined

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        style={primaryStyle}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }
