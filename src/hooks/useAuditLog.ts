import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCoachProfile } from './useCoachProfile';
import { useUser } from '@clerk/clerk-react';

export function useAuditLog() {
  const { user } = useUser();
  const { profile } = useCoachProfile();

  const logAction = useCallback(async (
    action: string,
    targetType: string,
    targetId: string | undefined,
    details: any = {}
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        venue: profile?.venue || 'unknown',
        action,
        target_type: targetType,
        target_id: targetId,
        details
      });

      if (error) {
        console.error('Failed to write audit log:', error);
      }
    } catch (e) {
      console.error('Audit log exception:', e);
    }
  }, [user, profile]);

  return { logAction };
}
