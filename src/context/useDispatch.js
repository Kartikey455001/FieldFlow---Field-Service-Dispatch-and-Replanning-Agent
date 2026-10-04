import { useContext } from 'react';
import { DispatchContext } from './context';

/**
 * Custom hook to consume the FieldFlow DispatchContext
 */
export function useDispatch() {
  const context = useContext(DispatchContext);
  if (!context) {
    throw new Error('useDispatch must be used within a DispatchProvider');
  }
  return context;
}
