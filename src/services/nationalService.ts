import { supabase } from '../lib/supabase';
import { NationalTrainingPlan, NationalTask, NationalAthlete } from '../types';

/**
 * Service to handle National Team specific backend operations
 */
export const NationalService = {
  
  // ============================
  // Smart Training Plan
  // ============================
  
  async createPlan(plan: Partial<NationalTrainingPlan>) {
    const { data, error } = await supabase
      .from('national_training_plans')
      .insert(plan)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePlan(id: string, updates: Partial<NationalTrainingPlan>) {
    const { data, error } = await supabase
      .from('national_training_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPlans() {
    const { data, error } = await supabase
      .from('national_training_plans')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as NationalTrainingPlan[];
  },

  // ============================
  // Command Center Tasks
  // ============================

  async getTasks() {
    const { data, error } = await supabase
      .from('national_tasks')
      .select('*')
      .order('deadline', { ascending: true });
    if (error) throw error;
    return data as NationalTask[];
  },

  async createTask(task: Partial<NationalTask>) {
    const { data, error } = await supabase
      .from('national_tasks')
      .insert(task)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTaskStatus(id: string, status: NationalTask['status']) {
    const { error } = await supabase
      .from('national_tasks')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },

  // ============================
  // Athlete Holographic Profile
  // ============================

  async getAthleteProfile(id: string) {
    const { data, error } = await supabase
      .from('national_athletes')
      .select(`
        *,
        base_info:athletes(*)
      `)
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data as (NationalAthlete & { base_info: any });
  },

  // ============================
  // Automation & System Tools
  // ============================

  /**
   * Manually trigger the overdue check for tasks.
   * In production, this would be called by a cron job (Edge Function).
   */
  async triggerOverdueCheck() {
    // Call the database function 'update_overdue_tasks' via RPC
    const { error } = await supabase.rpc('update_overdue_tasks');
    if (error) throw error;
  }
};
