import { Link, useLocation } from "react-router-dom";
import { setTravel } from "../travel";

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const location = useLocation();
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className={item.to && index > 0 ? "crumb-project" : undefined}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          {item.to ? <Link viewTransition to={item.to} onClick={() => setTravel(location.pathname, item.to ?? "")}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
