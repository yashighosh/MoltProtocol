import { EmptyState } from "./EmptyState";

export function PendingData({ title }: { title: string }) {
  return (
    <EmptyState title={title}>
      The screen is ready. Records will appear after the database is connected. Nothing on this page is estimated.
    </EmptyState>
  );
}
