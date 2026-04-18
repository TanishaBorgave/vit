import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'primary', delay = 0, trend }) {
  const colorMap = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'bg-primary-500/10 text-primary-500',
      border: 'border-primary-100',
      value: 'text-primary-700',
    },
    success: {
      bg: 'bg-success-50',
      icon: 'bg-success-500/10 text-success-600',
      border: 'border-success-100',
      value: 'text-success-700',
    },
    danger: {
      bg: 'bg-danger-50',
      icon: 'bg-danger-500/10 text-danger-500',
      border: 'border-danger-100',
      value: 'text-danger-700',
    },
    warning: {
      bg: 'bg-warning-50',
      icon: 'bg-warning-500/10 text-warning-600',
      border: 'border-warning-100',
      value: 'text-warning-600',
    },
    info: {
      bg: 'bg-info-50',
      icon: 'bg-info-500/10 text-info-500',
      border: 'border-info-100',
      value: 'text-info-700',
    },
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
        'bg-white',
        colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-surface-400 mb-1">{title}</p>
          <p className={clsx('text-2xl font-bold', colors.value)}>{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-400 mt-1.5">{subtitle}</p>
          )}
          {trend && (
            <p className={clsx(
              'text-xs font-medium mt-2 flex items-center gap-1',
              trend > 0 ? 'text-success-600' : 'text-danger-500'
            )}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', colors.icon)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {/* Decorative gradient */}
      <div className={clsx('absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.04]', `bg-current ${colors.value}`)} />
    </motion.div>
  );
}
