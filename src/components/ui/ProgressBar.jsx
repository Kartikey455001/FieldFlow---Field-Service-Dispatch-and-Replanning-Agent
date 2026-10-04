import React from 'react';

/**
 * Reusable ProgressBar component with automatic threshold colors or explicit variant
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  variant,
  height = 'h-2',
  className = '',
}) {
  const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

  // Auto color by threshold if no variant explicitly provided
  const getAutoColor = () => {
    if (percentage >= 90) return 'bg-[#EF4444]'; // Danger near/at max
    if (percentage >= 70) return 'bg-[#F59E0B]'; // Warning
    return 'bg-[#4F46E5]'; // Primary
  };

  const variantColors = {
    primary: 'bg-[#4F46E5]',
    success: 'bg-[#10B981]',
    warning: 'bg-[#F59E0B]',
    danger: 'bg-[#EF4444]',
  };

  const barColor = variant ? variantColors[variant] || 'bg-[#4F46E5]' : getAutoColor();

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs text-[#6B7280] mb-1">
          <span>Workload</span>
          <span className="font-semibold text-[#172033]">{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${barColor} ${height} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
