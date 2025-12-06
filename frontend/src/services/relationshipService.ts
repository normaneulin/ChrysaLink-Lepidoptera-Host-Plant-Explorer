/**
 * Relationship data service
 * Handles all data fetching and transformation for relationship visualization
 */

import {
  TaxonomyRecord,
  TaxonomyNode,
  RelationshipRecord,
  GraphNode,
  GraphEdge,
  GraphData,
  RelationshipFilter,
  DenormalizedRelationship,
  OrganismType,
  TaxonomicLevel,
} from '../types/relationship';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

class RelationshipService {
  private cache: Map<string, { data: GraphData; timestamp: number }> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if a taxonomy record is a placeholder taxon
   * Placeholder: scientific_name is NULL, empty, or whitespace-only
   */
  private isPlaceholder(record: TaxonomyRecord): boolean {
    return (
      !record.scientific_name ||
      record.scientific_name.trim() === '' ||
      record.scientific_name.trim() === ' '
    );
  }

  /**
   * Determine taxonomic level of a record
   */
  private getTaxonomicLevel(record: TaxonomyRecord): TaxonomicLevel {
    if (record.specific_epithet) return 'species';
    if (record.genus) return 'genus';
    if (record.family) return 'family';
    return 'division';
  }

  /**
   * Build display name for taxonomy record
   */
  private getDisplayName(record: TaxonomyRecord, type: OrganismType): string {
    if (record.scientific_name) {
      return record.scientific_name;
    }

    if (record.genus && record.specific_epithet) {
      return `${record.genus} ${record.specific_epithet}`;
    }

    if (record.genus) {
      return record.genus;
    }

    if (record.family) {
      return record.family;
    }

    return record.division || 'Unknown';
  }

  /**
   * Transform database record to TaxonomyNode
   */
  private recordToNode(record: TaxonomyRecord, type: OrganismType): TaxonomyNode {
    const taxonomic_level = this.getTaxonomicLevel(record);
    const is_placeholder = this.isPlaceholder(record);
    const display_name = this.getDisplayName(record, type);

    return {
      id: record.id,
      type,
      taxonomic_level,
      label: display_name,
      division: record.division,
      family: record.family,
      genus: record.genus,
      species: record.specific_epithet,
      scientific_name: record.scientific_name,
      common_name: record.common_name,
      is_placeholder,
      display_name,
    };
  }

  /**
   * Fetch relationships from edge function or Supabase API
   */
  async fetchRelationships(filters?: RelationshipFilter): Promise<DenormalizedRelationship[]> {
    try {
      // Try edge function first for optimized query
      const endpoint = `${SUPABASE_URL}/functions/v1/make-server-b55216b3/relationships`;
      const params = new URLSearchParams();

      if (filters?.lepidoptera_division) {
        params.append('lep_division', filters.lepidoptera_division);
      }
      if (filters?.plant_division) {
        params.append('plant_division', filters.plant_division);
      }
      if (filters?.level) {
        params.append('level', filters.level);
      }
      if (filters?.exclude_placeholders) {
        params.append('exclude_placeholders', 'true');
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }

      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const apiResponse = await response.json();
        
        // Transform edge function response (GraphData format) to DenormalizedRelationship format
        if (apiResponse.edges && apiResponse.edges.length > 0) {
          const denormalized: DenormalizedRelationship[] = apiResponse.edges.map((edge: any) => {
            const lepNode = apiResponse.nodes.find((n: any) => n.id === edge.source);
            const plantNode = apiResponse.nodes.find((n: any) => n.id === edge.target);
            
            return {
              relationship: {
                id: edge.id,
                lepidoptera_id: edge.source,
                plant_id: edge.target,
                relationship_type: edge.relationship_type,
                observation_count: edge.observation_count,
                verified_count: edge.verified_count,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                observation_id: null,
              },
              lepidoptera: lepNode?.data || {},
              plant: plantNode?.data || {},
            };
          });
          
          if (denormalized.length > 0) {
            console.log('Fetched relationships from edge function:', denormalized.length);
            return denormalized;
          }
        }
      }

      // Fallback to direct Supabase API
      console.warn('Edge function returned no data or not available, using fallback');
      return this.fetchRelationshipsFallback(filters);
    } catch (error) {
      console.error('Error fetching relationships:', error);
      return this.fetchRelationshipsFallback(filters);
    }
  }

  /**
   * Fallback relationship fetch using Supabase REST API
   */
  private async fetchRelationshipsFallback(
    filters?: RelationshipFilter
  ): Promise<DenormalizedRelationship[]> {
    try {
      // Build query
      let query = `
        id,
        lepidoptera_id,
        plant_id,
        relationship_type,
        observation_count,
        verified_count,
        created_at,
        updated_at,
        observation_id,
        lepidoptera_taxonomy!relationships_lepidoptera_id_fkey(
          id, division, family, genus, specific_epithet, scientific_name, 
          common_name, subfamily, tribe
        ),
        plant_taxonomy!relationships_plant_id_fkey(
          id, division, family, genus, specific_epithet, scientific_name,
          common_name, subfamily, tribe
        )
      `;

      let url = `${SUPABASE_URL}/rest/v1/relationships?select=${encodeURIComponent(query)}&limit=1000`;

      // Apply filters
      if (filters?.exclude_placeholders) {
        url += `&lepidoptera_taxonomy.scientific_name.not.is.null&plant_taxonomy.scientific_name.not.is.null`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase error: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((row: any) => ({
        relationship: {
          id: row.id,
          lepidoptera_id: row.lepidoptera_id,
          plant_id: row.plant_id,
          relationship_type: row.relationship_type,
          observation_count: row.observation_count,
          verified_count: row.verified_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
          observation_id: row.observation_id,
        },
        lepidoptera: row.lepidoptera_taxonomy,
        plant: row.plant_taxonomy,
      }));
    } catch (error) {
      console.error('Fallback fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch taxonomy items by division
   */
  async fetchTaxonomyByDivision(
    type: OrganismType,
    division: string
  ): Promise<TaxonomyNode[]> {
    try {
      const table = type === 'lepidoptera' ? 'lepidoptera_taxonomy' : 'plant_taxonomy';
      const url = `${SUPABASE_URL}/rest/v1/${table}?division=eq.${encodeURIComponent(division)}&limit=500`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch taxonomy: ${response.statusText}`);
      }

      const records: TaxonomyRecord[] = await response.json();

      // Sort by placeholder status (placeholders first), then by taxonomic level
      const nodes = records
        .map((r) => this.recordToNode(r, type))
        .sort((a, b) => {
          if (a.is_placeholder && !b.is_placeholder) return -1;
          if (!a.is_placeholder && b.is_placeholder) return 1;
          return 0;
        });

      return nodes;
    } catch (error) {
      console.error(`Error fetching ${type} taxonomy:`, error);
      return [];
    }
  }

  /**
   * Fetch all unique divisions for organism type
   */
  async fetchDivisions(type: OrganismType): Promise<string[]> {
    try {
      const table = type === 'lepidoptera' ? 'lepidoptera_taxonomy' : 'plant_taxonomy';
      const url = `${SUPABASE_URL}/rest/v1/${table}?select=division&limit=10`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch divisions: ${response.statusText}`);
      }

      const records: Array<{ division: string }> = await response.json();
      const divisions = Array.from(new Set(records.map((r) => r.division)));

      return divisions.sort();
    } catch (error) {
      console.error(`Error fetching divisions for ${type}:`, error);
      return [];
    }
  }

  /**
   * Build graph data from denormalized relationships
   */
  buildGraphData(denormalized: DenormalizedRelationship[], levelFilter?: TaxonomicLevel): GraphData {
    const nodesMap = new Map<string, GraphNode>();
    const edgesMap = new Map<string, GraphEdge>();

    for (const { relationship, lepidoptera, plant } of denormalized) {
      const lepNode = this.recordToNode(lepidoptera, 'lepidoptera');
      const plantNode = this.recordToNode(plant, 'plant');

      // Create nodes at ALL taxonomic levels for drill-down
      const lepDivision = lepNode.division;
      const lepFamily = lepNode.family;
      const lepGenus = lepNode.genus;
      const lepSpecies = lepNode.scientific_name || `${lepNode.genus} ${lepNode.specific_epithet}`;
      
      const plantDivision = plantNode.division;
      const plantFamily = plantNode.family;
      const plantGenus = plantNode.genus;
      const plantSpecies = plantNode.scientific_name || `${plantNode.genus} ${plantNode.specific_epithet}`;

      // Helper to create node ID
      const createNodeId = (type: string, level: string, name: string) => 
        `${type}_${level}_${name.toLowerCase().replace(/\s+/g, '_')}`;

      // Create DIVISION nodes
      const lepDivisionId = createNodeId('lepidoptera', 'div', lepDivision);
      if (!nodesMap.has(lepDivisionId)) {
        nodesMap.set(lepDivisionId, {
          id: lepDivisionId,
          label: lepDivision,
          data: {
            id: lepDivisionId,
            type: 'lepidoptera',
            taxonomic_level: 'division',
            division: lepDivision,
            display_name: lepDivision,
            is_placeholder: lepNode.is_placeholder,
          } as any,
          cluster: lepDivision,
          color: '#FFD700',
          size: 100,
        });
      }

      const plantDivisionId = createNodeId('plant', 'div', plantDivision);
      if (!nodesMap.has(plantDivisionId)) {
        nodesMap.set(plantDivisionId, {
          id: plantDivisionId,
          label: plantDivision,
          data: {
            id: plantDivisionId,
            type: 'plant',
            taxonomic_level: 'division',
            division: plantDivision,
            display_name: plantDivision,
            is_placeholder: plantNode.is_placeholder,
          } as any,
          cluster: plantDivision,
          color: '#66bb66',
          size: 100,
        });
      }

      // Create FAMILY nodes
      if (lepFamily) {
        const lepFamilyId = createNodeId('lepidoptera', 'fam', lepFamily);
        if (!nodesMap.has(lepFamilyId)) {
          nodesMap.set(lepFamilyId, {
            id: lepFamilyId,
            label: lepFamily,
            data: {
              id: lepFamilyId,
              type: 'lepidoptera',
              taxonomic_level: 'family',
              division: lepDivision,
              family: lepFamily,
              display_name: lepFamily,
              is_placeholder: lepNode.is_placeholder,
            } as any,
            cluster: lepDivision,
            color: '#FFD700',
            size: 80,
          });
        }
      }

      if (plantFamily) {
        const plantFamilyId = createNodeId('plant', 'fam', plantFamily);
        if (!nodesMap.has(plantFamilyId)) {
          nodesMap.set(plantFamilyId, {
            id: plantFamilyId,
            label: plantFamily,
            data: {
              id: plantFamilyId,
              type: 'plant',
              taxonomic_level: 'family',
              division: plantDivision,
              family: plantFamily,
              display_name: plantFamily,
              is_placeholder: plantNode.is_placeholder,
            } as any,
            cluster: plantDivision,
            color: '#66bb66',
            size: 80,
          });
        }
      }

      // Create GENUS nodes
      if (lepGenus) {
        const lepGenusId = createNodeId('lepidoptera', 'gen', lepGenus);
        if (!nodesMap.has(lepGenusId)) {
          nodesMap.set(lepGenusId, {
            id: lepGenusId,
            label: lepGenus,
            data: {
              id: lepGenusId,
              type: 'lepidoptera',
              taxonomic_level: 'genus',
              division: lepDivision,
              family: lepFamily,
              genus: lepGenus,
              display_name: lepGenus,
              is_placeholder: lepNode.is_placeholder,
            } as any,
            cluster: lepDivision,
            color: '#FFD700',
            size: 50,
          });
        }
      }

      if (plantGenus) {
        const plantGenusId = createNodeId('plant', 'gen', plantGenus);
        if (!nodesMap.has(plantGenusId)) {
          nodesMap.set(plantGenusId, {
            id: plantGenusId,
            label: plantGenus,
            data: {
              id: plantGenusId,
              type: 'plant',
              taxonomic_level: 'genus',
              division: plantDivision,
              family: plantFamily,
              genus: plantGenus,
              display_name: plantGenus,
              is_placeholder: plantNode.is_placeholder,
            } as any,
            cluster: plantDivision,
            color: '#66bb66',
            size: 50,
          });
        }
      }

      // Create SPECIES nodes
      if (lepSpecies) {
        const lepSpeciesId = createNodeId('lepidoptera', 'sp', lepSpecies);
        if (!nodesMap.has(lepSpeciesId)) {
          nodesMap.set(lepSpeciesId, {
            id: lepSpeciesId,
            label: lepSpecies,
            data: {
              id: lepSpeciesId,
              type: 'lepidoptera',
              taxonomic_level: 'species',
              division: lepDivision,
              family: lepFamily,
              genus: lepGenus,
              species: lepSpecies,
              scientific_name: lepSpecies,
              display_name: lepSpecies,
              is_placeholder: lepNode.is_placeholder,
            } as any,
            cluster: lepDivision,
            color: '#FFD700',
            size: 20,
          });
        }
      }

      if (plantSpecies) {
        const plantSpeciesId = createNodeId('plant', 'sp', plantSpecies);
        if (!nodesMap.has(plantSpeciesId)) {
          nodesMap.set(plantSpeciesId, {
            id: plantSpeciesId,
            label: plantSpecies,
            data: {
              id: plantSpeciesId,
              type: 'plant',
              taxonomic_level: 'species',
              division: plantDivision,
              family: plantFamily,
              genus: plantGenus,
              species: plantSpecies,
              scientific_name: plantSpecies,
              display_name: plantSpecies,
              is_placeholder: plantNode.is_placeholder,
            } as any,
            cluster: plantDivision,
            color: '#66bb66',
            size: 20,
          });
        }
      }

      // Create edges at division level (for initial view)
      const divEdgeId = `${lepDivisionId}->${plantDivisionId}`;
      if (edgesMap.has(divEdgeId)) {
        const existingEdge = edgesMap.get(divEdgeId)!;
        existingEdge.observation_count = (existingEdge.observation_count || 0) + (relationship.observation_count || 0);
        existingEdge.verified_count = (existingEdge.verified_count || 0) + (relationship.verified_count || 0);
      } else {
        edgesMap.set(divEdgeId, {
          id: divEdgeId,
          source: lepDivisionId,
          target: plantDivisionId,
          label: relationship.relationship_type,
          observation_count: relationship.observation_count,
          verified_count: relationship.verified_count,
          relationship_type: relationship.relationship_type,
        });
      }

      // Create edges at species level (for drill-down view)
      if (lepSpecies && plantSpecies) {
        const lepSpeciesId = createNodeId('lepidoptera', 'sp', lepSpecies);
        const plantSpeciesId = createNodeId('plant', 'sp', plantSpecies);
        const speciesEdgeId = `${lepSpeciesId}->${plantSpeciesId}`;
        
        if (!edgesMap.has(speciesEdgeId)) {
          edgesMap.set(speciesEdgeId, {
            id: speciesEdgeId,
            source: lepSpeciesId,
            target: plantSpeciesId,
            label: relationship.relationship_type,
            observation_count: relationship.observation_count,
            verified_count: relationship.verified_count,
            relationship_type: relationship.relationship_type,
          });
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  }

  /**
   * Get size for node based on taxonomic level
   */
  private getNodeSize(level: TaxonomicLevel): number {
    const sizes: Record<TaxonomicLevel, number> = {
      division: 100,
      family: 80,
      genus: 50,
      species: 20,
    };
    return sizes[level];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache key for filters
   */
  private getCacheKey(filters?: RelationshipFilter): string {
    return JSON.stringify(filters || {});
  }

  /**
   * Main method: Fetch and build graph data
   */
  async getGraphData(filters?: RelationshipFilter): Promise<GraphData> {
    const cacheKey = this.getCacheKey(filters);
    const cached = this.cache.get(cacheKey);

    // Return cached data if fresh
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('Using cached graph data');
      return cached.data;
    }

    try {
      const denormalized = await this.fetchRelationships(filters);
      const graphData = this.buildGraphData(denormalized, filters?.level);

      // Cache result
      this.cache.set(cacheKey, { data: graphData, timestamp: Date.now() });

      return graphData;
    } catch (error) {
      console.error('Error building graph data:', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Search for taxonomy items
   */
  async searchTaxonomy(query: string, type: OrganismType, limit = 50): Promise<TaxonomyNode[]> {
    try {
      const table = type === 'lepidoptera' ? 'lepidoptera_taxonomy' : 'plant_taxonomy';
      const q = encodeURIComponent(query);

      // Search across multiple fields
      const url = `${SUPABASE_URL}/rest/v1/${table}?or=(division.ilike.%${q}%,family.ilike.%${q}%,genus.ilike.%${q}%,specific_epithet.ilike.%${q}%,scientific_name.ilike.%${q}%,common_name.ilike.%${q}%)&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const records: TaxonomyRecord[] = await response.json();

      // Convert and sort (placeholders first)
      const nodes = records
        .map((r) => this.recordToNode(r, type))
        .sort((a, b) => {
          if (a.is_placeholder && !b.is_placeholder) return -1;
          if (!a.is_placeholder && b.is_placeholder) return 1;
          return (a.label || '').localeCompare(b.label || '');
        });

      return nodes;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }
}

export const relationshipService = new RelationshipService();
