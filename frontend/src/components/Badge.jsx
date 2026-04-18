import clsx from 'clsx';

const variants = {
  MATCHED: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  MISMATCH: { bg: 'bg-danger-100 text-danger-700', dot: 'bg-danger-500' },
  MISSING_IN_2B: { bg: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500' },
  MISSING_IN_BOOKS: { bg: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500' },
  OPEN: { bg: 'bg-danger-100 text-danger-700', dot: 'bg-danger-500' },
  FOLLOWED_UP: { bg: 'bg-info-100 text-info-700', dot: 'bg-info-500' },
  RESOLVED: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  IGNORED: { bg: 'bg-surface-200 text-surface-600', dot: 'bg-surface-400' },
  HIGH: { bg: 'bg-danger-100 text-danger-700', dot: 'bg-danger-500' },
  MEDIUM: { bg: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500' },
  LOW: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  // Phase 2 statuses
  VALID: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  WARNING: { bg: 'bg-warning-100 text-warning-700', dot: 'bg-warning-500' },
  ERROR: { bg: 'bg-danger-100 text-danger-700', dot: 'bg-danger-500' },
  DRAFT: { bg: 'bg-surface-200 text-surface-600', dot: 'bg-surface-400' },
  VALIDATED: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  EXPORTED: { bg: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500' },
  FILED: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  READY: { bg: 'bg-success-100 text-success-700', dot: 'bg-success-500' },
  GENERATING: { bg: 'bg-info-100 text-info-700', dot: 'bg-info-500' },
  GSTR1_EXCEL: { bg: 'bg-primary-100 text-primary-700', dot: 'bg-primary-500' },
  GSTR3B_EXCEL: { bg: 'bg-info-100 text-info-700', dot: 'bg-info-500' },
};

const displayText = {
  MATCHED: 'Matched',
  MISMATCH: 'Mismatch',
  MISSING_IN_2B: 'Missing in 2B',
  MISSING_IN_BOOKS: 'Missing in Books',
  OPEN: 'Open',
  FOLLOWED_UP: 'Followed Up',
  RESOLVED: 'Resolved',
  IGNORED: 'Ignored',
  HIGH: 'High Risk',
  MEDIUM: 'Medium Risk',
  LOW: 'Low Risk',
  // Phase 2
  VALID: 'Valid',
  WARNING: 'Warning',
  ERROR: 'Error',
  DRAFT: 'Draft',
  VALIDATED: 'Validated',
  EXPORTED: 'Exported',
  FILED: 'Filed',
  READY: 'Ready',
  GENERATING: 'Generating...',
  GSTR1_EXCEL: 'GSTR-1',
  GSTR3B_EXCEL: 'GSTR-3B',
};

export default function Badge({ status, className }) {
  const variant = variants[status] || variants.OPEN;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
        variant.bg,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', variant.dot)} />
      {displayText[status] || status}
    </span>
  );
}
