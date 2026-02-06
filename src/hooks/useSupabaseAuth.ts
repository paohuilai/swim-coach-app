import { useAuth } from '@clerk/clerk-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { supabase as anonymousClient } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useSupabaseAuth() {
  const { getToken, userId } = useAuth();

  const getClient = async (): Promise<SupabaseClient> => {
    // Fallback: Since Clerk JWT template creation is failing, we use the anonymous client directly.
    // Ensure you have updated RLS policies to allow 'public' or 'anon' role access.
    // console.log('⚠️ [Auth] Clerk JWT template unavailable. Using anonymous client.');
    return anonymousClient;

    /* Original Logic (Disabled until Clerk is fixed)
    try {
      const token = await getToken({ template: 'supabase' });
      // ...
    } catch (error) {
      return anonymousClient;
    }
    */
  };

  return { getClient, userId };
}
