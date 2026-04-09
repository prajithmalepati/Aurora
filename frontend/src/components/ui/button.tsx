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
      "inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--aurora-teal)] focus:ring-offset-2 focus:ring-offset-[var(--aurora-bg)] disabled:opacity-50 disabled:pointer-events-none"

    const variants = {
      default:
        "bg-[var(--aurora-bg-surface)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg-hover)] border border-[var(--aurora-border)]",
      primary:
        "bg-[var(--aurora-teal)] text-white hover:bg-opacity-90 focus:ring-[var(--aurora-teal)]",
      secondary:
        "bg-[var(--aurora-bg-hover)] text-[var(--aurora-text)] hover:bg-opacity-80 border border-[var(--aurora-border)]",
      ghost:
        "text-[var(--aurora-text)] hover:bg-[var(--aurora-bg-hover)]",
      outline:
        "border border-[var(--aurora-border)] text-[var(--aurora-text)] hover:bg-[var(--aurora-bg-hover)]",
    }

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10",
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }