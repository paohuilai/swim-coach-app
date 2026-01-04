export interface Athlete {
  id: string;
  coach_id: string;
  name: string;
  birth_year: number | null;
  gender: string | null;
  venue?: string | null;
  team?: string | null;
  created_at: string;
  // Computed/Joined fields
  current_status?: AthleteStatusHistory;
}

export interface AthleteStatusHistory {
  id: string;
  athlete_id: string;
  status: 'training' | 'paused' | 'trial' | 'transferred';
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
}

export interface PerformanceEntry {
  id: string;
  log_id: string;
  stroke: string;
  time_seconds: number;
  created_at: string;
}

export interface InsightMedia {
  id: string;
  insight_id: string;
  type: 'image' | 'video';
  url: string;
  created_at: string;
}

export interface Coach {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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

export interface CoachTarget {
  id: string;
  coach_id: string;
  birth_year: number; // 0 for "All"
  custom_group_id?: string;
  period_start: string;
  period_end: string;
  target_sessions: number;
  target_km: number;
  name?: string;
  is_pinned?: boolean;
  created_at: string;
}

export interface CoachSignin {
  id: string;
  coach_id: string;
  birth_year: number; // 0 for "All"
  custom_group_id?: string;
  signin_date: string;
  sessions: number;
  km: number;
  note?: string;
  created_at: string;
}

export interface CoachCustomGroup {
  id: string;
  coach_id: string;
  name: string;
  birth_years: number[];
  is_pinned: boolean;
  created_at: string;
}

export interface CoachPeriod {
  id: string;
  coach_id: string;
  custom_group_id?: string;
  birth_year?: number;
  name: string;
  start_date: string;
  end_date: string;
  is_pinned: boolean;
  created_at: string;
}
