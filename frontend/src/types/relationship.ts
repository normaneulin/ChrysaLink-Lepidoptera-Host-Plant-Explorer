/**
 * Relationship visualization types
 * Unified types for graph visualization and data fetching
 */

export type TaxonomicLevel = 'division' | 'family' | 'genus' | 'species';
export type OrganismType = 'lepidoptera' | 'plant';
export type RelationshipType = 'host_plant' | 'alternate_host' | 'occasional_host' | 'preferred_host';

/**
 * Taxonomy record from database
 */
export interface TaxonomyRecord {
  id: string;
  division: string;
  family?: string;
  genus?: string;
  specific_epithet?: string;
  scientific_name?: string;
  common_name?: string;
  subfamily?: string;
  tribe?: string;
  author?: string;
  year_of_publication?: number;
  subspecific_epithet?: string;
}

/**
 * Processed taxonomy item with display info
 */
export interface TaxonomyNode {
  id: string;
  type: OrganismType;
  taxonomic_level: TaxonomicLevel;
  label: string;
  division: string;
  family?: string;
  genus?: string;
  species?: string;
  scientific_name?: string;
  common_name?: string;
  is_placeholder: boolean;
  display_name: string;
}

/**
 * Relationship record from database
 */
export interface RelationshipRecord {
  id: string;
  lepidoptera_id: string;
  plant_id: string;
  relationship_type: RelationshipType;
  observation_count: number;
  verified_count: number;
  created_at: string;
  updated_at: string;
  observation_id?: string;
}

/**
 * Graph edge for visualization
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  observation_count: number;
  verified_count: number;
  relationship_type: RelationshipType;
}

/**
 * Node for ReaGraph visualization
 */
export interface GraphNode {
  id: string;
  label: string;
  data: TaxonomyNode;
  cluster?: string;
  size?: number;
  color?: string;
}

/**
 * Complete graph data for visualization
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Interaction data for demo/testing
 */
export interface Interaction {
  id: string;
  insect: string;
  plant: string;
}

/**
 * Filter options for relationship queries
 */
export interface RelationshipFilter {
  lepidoptera_division?: string;
  plant_division?: string;
  level?: TaxonomicLevel;
  exclude_placeholders?: boolean;
  limit?: number;
}

/**
 * API response from relationships endpoint
 */
export interface RelationshipsApiResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  count: number;
  cached?: boolean;
  timestamp?: number;
}

/**
 * Denormalized relationship with taxonomy info
 */
export interface DenormalizedRelationship {
  relationship: RelationshipRecord;
  lepidoptera: TaxonomyRecord;
  plant: TaxonomyRecord;
}

/**
 * Search result item
 */
export interface SearchResult extends TaxonomyNode {
  taxonomic_level: TaxonomicLevel;
  match_field: string;
  match_position: number;
}
