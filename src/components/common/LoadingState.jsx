import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable LoadingState component
 */
export default function LoadingState({
  message = 'Loading data...',
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}
      role="status"
    >
      <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mb-3" />
      <p className="text-xs font-medium text-[#6B7280]">{message}</p>
    </div>
  );
}
