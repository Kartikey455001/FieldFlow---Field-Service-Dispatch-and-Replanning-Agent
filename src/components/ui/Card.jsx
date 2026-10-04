import React from 'react';

/**
 * Reusable Card component with clean borders and soft shadow
 */
export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'p-5',
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200/80 shadow-sm ${
        hoverable
          ? 'hover:border-gray-300 hover:shadow-md transition-all duration-150 cursor-pointer'
          : ''
      } ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
  children,
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 pb-4 border-b border-gray-100 mb-4 ${className}`}
    >
      <div>
        {title && (
          <h3 className="text-base font-semibold text-[#172033] tracking-tight">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
