import React from 'react';
import Button from '../ui/Button';

/**
 * Reusable EmptyState component for lists, search results, and filters
 */
export default function EmptyState({
  icon: Icon,
  title = 'No items found',
  description = 'There are no records matching your current criteria.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-xl border border-dashed border-gray-200 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3 border border-gray-100">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h4 className="text-base font-medium text-[#172033] mb-1">{title}</h4>
      <p className="text-xs text-[#6B7280] max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
