import type { ReactNode } from "react";
export function PageHeading({
  kicker,
  title,
  children,
  aside,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        <p className="page-intro">{children}</p>
      </div>
      {aside}
    </div>
  );
}
export function LoadingCards() {
  return (
    <div className="catalog-grid" role="status" aria-label="Loading games">
      <span className="sr-only">Loading games…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card-skeleton">
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
