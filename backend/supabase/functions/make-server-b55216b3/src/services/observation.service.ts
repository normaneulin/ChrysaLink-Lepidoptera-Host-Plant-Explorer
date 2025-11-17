import { supabase } from "../config/supabase.ts";
import {
  CreateObservationData,
  Observation,
  Species,
  SearchSpeciesParams,
} from "../types/observation.types.ts";
import { ValidationError, NotFoundError } from "../utils/error-handler.ts";
import { validateGPS, validateObservationDate } from "../utils/validators.ts";

/**
 * Observation Service
 * Handles CRUD operations for observations and species searches
 * This is BACKEND logic - handles database queries and business logic
 */

export const ObservationService = {
  /**
   * Create a new observation
   */
  async createObservation(
    userId: string,
    data: CreateObservationData
  ): Promise<Observation> {
    // Validate input
    if (!validateGPS(data.latitude || 0, data.longitude || 0)) {
      throw new ValidationError("Invalid GPS coordinates");
    }

    if (!validateObservationDate(data.date)) {
      throw new ValidationError("Invalid observation date");
    }

    try {
      const { data: observation, error } = await supabase
        .from("observations")
        .insert([
          {
            user_id: userId,
            lepidoptera_id: data.lepidopteraSpecies,
            plant_id: data.hostPlantSpecies,
            location: data.location,
            latitude: data.latitude,
            longitude: data.longitude,
            observation_date: data.date,
            notes: data.notes,
            is_public: true,
          },
        ])
        .select()
        .single();

      if (error || !observation) {
        throw new Error(error?.message || "Failed to create observation");
      }

      return observation as Observation;
    } catch (error: any) {
      throw new Error(error.message || "Create observation failed");
    }
  },

  /**
   * Get observation by ID
   */
  async getObservationById(id: string): Promise<Observation> {
    try {
      const { data, error } = await supabase
        .from("observations")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new NotFoundError("Observation");
      }

      return data as Observation;
    } catch (error: any) {
      if (error instanceof NotFoundError) throw error;
      throw new Error(error.message || "Failed to fetch observation");
    }
  },

  /**
   * List observations with optional filters
   */
  async listObservations(
    filters?: Record<string, any>
  ): Promise<Observation[]> {
    try {
      let query = supabase.from("observations").select("*");

      // Apply filters
      if (filters) {
        if (filters.userId) {
          query = query.eq("user_id", filters.userId);
        }
        if (filters.lepidopteraId) {
          query = query.eq("lepidoptera_id", filters.lepidopteraId);
        }
        if (filters.plantId) {
          query = query.eq("plant_id", filters.plantId);
        }
        if (filters.location) {
          query = query.ilike("location", `%${filters.location}%`);
        }
        if (filters.isPublic !== undefined) {
          query = query.eq("is_public", filters.isPublic);
        }
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as Observation[];
    } catch (error: any) {
      throw new Error(error.message || "Failed to fetch observations");
    }
  },

  /**
   * Get observations for a specific user
   */
  async getUserObservations(userId: string): Promise<Observation[]> {
    return this.listObservations({ userId });
  },

  /**
   * Update an observation
   */
  async updateObservation(
    id: string,
    userId: string,
    updates: Partial<CreateObservationData>
  ): Promise<Observation> {
    try {
      // Verify ownership
      const existing = await this.getObservationById(id);
      if (existing.user_id !== userId) {
        throw new Error("Unauthorized: Cannot update others' observations");
      }

      const { data, error } = await supabase
        .from("observations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to update observation");
      }

      return data as Observation;
    } catch (error: any) {
      throw new Error(error.message || "Update observation failed");
    }
  },

  /**
   * Delete an observation
   */
  async deleteObservation(id: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const existing = await this.getObservationById(id);
      if (existing.user_id !== userId) {
        throw new Error("Unauthorized: Cannot delete others' observations");
      }

      const { error } = await supabase
        .from("observations")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      throw new Error(error.message || "Delete observation failed");
    }
  },

  /**
   * Search for lepidoptera species
   */
  async searchLepidoptera(query: string): Promise<Species[]> {
    try {
      const { data, error } = await supabase
        .from("lepidoptera_taxonomy")
        .select("id, name, common_name as commonName, scientific_name as scientificName")
        .or(`name.ilike.%${query}%,common_name.ilike.%${query}%`)
        .limit(20);

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as Species[];
    } catch (error: any) {
      throw new Error(error.message || "Search failed");
    }
  },

  /**
   * Search for host plants
   */
  async searchPlants(query: string): Promise<Species[]> {
    try {
      const { data, error } = await supabase
        .from("plant_taxonomy")
        .select("id, name, common_name as commonName, scientific_name as scientificName")
        .or(`name.ilike.%${query}%,common_name.ilike.%${query}%`)
        .limit(20);

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as Species[];
    } catch (error: any) {
      throw new Error(error.message || "Search failed");
    }
  },

  /**
   * Search for species by type
   */
  async searchSpecies(params: SearchSpeciesParams): Promise<Species[]> {
    if (params.type === "lepidoptera") {
      return this.searchLepidoptera(params.query);
    } else if (params.type === "plant") {
      return this.searchPlants(params.query);
    }

    throw new ValidationError("Invalid species type");
  },

  /**
   * Get observations for a specific relationship
   */
  async getRelationshipObservations(
    lepidopteraId: string,
    plantId: string
  ): Promise<Observation[]> {
    return this.listObservations({
      lepidopteraId,
      plantId,
    });
  },
};
