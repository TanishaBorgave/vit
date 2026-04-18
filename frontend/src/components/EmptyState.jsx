import { motion } from 'framer-motion';
import { FileX } from 'lucide-react';

export default function EmptyState({ icon: Icon = FileX, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-surface-400" />
      </div>
      <h3 className="text-lg font-semibold text-surface-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-surface-400 max-w-sm mb-6">{description}</p>
      )}
      {action && action}
    </motion.div>
  );
}
