import React from 'react';

/**
 * Reusable Input component with optional icon, label, and error state
 */
export default function Input({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  icon: Icon,
  error,
  helperText,
  className = '',
  disabled = false,
  required = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[#172033] mb-1.5"
        >
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full rounded-lg border text-sm transition-colors duration-150 py-2 ${
            Icon ? 'pl-9 pr-3' : 'px-3'
          } ${
            error
              ? 'border-[#EF4444] text-[#172033] focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444]'
              : 'border-gray-200 text-[#172033] placeholder-gray-400 focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]'
          } ${
            disabled ? 'bg-gray-50 cursor-not-allowed opacity-75' : 'bg-white'
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
      {!error && helperText && (
        <p className="mt-1 text-xs text-[#6B7280]">{helperText}</p>
      )}
    </div>
  );
}
