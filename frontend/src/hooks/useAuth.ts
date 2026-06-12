/**
 * useAuth hook — wraps AuthContext for convenience.
 * Returns auth state and actions.
 */

import { useContext } from 'react';
import { AuthContext } from '@/App';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider (inside <App>)');
  }
  return ctx;
}
