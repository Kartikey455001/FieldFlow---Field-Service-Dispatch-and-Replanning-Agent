import React from 'react';

/**
 * Reusable Avatar component for dispatchers and technicians
 */
export default function Avatar({
  name = 'User',
  initials,
  src,
  size = 'md',
  status,
  className = '',
}) {
  const getInitials = (n) => {
    if (initials) return initials;
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base',
  };

  const statusDotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const statusColors = {
    available: 'bg-[#10B981]',
    busy: 'bg-[#F59E0B]',
    unavailable: 'bg-[#EF4444]',
    offline: 'bg-gray-400',
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeStyles[size] || sizeStyles.md} rounded-full object-cover border border-gray-200`}
        />
      ) : (
        <div
          className={`${
            sizeStyles[size] || sizeStyles.md
          } rounded-full bg-[#10213F] text-white font-semibold flex items-center justify-center border border-gray-200/50 shadow-sm`}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 ${
            statusDotSizes[size] || statusDotSizes.md
          } rounded-full border-2 border-white ${
            statusColors[status.toLowerCase()] || statusColors.offline
          }`}
          title={status}
        />
      )}
    </div>
  );
}
