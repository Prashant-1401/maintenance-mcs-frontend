const COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  ATTENDED: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
  OPERATIONAL: 'bg-green-100 text-green-800',
  DOWN: 'bg-red-100 text-red-800',
  UNDER_MAINTENANCE: 'bg-amber-100 text-amber-800',
  RETIRED: 'bg-gray-200 text-gray-700',
  NORMAL: 'bg-green-100 text-green-800',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  NOT_DONE: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-200 text-gray-700',
  FINAL: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: string }) {
  const classes = COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
