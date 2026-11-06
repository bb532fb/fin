import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}

export function Card({ children, className = "", as: Tag = "section" }: CardProps) {
  return (
    <Tag
      className={`rounded-2xl border border-border/90 bg-surface-glass shadow-xl shadow-black/30 backdrop-blur-md glow-ring ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>;
}
