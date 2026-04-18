export function Skeleton({ className = '', height = '20px', width = '100%' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, width }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 space-y-3">
      <Skeleton height="12px" width="40%" />
      <Skeleton height="28px" width="60%" />
      <Skeleton height="12px" width="30%" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-surface-100">
        <Skeleton height="16px" width="200px" />
      </div>
      <div className="divide-y divide-surface-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton height="14px" width="15%" />
            <Skeleton height="14px" width="20%" />
            <Skeleton height="14px" width="12%" />
            <Skeleton height="14px" width="12%" />
            <Skeleton height="24px" width="80px" />
            <Skeleton height="14px" width="10%" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6">
      <Skeleton height="16px" width="150px" className="mb-6" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            height={`${30 + Math.random() * 70}%`}
            width="100%"
          />
        ))}
      </div>
    </div>
  );
}
