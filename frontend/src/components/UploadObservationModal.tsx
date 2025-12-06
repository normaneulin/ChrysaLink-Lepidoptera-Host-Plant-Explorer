import { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription 
} from './ui/dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client';
import { createClient } from '@supabase/supabase-js';

interface UploadObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  onSuccess: () => void;
}

export function UploadObservationModal({ isOpen, onClose, accessToken, onSuccess }: UploadObservationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lepidopteraImages, setLepidopteraImages] = useState<string[]>([]);
  const [hostPlantImages, setHostPlantImages] = useState<string[]>([]);
  const [lepidopteraSpecies, setLepidopteraSpecies] = useState('');
  const [lepidopteraTaxonomicLevel, setLepidopteraTaxonomicLevel] = useState('');
  const [lepidopteraId, setLepidopteraId] = useState<string>('');
  const [hostPlantSpecies, setHostPlantSpecies] = useState('');
  const [hostPlantTaxonomicLevel, setHostPlantTaxonomicLevel] = useState('');
  const [hostPlantId, setHostPlantId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('08:00'); // Default to 8am
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  
  const [lepidopteraSearch, setLepidopteraSearch] = useState('');
  const [hostPlantSearch, setHostPlantSearch] = useState('');
  const [lepidopteraSuggestions, setLepidopteraSuggestions] = useState<any[]>([]);
  const [hostPlantSuggestions, setHostPlantSuggestions] = useState<any[]>([]);
  const [showLepidopteraPopover, setShowLepidopteraPopover] = useState(false);
  const [showHostPlantPopover, setShowHostPlantPopover] = useState(false);
  const [isSearchingLepidoptera, setIsSearchingLepidoptera] = useState(false);
  const [isSearchingHostPlant, setIsSearchingHostPlant] = useState(false);

  // Debounce timers for search
  const lepidopteraSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const hostPlantSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const searchSpecies = async (query: string, type: 'lepidoptera' | 'plant') => {
    if (!query || query.length < 1) {
      if (type === 'lepidoptera') {
        setLepidopteraSuggestions([]);
      } else {
        setHostPlantSuggestions([]);
      }
      return;
    }

    try {
      if (type === 'lepidoptera') {
        setIsSearchingLepidoptera(true);
      } else {
        setIsSearchingHostPlant(true);
      }
      console.log('Searching for:', query, 'type:', type);
      const response = await apiClient.get(
        `/species/search?q=${encodeURIComponent(query)}&type=${type}`,
        accessToken
      );

      console.log('Search response:', response);

      if (response.success) {
        let results = response.data || [];
        
        // Filter logic: Only show placeholders, UNLESS genus level is matched
        // Using proper operator precedence with parentheses to match SQL logic:
        // WHERE (scientific_name IS NULL OR scientific_name = '') AND (genus = 'GenusName')
        const hasGenusMatch = results.some(item => item.taxonomic_level === 'genus');
        
        if (hasGenusMatch) {
          // If genus is matched, show:
          // - All placeholders (scientific_name IS NULL OR empty) with that genus
          // - All species (scientific_name NOT NULL) with that genus
          const genusName = results.find(item => item.taxonomic_level === 'genus')?.display_name;
          results = results.filter(item => 
            (item.genus === genusName) && (item.is_placeholder || !item.is_placeholder)
          );
        } else {
          // Otherwise, show only placeholders (no genus match yet)
          // WHERE (scientific_name IS NULL OR scientific_name = '')
          results = results.filter(item => item.is_placeholder);
        }
        
        if (type === 'lepidoptera') {
          console.log('Lepidoptera suggestions: ' + results.length + ' results');
          setLepidopteraSuggestions(results);
        } else {
          console.log('Plant suggestions: ' + results.length + ' results');
          setHostPlantSuggestions(results);
        }
      } else {
        console.error('Search failed:', response.error);
        if (type === 'lepidoptera') {
          setLepidopteraSuggestions([]);
        } else {
          setHostPlantSuggestions([]);
        }
      }
    } catch (error) {
      console.error('Error searching species:', error);
      if (type === 'lepidoptera') {
        setLepidopteraSuggestions([]);
      } else {
        setHostPlantSuggestions([]);
      }
    } finally {
      if (type === 'lepidoptera') {
        setIsSearchingLepidoptera(false);
      } else {
        setIsSearchingHostPlant(false);
      }
    }
  };

  useEffect(() => {
    // Clear previous timeout
    if (lepidopteraSearchTimeout.current) {
      clearTimeout(lepidopteraSearchTimeout.current);
    }

    // Set new timeout for debounced search
    if (lepidopteraSearch.length > 0) {
      lepidopteraSearchTimeout.current = setTimeout(() => {
        searchSpecies(lepidopteraSearch, 'lepidoptera');
      }, 300); // 300ms debounce
    } else {
      setLepidopteraSuggestions([]);
    }

    return () => {
      if (lepidopteraSearchTimeout.current) {
        clearTimeout(lepidopteraSearchTimeout.current);
      }
    };
  }, [lepidopteraSearch]);

  useEffect(() => {
    // Clear previous timeout
    if (hostPlantSearchTimeout.current) {
      clearTimeout(hostPlantSearchTimeout.current);
    }

    // Set new timeout for debounced search
    if (hostPlantSearch.length > 0) {
      hostPlantSearchTimeout.current = setTimeout(() => {
        searchSpecies(hostPlantSearch, 'plant');
      }, 300); // 300ms debounce
    } else {
      setHostPlantSuggestions([]);
    }

    return () => {
      if (hostPlantSearchTimeout.current) {
        clearTimeout(hostPlantSearchTimeout.current);
      }
    };
  }, [hostPlantSearch]);

  const handleImageUpload = (type: 'lepidoptera' | 'hostPlant') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'lepidoptera') {
        setLepidopteraImages([base64]);
      } else {
        setHostPlantImages([base64]);
      }
    };
    reader.readAsDataURL(file);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          toast.success('Location captured!');
        },
        (error) => {
          toast.error('Failed to get location');
          console.error('Location error:', error);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Combine date and time into ISO string
      const observationDateTime = date && time ? `${date}T${time}` : date;

      // Fallback: use search bar value if species state is empty
      const lepidopteraIdentification = lepidopteraSpecies || lepidopteraSearch;
      const plantIdentification = hostPlantSpecies || hostPlantSearch;

      // Try backend API first
      const payload: any = {
        lepidopteraImages,
        hostPlantImages,
        lepidopteraSpecies: lepidopteraSpecies || null,
        hostPlantSpecies: hostPlantSpecies || null,
        lepidoptera_id: lepidopteraId || null,
        plant_id: hostPlantId || null,
        date: observationDateTime,
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        notes,
      };

      if (lepidopteraIdentification && lepidopteraIdentification.trim().length > 0) {
        payload.lepidoptera_current_identification = lepidopteraIdentification;
      }
      if (plantIdentification && plantIdentification.trim().length > 0) {
        payload.plant_current_identification = plantIdentification;
      }

      let response = await apiClient.post('/observations', payload, accessToken);

      // If backend fails, use fallback Supabase method
      if (!response.success) {
        console.log('Backend unavailable, using fallback Supabase query...');

        // Get current user ID from Supabase auth
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          throw new Error('User not authenticated');
        }

        const fallbackPayload: any = {
          lepidopteraImages,
          hostPlantImages,
          lepidopteraSpecies: lepidopteraSpecies || null,
          hostPlantSpecies: hostPlantSpecies || null,
          lepidoptera_id: lepidopteraId || null,
          plant_id: hostPlantId || null,
          date: observationDateTime,
          location,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          notes,
        };
        if (lepidopteraIdentification && lepidopteraIdentification.trim().length > 0) {
          fallbackPayload.lepidoptera_current_identification = lepidopteraIdentification;
        }
        if (plantIdentification && plantIdentification.trim().length > 0) {
          fallbackPayload.plant_current_identification = plantIdentification;
        }

        response = await apiClient.createObservation(fallbackPayload, user.id);
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to create observation');
      }

      // If the user provided identifications during upload, create identification rows
      // so they appear in the Activity feed and other users can agree.
      const createdObs: any = response.data;
      try {
        const obsId = createdObs?.id;
        if (obsId) {
          // Helper to suggest an identification with fallback to Supabase insert when no accessToken
          const suggestWithFallback = async (payload: any) => {
            // First try edge function when accessToken is present
            if (accessToken) {
              try {
                // Debug: log payload presence of caption/reason before calling edge function
                // eslint-disable-next-line no-console
                console.debug('Uploading observation - suggestWithFallback payload ->', { observation_id: payload.observation_id, species: payload.species, captionProvided: !!(payload.reason || payload.caption) });
                const resp = await apiClient.post('/suggest-identification', payload, accessToken);
                if (resp && resp.success) return resp;
                // If the function call failed, fall through to Supabase fallback
                console.warn('Edge suggest-identification failed, falling back to Supabase:', resp?.error);
              } catch (err) {
                console.warn('Edge suggest-identification request error, falling back to Supabase:', err);
              }
            }

            // Supabase fallback: use anon client to read current session user and insert directly
            try {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
              const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
              const sb = createClient(supabaseUrl, supabaseAnonKey);

              const { data: userData, error: userErr } = await sb.auth.getUser();
              const user = userData?.user;
              if (!user?.id) {
                console.warn('No authenticated session for Supabase fallback — skipping identification insert');
                return null;
              }

              const identPayload: any = {
                observation_id: payload.observation_id,
                user_id: user.id,
                species: payload.species,
                scientific_name: payload.scientific_name || null,
                // include caption/reason if provided so "Tell us why" is persisted
                caption: payload.reason || payload.caption || null,
                identification_type: payload.identification_type || payload.identificationType || 'lepidoptera',
                is_auto_suggested: false,
              };

              // Avoid requesting returned representation on insert to prevent PostgREST `columns=` behavior
              const { error: identErr } = await sb.from('identifications').insert([identPayload]);
              let identData: any = null;
              if (identErr) {
                console.warn('Supabase identifications insert error:', identErr);
                return null;
              }
              try {
                const { data: fetched, error: fetchErr } = await sb.from('identifications')
                  .select('*')
                  .eq('observation_id', identPayload.observation_id)
                  .eq('user_id', identPayload.user_id)
                  .eq('species', identPayload.species)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (!fetchErr && fetched) identData = fetched;
              } catch (e) {
                // ignore
              }
              if (!identData) return null;

              // Add initial vote for the suggester
              try {
                console.debug('Inserting identification_vote (upload fallback) for ident', identData?.id, 'user', user?.id, '\nstack:', new Error().stack);
                await sb.from('identification_votes').insert([{ identification_id: identData.id, user_id: user.id }]);
              } catch (voteErr) {
                console.warn('Failed to insert initial identification vote in fallback:', voteErr);
              }

              return { success: true, data: identData };
            } catch (fallbackErr) {
              console.warn('Identification fallback failed:', fallbackErr);
              return null;
            }
          };

          // Lepidoptera identification
          if (lepidopteraIdentification && lepidopteraIdentification.trim().length > 0) {
            await suggestWithFallback({ observation_id: obsId, species: lepidopteraIdentification, identification_type: 'lepidoptera', scientific_name: lepidopteraSpecies || null });
          }

          // Host plant identification
          if (plantIdentification && plantIdentification.trim().length > 0) {
            await suggestWithFallback({ observation_id: obsId, species: plantIdentification, identification_type: 'hostPlant', scientific_name: hostPlantSpecies || null });
          }
        }
      } catch (e) {
        console.warn('Error while creating initial identifications:', e);
      }

      toast.success('Observation uploaded successfully!');
      onSuccess();
      onClose();

      // Refresh the page so the home view shows the newly uploaded observation.
      // Delay slightly to allow the modal to close and any navigation to settle.
      try {
        if (typeof window !== 'undefined' && window.location) {
          setTimeout(() => window.location.reload(), 200);
        }
      } catch (e) {
        console.warn('Failed to reload page after upload', e);
      }

      // Reset form
      setLepidopteraImages([]);
      setHostPlantImages([]);
      setLepidopteraSpecies('');
      setHostPlantSpecies('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setNotes('');
      setTime('08:00');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload observation');
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent closing on outside click
  const [internalOpen, setInternalOpen] = useState(isOpen);
  useEffect(() => { setInternalOpen(isOpen); }, [isOpen]);
  const handleOpenChange = (open: boolean) => {
    // Only allow closing if explicitly triggered (Cancel or X button)
    if (!open && internalOpen) {
      // Do nothing (ignore outside click)
      setInternalOpen(true);
    }
  };
  return (
    <Dialog open={internalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="upload-observation-description">
        <RadixDialog.Description id="upload-observation-description" className="sr-only">
          Upload a new observation, including images and details.
        </RadixDialog.Description>
        <DialogHeader>
          <RadixDialog.Title>Upload Observation</RadixDialog.Title>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Lepidoptera Section */}
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="font-semibold">Lepidoptera</h3>
              
              <div>
                <Label htmlFor="lepidoptera-image">Image</Label>
                <div className="mt-2">
                  <div className="relative">
                    {lepidopteraImages.length > 0 && (
                      <>
                        <img src={lepidopteraImages[0]} alt="Lepidoptera" className="w-full h-48 object-cover rounded" />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {lepidopteraImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Lepidoptera ${idx+1}`} className="w-12 h-12 object-cover rounded border" />
                          ))}
                          {/* Multiple photo add disabled */}
                        </div>
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                          onClick={() => setLepidopteraImages([])}
                          title="Remove all images"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                    {lepidopteraImages.length === 0 && (
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload</span>
                        <input
                          id="lepidoptera-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload('lepidoptera')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="lepidoptera-species">Species</Label>
                <div className="relative">
                  <Input
                    id="lepidoptera-species"
                    value={lepidopteraSearch}
                    onChange={(e) => {
                      setLepidopteraSearch(e.target.value);
                      setShowLepidopteraPopover(true);
                    }}
                    onFocus={() => setShowLepidopteraPopover(true)}
                    placeholder="Type to search species..."
                  />
                  {isSearchingLepidoptera && <div className="absolute z-50 w-full mt-1 p-3 bg-white border rounded-md text-sm text-gray-500">Searching...</div>}
                  {showLepidopteraPopover && !isSearchingLepidoptera && lepidopteraSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {lepidopteraSuggestions.map((species) => (
                        <button
                          key={species.id}
                          type="button"
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 ${species.is_placeholder ? 'bg-amber-50' : ''}`}
                          onClick={() => {
                            setLepidopteraId(species.id || '');
                            if (species.taxonomic_level === 'family') {
                              setLepidopteraSpecies(species.display_name || species.scientific_name);
                              setLepidopteraTaxonomicLevel('family');
                            } else {
                              setLepidopteraSpecies(species.display_name || species.scientific_name);
                              setLepidopteraTaxonomicLevel(species.taxonomic_level || '');
                            }
                            setLepidopteraSearch(species.display_name || species.scientific_name);
                            setShowLepidopteraPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`font-medium ${!species.is_placeholder ? 'italic' : ''}`}>
                              {species.display_name || species.scientific_name}
                            </div>
                            {species.taxonomic_level && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${species.is_placeholder ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {species.taxonomic_level}
                              </span>
                            )}
                          </div>
                          {species.common_name && (
                            <div className="text-xs text-gray-500">{species.common_name}</div>
                          )}
                          {species.family && species.taxonomic_level !== 'family' && !species.is_placeholder && (
                            <div className="text-xs text-gray-400">Family: {species.family}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Host Plant Section */}
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="font-semibold">Host Plant</h3>
              
              <div>
                <Label htmlFor="hostplant-image">Image</Label>
                <div className="mt-2">
                  <div className="relative">
                    {hostPlantImages.length > 0 && (
                      <>
                        <img src={hostPlantImages[0]} alt="Host Plant" className="w-full h-48 object-cover rounded" />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {hostPlantImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Host Plant ${idx+1}`} className="w-12 h-12 object-cover rounded border" />
                          ))}
                          {/* Multiple photo add disabled */}
                        </div>
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                          onClick={() => setHostPlantImages([])}
                          title="Remove all images"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                    {hostPlantImages.length === 0 && (
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload</span>
                        <input
                          id="hostplant-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload('hostPlant')}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="hostplant-species">Species</Label>
                <div className="relative">
                  <Input
                    id="hostplant-species"
                    value={hostPlantSearch}
                    onChange={(e) => {
                      setHostPlantSearch(e.target.value);
                      setShowHostPlantPopover(true);
                    }}
                    onFocus={() => setShowHostPlantPopover(true)}
                    placeholder="Type to search species..."
                  />
                  {isSearchingHostPlant && <div className="absolute z-50 w-full mt-1 p-3 bg-white border rounded-md text-sm text-gray-500">Searching...</div>}
                  {showHostPlantPopover && !isSearchingHostPlant && hostPlantSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {hostPlantSuggestions.map((species) => (
                        <button
                          key={species.id}
                          type="button"
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 ${species.is_placeholder ? 'bg-emerald-50' : ''}`}
                          onClick={() => {
                            setHostPlantId(species.id || '');
                            if (species.taxonomic_level === 'family') {
                              setHostPlantSpecies(species.display_name || species.scientific_name);
                              setHostPlantTaxonomicLevel('family');
                            } else {
                              setHostPlantSpecies(species.display_name || species.scientific_name);
                              setHostPlantTaxonomicLevel(species.taxonomic_level || '');
                            }
                            setHostPlantSearch(species.display_name || species.scientific_name);
                            setShowHostPlantPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`font-medium ${!species.is_placeholder ? 'italic' : ''}`}>
                              {species.display_name || species.scientific_name}
                            </div>
                            {species.taxonomic_level && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${species.is_placeholder ? 'bg-emerald-100 text-emerald-700' : 'bg-green-100 text-green-700'}`}>
                                {species.taxonomic_level}
                              </span>
                            )}
                          </div>
                          {species.common_name && (
                            <div className="text-xs text-gray-500">{species.common_name}</div>
                          )}
                          {species.family && species.taxonomic_level !== 'family' && !species.is_placeholder && (
                            <div className="text-xs text-gray-400">Family: {species.family}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Common Fields */}
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-2 items-end">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location Name</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Central Park, NYC"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="40.7128"
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-74.0060"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full">
                  Use Current Location
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional observations, habitat details, behavior, etc."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Upload Observation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
