import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = () => [...(root?.querySelectorAll<HTMLElement>("button, input, textarea, select") ?? [])];
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelRef.current();
      if (event.key !== "Tab" || !root) return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop">
      <div className="dialog stack" role="dialog" aria-modal="true" aria-labelledby="confirm-title" ref={ref}>
        <h2 id="confirm-title">{title}</h2>
        {children}
        <div className="row">
          <button type="button" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
