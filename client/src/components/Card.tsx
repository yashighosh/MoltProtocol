import type { ReactNode } from "react";

export function Card({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <article className={`card ${dark ? "dark" : ""} ${className}`.trim()}>{children}</article>;
}
