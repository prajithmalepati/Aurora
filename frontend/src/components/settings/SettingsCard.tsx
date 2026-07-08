import type { CSSProperties, ReactNode } from "react"

interface SettingsCardProps {
  label: string
  title: string
  description?: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function SettingsCard({ label, title, description, children, className, style }: SettingsCardProps) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className ?? ""}`}
      style={{
        background: "var(--aurora-surface)",
        border: "1px solid var(--aurora-rim)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      <div className="px-5 py-4 border-b border-[var(--aurora-rim)]">
        <p className="label-micro text-[10px] tracking-[0.2em] text-[var(--aurora-text-tertiary)] mb-1">
          {label}
        </p>
        <p className="text-[15px] text-[var(--aurora-text)] font-medium">{title}</p>
        {description && (
          <p className="text-[12px] text-[var(--aurora-text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
