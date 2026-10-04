import React from 'react';

/**
 * Reusable Button component with multiple variants and sizes
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-4 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#4F46E5] text-white hover:bg-[#4338CA] active:bg-[#3730A3] focus:ring-[#4F46E5]/40 shadow-sm',
    secondary:
      'bg-white text-[#172033] border border-gray-200 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-300 shadow-sm',
    danger:
      'bg-[#EF4444] text-white hover:bg-red-600 active:bg-red-700 focus:ring-[#EF4444]/40 shadow-sm',
    success:
      'bg-[#10B981] text-white hover:bg-emerald-600 active:bg-emerald-700 focus:ring-[#10B981]/40 shadow-sm',
    ghost:
      'bg-transparent text-[#6B7280] hover:text-[#172033] hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-200',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
    </button>
  );
}
