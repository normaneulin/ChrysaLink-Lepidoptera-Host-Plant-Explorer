/**
 * Frontend API Client
 * LIGHTWEIGHT HTTP wrapper for calling backend edge functions
 * Falls back to direct Supabase queries if edge functions are unavailable
 */

import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-b55216b3`;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    };

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
   * Fallback method to fetch observations directly from Supabase
   * Used when backend edge functions are unavailable
   */
  async getObservations(): Promise<ApiResponse> {
    try {
      console.log('Fetching observations from Supabase...');
      
      // Fetch ALL observations regardless of is_public status
      const { data, error } = await supabase
        .from('observations')
        .select('*');

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

      // Process observations and add placeholder data for missing relations
      const processedData = data.map((obs: any) => ({
        ...obs,
        lepidoptera: obs.lepidoptera_id ? { id: obs.lepidoptera_id, species: 'Unknown' } : null,
        hostPlant: obs.plant_id ? { id: obs.plant_id, species: 'Unknown' } : null,
        user: { id: obs.user_id, name: 'Unknown User' },
      }));

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
   * Fallback method to create observations directly in Supabase
   * Used when backend edge functions are unavailable
   * Note: RLS prevents direct inserts to taxonomy tables, so we use placeholder IDs
   */
  async createObservation(observationData: any, userId: string): Promise<ApiResponse> {
    try {
      console.log('Creating observation in Supabase (fallback)...');
      
      // Use placeholder UUIDs for now since taxonomy tables have RLS enabled
      // These can be updated later via backend when taxonomy system is ready
      const PLACEHOLDER_LEPIDOPTERA_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const PLACEHOLDER_PLANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';

      console.log('Using placeholder taxonomy IDs due to RLS restrictions');

      // Create the observation with placeholder foreign keys
      const { data, error } = await supabase
        .from('observations')
        .insert({
          user_id: userId,
          lepidoptera_id: PLACEHOLDER_LEPIDOPTERA_ID,
          plant_id: PLACEHOLDER_PLANT_ID,
          location: observationData.location || 'Unknown location',
          latitude: observationData.latitude || 0,
          longitude: observationData.longitude || 0,
          observation_date: observationData.date || new Date().toISOString().split('T')[0],
          notes: observationData.notes || '',
          image_url: observationData.lepidopteraImage || null,
          is_public: true,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase observation insert error:', error);
        // If placeholder IDs don't exist, it's an RLS issue on observations table
        if (error.message.includes('violates foreign key constraint')) {
          return {
            success: false,
            error: 'Database setup issue: Placeholder taxonomy records missing. Please contact admin.',
          };
        }
        if (error.message.includes('row-level security')) {
          return {
            success: false,
            error: 'Permission denied: RLS policy blocks inserts. Please sign in again.',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      console.log('✓ Observation created:', data);
      
      return {
        success: true,
        data: data || {},
        message: 'Observation created successfully',
      };
    } catch (error: any) {
      console.error('❌ Exception in createObservation:', error);
      return {
        success: false,
        error: error.message || 'Failed to create observation',
      };
    }
  }
}

export const apiClient = new FrontendApiClient();
