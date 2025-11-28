import { apiClient } from '../api/client';

/**
 * Frontend Observation Service
 * Calls backend edge functions for observation operations
 * Does NOT contain backend logic - just frontend business logic
 */

export interface CreateObservationData {
  lepidopteraImages: string[];
  lepidopteraSpecies: string;
  hostPlantImages: string[];
  hostPlantSpecies: string;
  date: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
}

export interface SearchSpeciesParams {
  query: string;
  type: 'lepidoptera' | 'plant';
}

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

export interface Species {
  id: string;
  name: string;
  commonName?: string;
  scientificName?: string;
  family?: string;
}

class ObservationService {
  /**
   * Create a new observation
   * Calls POST /observations on backend
   * @param data - Observation data including images and species info
   * @param accessToken - User's authentication token
   * @returns Success status and observation data
   */
  async createObservation(
    data: CreateObservationData,
    accessToken: string
  ): Promise<{ success: boolean; data?: Observation; error?: string }> {
    const response = await apiClient.post<Observation>(
      '/observations',
      data,
      accessToken
    );

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  /**
   * Search for species by name
   * Calls GET /species/search on backend
   * @param params - Search query and species type
   * @returns Array of matching species
   */
  async searchSpecies(
    params: SearchSpeciesParams
  ): Promise<{ success: boolean; data?: Species[]; error?: string }> {
    const query = `/species/search?q=${encodeURIComponent(params.query)}&type=${params.type}`;
    const response = await apiClient.get<Species[]>(query);

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  /**
   * Get a specific observation by ID
   * Calls GET /observations/:id on backend
   * @param id - Observation ID
   * @param accessToken - User's authentication token
   * @returns Observation data
   */
  async getObservationById(
    id: string,
    accessToken?: string
  ): Promise<{ success: boolean; data?: Observation; error?: string }> {
    const response = await apiClient.get<Observation>(
      `/observations/${id}`,
      accessToken
    );

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  /**
   * List all observations (with optional filters)
   * Calls GET /observations on backend
   * @param accessToken - User's authentication token
   * @param filters - Optional query filters
   * @returns Array of observations
   */
  async listObservations(
    accessToken: string,
    filters?: Record<string, any>
  ): Promise<{ success: boolean; data?: Observation[]; error?: string }> {
    let endpoint = '/observations';
    if (filters) {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }

    const response = await apiClient.get<Observation[]>(endpoint, accessToken);

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  /**
   * Update an observation
   * Calls PUT /observations/:id on backend
   * @param id - Observation ID
   * @param data - Updated observation data
   * @param accessToken - User's authentication token
   * @returns Updated observation
   */
  async updateObservation(
    id: string,
    data: Partial<CreateObservationData>,
    accessToken: string
  ): Promise<{ success: boolean; data?: Observation; error?: string }> {
    const response = await apiClient.put<Observation>(
      `/observations/${id}`,
      data,
      accessToken
    );

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }

  /**
   * Delete an observation
   * Calls DELETE /observations/:id on backend
   * @param id - Observation ID
   * @param accessToken - User's authentication token
   * @returns Success status
   */
  async deleteObservation(
    id: string,
    accessToken: string
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient.delete(`/observations/${id}`, accessToken);

    return {
      success: response.success,
      error: response.error,
    };
  }

  /**
   * Get observations for a specific relationship
   * Calls GET /relationships/:id/:id/observations on backend
   * @param lepidopteraId - Butterfly species ID
   * @param plantId - Host plant species ID
   * @param accessToken - User's authentication token
   * @returns Array of observations
   */
  async getRelationshipObservations(
    lepidopteraId: string,
    plantId: string,
    accessToken?: string
  ): Promise<{ success: boolean; data?: Observation[]; error?: string }> {
    const response = await apiClient.get<Observation[]>(
      `/relationships/${lepidopteraId}/${plantId}/observations`,
      accessToken
    );

    return {
      success: response.success,
      data: response.data,
      error: response.error,
    };
  }
}

export const observationService = new ObservationService();
