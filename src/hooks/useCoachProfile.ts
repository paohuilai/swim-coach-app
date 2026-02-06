import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { Coach } from '../types';

export function useCoachProfile() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const [profile, setProfile] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!isClerkLoaded || !user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('coaches')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching coach profile:', error);
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user, isClerkLoaded]);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isCoach = profile?.role === 'coach' || !profile?.role;

  return { profile, loading, isAdmin, isManager, isCoach };
}
