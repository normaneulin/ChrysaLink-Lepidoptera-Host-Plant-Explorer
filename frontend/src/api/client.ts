/**
 * Frontend API Client
 * LIGHTWEIGHT HTTP wrapper for calling backend edge functions
 * Falls back to direct Supabase queries if edge functions are unavailable
 */

import { supabase } from '../lib/supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-b55216b3`;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

class FrontendApiClient {
  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      body?: any;
      accessToken?: string;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = "GET", body, accessToken } = options;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      // Add Supabase anon key for all requests to edge functions
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };

    // Override with user access token if provided
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Network error",
        statusCode: 0,
      };
    }
  }

  async get<T>(endpoint: string, accessToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", accessToken });
  }

  async post<T>(
    endpoint: string,
    body: any,
    accessToken?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "POST", body, accessToken });
  }

  async put<T>(
    endpoint: string,
    body: any,
    accessToken?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PUT", body, accessToken });
  }

  async patch<T>(
    endpoint: string,
    body: any,
    accessToken?: string
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PATCH", body, accessToken });
  }

  async delete<T>(endpoint: string, accessToken?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE", accessToken });
  }

  /**
   * Search species database with fuzzy matching
   * 
   * Purpose: Allow users to search for lepidoptera or plant species
   * 
   * Algorithm:
   * 1. Determine table based on type parameter
   * 2. Query Supabase with case-insensitive LIKE search
   * 3. Search common_name field with wildcards (%query%)
   * 4. Limit results to 20 for performance
   * 5. Return formatted results array
   * 
   * @param query - Search term entered by user
   * @param type - 'lepidoptera' or 'plant' to choose taxonomy table
   * @returns ApiResponse with array of matching species
   * 
   * Database Tables:
   * - lepidoptera_taxonomy: butterfly and moth species
   * - plant_taxonomy: host plant species
   * 
   * Query Strategy: ilike with %wildcards% (case-insensitive)
   * Examples: "blue" matches "Blue Morpho", "Blueberry"
   * Result Limit: Max 20 to prevent UI overload
   */

  /**
   * Fallback method to fetch observations directly from Supabase
   * Used when backend edge functions are unavailable
   */
  async getObservations(): Promise<ApiResponse> {
    try {
      console.log('Fetching observations from Supabase with joins...');
      
      const { data, error } = await supabase
        .from('observations')
        .select(`
          *,
          profiles ( name, avatar_url ),
          lepidoptera_taxonomy ( name, common_name ),
          plant_taxonomy ( name, common_name )
        `)
        .eq('is_public', true)
        .limit(50); // Add a limit to avoid fetching too much data

      if (error) {
        console.error('Supabase query error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log('Raw observations from Supabase:', {
        count: data?.length || 0,
        data: data,
      });
      
      if (!data || data.length === 0) {
        console.warn('No observations found in database');
        return {
          success: true,
          data: [],
        };
      }

      // Process observations to shape them like the backend response
      const processedData = data.map((obs: any) => {
        const { profiles, lepidoptera_taxonomy, plant_taxonomy, ...rest } = obs;

        const user = profiles
          ? { id: obs.user_id, name: profiles.name, avatar_url: profiles.avatar_url }
          : { id: obs.user_id, name: 'Unknown User' };

        const lepidoptera = lepidoptera_taxonomy
          ? { id: obs.lepidoptera_id, species: { name: lepidoptera_taxonomy.common_name || lepidoptera_taxonomy.name } }
          : obs.lepidoptera_id ? { id: obs.lepidoptera_id, species: { name: 'Unknown Lepidoptera' } } : null;
        
        const hostPlant = plant_taxonomy
          ? { id: obs.plant_id, species: { name: plant_taxonomy.common_name || plant_taxonomy.name } }
          : obs.plant_id ? { id: obs.plant_id, species: { name: 'Unknown Host Plant' } } : null;
        
        return {
          ...rest,
          user,
          lepidoptera,
          hostPlant,
        };
      });

      console.log('Processed observations:', processedData);
      
      return {
        success: true,
        data: processedData,
      };
    } catch (error: any) {
      console.error('Exception in getObservations:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch observations',
      };
    }
  }

  /**
   * Fallback method to search species directly from Supabase
   */
  async searchSpecies(query: string, type: 'lepidoptera' | 'plant'): Promise<ApiResponse> {
    try {
      const table = type === 'lepidoptera' ? 'lepidoptera_taxonomy' : 'plant_taxonomy';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike('common_name', `%${query}%`)
        .limit(20);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to search species',
      };
    }
  }

  /**
   * Uploads a base64 encoded image to Supabase Storage.
   * @param base64Data The base64 data URL of the image.
   * @param userId The ID of the user uploading the image.
   * @returns The public URL of the uploaded image.
   */
  private async uploadBase64Image(base64Data: string, userId: string): Promise<string> {
    try {
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const fileExt = blob.type.split('/')[1];
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('observation_images')
        .upload(filePath, blob);

      if (error) {
        throw new Error(`Storage upload error: ${error.message}`);
      }

       const { data: urlData } = supabase.storage
        .from('observation_images')
        .getPublicUrl(data.path);

      if (!urlData) {
        throw new Error('Could not get public URL for uploaded file.');
      }
      
      return urlData.publicUrl;
    } catch (e) {
      console.error("Image upload failed:", e);
      throw e;
    }
  }

  /**
   * Fallback method to create observations directly in Supabase
   * Used when backend edge functions are unavailable
   */
  async createObservation(observationData: any, userId: string): Promise<ApiResponse> {
    // 1. Insert the core observation data
    const { data: obsData, error: obsError } = await supabase
      .from('observations')
      .insert({
        user_id: userId,
        location: observationData.location || 'Unknown location',
        latitude: observationData.latitude || 0,
        longitude: observationData.longitude || 0,
        observation_date: observationData.date || new Date().toISOString().split('T')[0],
        notes: observationData.notes || '',
        is_public: true,
        lepidoptera_id: observationData.lepidoptera_id,
        plant_id: observationData.plant_id,
      })
      .select()
      .single();

    if (obsError) {
      console.error('❌ Supabase observation insert error:', obsError);
      return { success: false, error: obsError.message };
    }

    const observationId = obsData.id;
    console.log('✓ Observation created with ID:', observationId);

    // 2. Upload images and collect their metadata
    try {
      const imageUploadPromises = [];

      // Lepidoptera images
      for (const lepImage of observationData.lepidopteraImages || []) {
        imageUploadPromises.push(
          this.uploadBase64Image(lepImage, userId).then(url => ({
            observation_id: observationId,
            image_url: url,
            image_type: 'lepidoptera',
          }))
        );
      }

      // Host plant images
      for (const plantImage of observationData.hostPlantImages || []) {
        imageUploadPromises.push(
          this.uploadBase64Image(plantImage, userId).then(url => ({
            observation_id: observationId,
            image_url: url,
            image_type: 'plant',
          }))
        );
      }

      const imageRecords = await Promise.all(imageUploadPromises);

      if (imageRecords.length > 0) {
        // 3. Insert image metadata into the observation_images table
        const { error: imgError } = await supabase
          .from('observation_images')
          .insert(imageRecords);

        if (imgError) {
          console.error('❌ Supabase image insert error:', imgError);
          // Optional: Attempt to delete the observation if image upload fails
          await supabase.from('observations').delete().eq('id', observationId);
          return { success: false, error: `Failed to save images: ${imgError.message}` };
        }
        console.log('✓ Successfully inserted ${imageRecords.length} image records.');
      }

      return {
        success: true,
        data: obsData,
        message: 'Observation created successfully with images.',
      };
    } catch (error: any) {
      console.error('❌ Exception during image processing:', error);
       // Optional: Attempt to delete the observation if image upload fails
       await supabase.from('observations').delete().eq('id', observationId);
      return { success: false, error: error.message || 'A failure occurred during image processing.' };
    }
  }

  /**
   * Get current user's profile
   */
  async getProfile(userId: string): Promise<ApiResponse> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: data || {},
      };
    } catch (error: any) {
      console.error('Exception in getProfile:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch profile',
      };
    }
  }
}

export const apiClient = new FrontendApiClient();
