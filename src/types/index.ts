export interface Athlete {
  id: string;
  coach_id: string;
  name: string;
  birth_year: number | null;
  gender: string | null;
  venue?: string | null;
  team?: string | null;
  avatar_url?: string | null;
  created_at: string;
  // Computed/Joined fields
  current_status?: AthleteStatusHistory;
}

export interface AthleteStatusHistory {
  id: string;
  athlete_id: string;
  status: 'training' | 'paused' | 'trial' | 'transferred' | 'other';
  custom_status?: string | null;
  start_date: string;
  end_date?: string | null;
  destination?: string | null;
  created_at: string;
}

export interface TrainingLog {
  id: string;
  athlete_id: string;
  date: string;
  distance_km: number;
  status_score?: number;
  status_note?: string;
  created_at: string;
  performance_entries?: PerformanceEntry[];
  // New fields
  test_type?: string;
  pool_info?: string;
  recorder?: string;
  rpe?: number;
  stroke_rate?: number;
  stroke_length?: number;
}

export interface PerformanceEntry {
  id: string;
  log_id: string;
  stroke: string;
  time_seconds: number;
  created_at: string;
  // New fields
  timing_method?: string;
  split_times?: string[]; // Stored as JSONB
  reaction_time?: number;
}

export interface InsightMedia {
  id: string;
  insight_id: string;
  type: 'image' | 'video';
  url: string;
  created_at: string;
}

export type UserRole = 'admin' | 'manager' | 'coach';

export interface Coach {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role?: UserRole;
  venue?: string | null;
  managed_venue?: string | null;
  team?: string | null;
}

export interface TrainingInsight {
  id: string;
  coach_id: string;
  title: string;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked_by_me?: boolean;
  media?: InsightMedia[];
  coaches?: Coach;
}

export interface TrainingPlan {
  id: string;
  coach_id: string;
  date: string;
  title?: string;
  content?: string;
  media_urls?: { type: 'image' | 'video'; url: string }[];
  target_groups?: any; // JSONB array
  created_at: string;
}

export interface Competition {
  id: string;
  title: string;
  date: string;
  created_by?: string;
  created_at: string;
  results?: CompetitionResult[];
}

export interface CompetitionResult {
  id: string;
  competition_id: string;
  athlete_name: string;
  age_group: string;
  event: string;
  score: string;
  rank: number;
  created_at: string;
}

// Manager Task Types
export type TaskType = 'plan_upload' | 'score_record';
export type TaskStatus = 'pending' | 'completed';

export interface ManagerTask {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  deadline: string;
  venue: string;
  created_by: string;
  created_at: string;
  // Join fields
  submissions?: TaskSubmission[];
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  coach_id: string;
  status: TaskStatus;
  submission_id?: string;
  submitted_at?: string;
  created_at: string;
  // Join fields
  coach?: Coach;
}

// ==========================================
// National Team Types
// ==========================================

export interface NationalAthlete extends Athlete {
  status: 'active' | 'injured' | 'rehabilitation' | 'suspended' | 'retired';
  level: 'national' | 'national_youth' | 'provincial';
  main_stroke?: string;
  height?: number;
  weight?: number;
  wingspan?: number;
  medical_history?: MedicalRecord[]; // JSONB
  growth_trajectory?: GrowthStat[]; // JSONB
}

export interface MedicalRecord {
  date: string;
  type: string;
  description: string;
  doctor?: string;
}

export interface GrowthStat {
  date: string;
  height?: number;
  weight?: number;
  wingspan?: number;
  vo2max?: number;
}

export interface NationalTrainingPlan {
  id: string;
  title: string;
  coach_id: string;
  start_date: string;
  end_date: string;
  cycle_type?: 'macro' | 'meso' | 'micro';
  modules: TrainingModule[]; // JSONB
  total_load: number;
  status: 'draft' | 'published' | 'completed' | 'archived';
  is_template: boolean;
  created_at: string;
}

export interface TrainingModule {
  id: string;
  content: string;
  load: number;
  duration?: number; // minutes
}

export interface NationalTask {
  id: string;
  title: string;
  description?: string;
  type: 'training' | 'medical' | 'research' | 'admin';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'archived';
  creator_id: string;
  assignee_id?: string;
  assignee_role?: string;
  deadline: string;
  dependencies?: string[]; // UUID[]
  quality_score?: number;
  attachments?: string[]; // URLs
  created_at: string;
}

export interface WarRoomVideo {
  id: string;
  project_id: string;
  url: string;
  type: 'self' | 'opponent';
  athlete_name?: string;
  lane_number?: number;
  annotations?: any[]; // JSONB
  sync_offset?: number;
}
