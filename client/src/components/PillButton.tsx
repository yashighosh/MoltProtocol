import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "dark" | "light" | "ghost";
  disabled?: boolean;
};

export function PillButton({ children, to, href, onClick, type = "button", variant = "dark", disabled }: Props) {
  const className = `pill ${variant === "dark" ? "" : variant}`.trim();
  if (to) return <Link className={className} to={to}>{children}</Link>;
  if (href) return <a className={className} href={href}>{children}</a>;
  return <button className={className} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}
