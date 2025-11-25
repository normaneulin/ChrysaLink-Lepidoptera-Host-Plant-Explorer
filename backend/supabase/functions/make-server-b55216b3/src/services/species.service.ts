import { supabase } from "../config/supabase.ts";
import { NotFoundError } from "../utils/error-handler.ts";

/**
 * Species Service
 * Handles species lookup and matching by name
 */

export const SpeciesService = {
  /**
   * Find lepidoptera species by name (scientific or common)
   * Returns the UUID if found, null if not found
   */
  async findLepidopteraByName(speciesName: string): Promise<string | null> {
    if (!speciesName || speciesName.trim() === "") {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("lepidoptera_taxonomy")
        .select("id")
        .or(
          `scientific_name.eq.${speciesName},common_name.ilike.${speciesName}`
        )
        .limit(1)
        .single();

      if (error || !data) {
        console.log(
          `Lepidoptera species not found: ${speciesName}`
        );
        return null;
      }

      return data.id;
    } catch (error: any) {
      console.error("Error finding lepidoptera:", error);
      return null;
    }
  },

  /**
   * Find plant species by name (scientific or common)
   * Returns the UUID if found, null if not found
   */
  async findPlantByName(speciesName: string): Promise<string | null> {
    if (!speciesName || speciesName.trim() === "") {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("plant_taxonomy")
        .select("id")
        .or(
          `scientific_name.eq.${speciesName},common_name.ilike.${speciesName}`
        )
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`Plant species not found: ${speciesName}`);
        return null;
      }

      return data.id;
    } catch (error: any) {
      console.error("Error finding plant:", error);
      return null;
    }
  },

  /**
   * Create a new lepidoptera entry if it doesn't exist
   * Returns the UUID (existing or newly created)
   */
  async getOrCreateLepidoptera(speciesName: string): Promise<string> {
    // Try to find existing
    const existingId = await this.findLepidopteraByName(speciesName);
    if (existingId) {
      return existingId;
    }

    // Create new entry
    try {
      const { data, error } = await supabase
        .from("lepidoptera_taxonomy")
        .insert([
          {
            scientific_name: speciesName,
            division: "Unknown", // Default division
          },
        ])
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create lepidoptera: ${error?.message}`);
      }

      return data.id;
    } catch (error: any) {
      throw new Error(`Failed to create lepidoptera: ${error.message}`);
    }
  },

  /**
   * Create a new plant entry if it doesn't exist
   * Returns the UUID (existing or newly created)
   */
  async getOrCreatePlant(speciesName: string): Promise<string> {
    // Try to find existing
    const existingId = await this.findPlantByName(speciesName);
    if (existingId) {
      return existingId;
    }

    // Create new entry
    try {
      const { data, error } = await supabase
        .from("plant_taxonomy")
        .insert([
          {
            scientific_name: speciesName,
            division: "Unknown", // Default division
          },
        ])
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create plant: ${error?.message}`);
      }

      return data.id;
    } catch (error: any) {
      throw new Error(`Failed to create plant: ${error.message}`);
    }
  },
};
