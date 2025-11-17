/**
 * ChrysaLink API Type Definitions
 * Centralized TypeScript interfaces for all API responses and requests
 */

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string;
  bio?: string;
  followers: number;
  following: number;
  observation_count: number;
  validated_species: number;
  validated_identifications: number;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
}

// ============================================================================
// Observation Types
// ============================================================================

export interface Observation {
  id: string;
  user_id: string;
  lepidoptera_id: string;
  plant_id: string;
  location: string;
  latitude: number;
  longitude: number;
  observation_date: string;
  notes?: string;
  image_url?: string;
  image_storage_path?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ObservationWithRelations extends Observation {
  user?: Profile;
  lepidoptera?: Lepidoptera;
  plant?: Plant;
  identifications?: Identification[];
  comments?: Comment[];
}

// ============================================================================
// Species Types
// ============================================================================

export interface Species {
  id: string;
  name: string;
  scientific_name?: string;
  common_name?: string;
  family?: string;
  genus?: string;
  created_at: string;
}

export interface Lepidoptera extends Species {
  division: string;
}

export interface Plant extends Species {
  division: string;
}

// ============================================================================
// Taxonomy Types
// ============================================================================

export interface TaxonomyDivision {
  id: string;
  type: 'lepidoptera' | 'plant';
  division_name: string;
  common_name?: string;
  description?: string;
  created_at: string;
}

// ============================================================================
// Identification Types
// ============================================================================

export interface Identification {
  id: string;
  observation_id: string;
  user_id: string;
  species: string;
  scientific_name?: string;
  caption?: string;
  confidence_score?: number;
  is_verified: boolean;
  is_auto_suggested: boolean;
  points_awarded: number;
  verified_at?: string;
  verified_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IdentificationWithRelations extends Identification {
  user?: Profile;
  verified_by_user?: Profile;
  observation?: Observation;
}

// ============================================================================
// Comment Types
// ============================================================================

export interface Comment {
  id: string;
  observation_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface CommentWithUser extends Comment {
  user?: Profile;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType =
  | 'new_comment'
  | 'identification_suggested'
  | 'identification_verified'
  | 'identification_rejected'
  | 'points_awarded'
  | 'rating_increased'
  | 'new_follower'
  | 'observation_liked';

export interface Notification {
  id: string;
  user_id: string;
  observation_id?: string;
  identification_id?: string;
  comment_id?: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// ============================================================================
// Rating & Points Types
// ============================================================================

export type ExpertiseLevel = 'Novice' | 'Amateur' | 'Intermediate' | 'Expert' | 'Specialist';

export interface RatingSystem {
  id: string;
  user_id: string;
  current_rating: number;
  expertise_level: ExpertiseLevel;
  verified_identification_count: number;
  points_awarded_total: number;
  created_at: string;
  updated_at: string;
}

export type PointReason =
  | 'identification_verified'
  | 'identification_accepted'
  | 'observation_created'
  | 'comment_helpful'
  | 'bonus_achievement';

export interface PointsLedger {
  id: string;
  user_id: string;
  identification_id?: string;
  observation_id?: string;
  points_amount: number;
  reason: PointReason;
  description?: string;
  created_at: string;
}

export interface UserStatistics {
  total_points: number;
  current_rating: number;
  expertise_level: ExpertiseLevel;
  verified_identifications: number;
  observations_created: number;
  achievements_unlocked: number;
  level_progress: number; // percentage to next level
}

// ============================================================================
// Achievement Types
// ============================================================================

export type AchievementRequirementType =
  | 'observations_count'
  | 'identifications_verified'
  | 'species_documented'
  | 'rating_threshold'
  | 'streak_days'
  | 'community_contribution';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url?: string;
  points_reward: number;
  requirement_type: AchievementRequirementType;
  requirement_value: number;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface UserAchievementWithDetails extends UserAchievement {
  achievement?: Achievement;
}

// ============================================================================
// Relationship Types (Lepidoptera-Plant relationships)
// ============================================================================

export type RelationshipType =
  | 'host_plant'
  | 'alternate_host'
  | 'occasional_host'
  | 'preferred_host';

export interface Relationship {
  id: string;
  lepidoptera_id: string;
  plant_id: string;
  relationship_type: RelationshipType;
  observation_count: number;
  verified_count: number;
  created_at: string;
  updated_at: string;
}

export interface RelationshipWithSpecies extends Relationship {
  lepidoptera?: Lepidoptera;
  plant?: Plant;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================================================
// Search & Filter Types
// ============================================================================

export interface SearchFilters {
  query?: string;
  lepidoptera_id?: string;
  plant_id?: string;
  user_id?: string;
  location?: string;
  date_start?: string;
  date_end?: string;
  is_public?: boolean;
  page?: number;
  per_page?: number;
}

export interface LocationBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, any>;
}

export class ApiErrorClass extends Error implements ApiError {
  code: string;
  status: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, status: number, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}
