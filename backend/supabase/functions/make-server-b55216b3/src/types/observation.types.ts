/**
 * Observation related type definitions
 */

export interface CreateObservationData {
  lepidopteraImage: string;
  lepidopteraSpecies: string;
  hostPlantImage: string;
  hostPlantSpecies: string;
  date: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  notes: string;
}

export interface SearchSpeciesParams {
  query: string;
  type: "lepidoptera" | "plant";
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
