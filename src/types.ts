// src/types.ts
export interface Profile {
  first_name: string
  last_name: string
  instrument: string
}

export interface Ensemble {
  id: string
  name: string
  join_code: string
  announcement_permission: string
  announcement_reply_permission: string
  role?: string
}

export interface Piece {
  id: string
  title: string
  composer: string
  ensemble_id: string
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  author_name: string
  created_at: string
}

export interface AnnouncementReply {
  id: string
  announcement_id: string
  author_name: string
  content: string
  created_at: string
}

export interface MemberDetail {
  id: string
  user_id: string
  role: string
  joined_at: string
  first_name: string
  last_name: string
  instrument: string
}

export interface NotificationItem {
  id: string
  user_id: string
  actor_id: string
  actor_name: string
  type: string
  title: string
  message: string
  link_id?: string
  is_read: boolean
  created_at: string
}

export interface FriendDetail {
  friendship_id: string
  user_id: string
  first_name: string
  last_name: string
  instrument: string
  status: string
  shared_ensembles: string[]
}

export interface Piece {
  id: string
  ensemble_id: string
  title: string
  composer: string
  file_url?: string | null
  created_at: string
}

export interface PiecePart {
  id: string
  piece_id: string
  ensemble_id: string
  instrument: string
  name: string
  file_url: string
  uploaded_by?: string
  created_at: string
}


export interface Profile {
  id: string; // <-- Add this line
  first_name: string;
  last_name: string;
  instrument: string;
  // (keep any other properties you might already have here)
}



export interface InventoryItem {
  id: string;
  ensemble_id: string;
  item_type: string;
  name: string;
  assigned_to?: string | null;
  condition_notes?: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  ensemble_id: string;
  title: string;
  instructions?: string;
  due_date?: string;
  created_at: string;
  assigned_students?: string[];
  score_id?: string | null;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  audio_url: string;
  teacher_notes?: string;
  feedback_published?: boolean; // <-- Add this line
  submitted_at: string;
}

export interface SectionalReport {
  id: string;
  ensemble_id: string;
  leader_id: string;
  title: string;
  attendance_notes?: string;
  rehearsal_notes?: string;
  created_at: string;
}

export interface PieceAssignment {
  id: string;
  ensemble_id: string;
  piece_id: string;
  user_id: string;
  instrument: string;
}