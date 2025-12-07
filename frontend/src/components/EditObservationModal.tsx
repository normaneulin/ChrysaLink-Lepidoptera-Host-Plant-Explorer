import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client';
import { createClient } from '@supabase/supabase-js';

interface EditObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  observation: any;
  onSuccess: () => void;
  onDelete: () => Promise<void> | void;
}

// Helper to safely extract an ISO date string and a time string from the observation
const getInitialDateAndTime = (observation: any) => {
  const raw = observation?.observed_at || observation?.date_observed || observation?.date || observation?.observation_date || null;
  if (!raw) return { date: '', time: '08:00' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: '', time: '08:00' };
  const iso = d.toISOString();
  const [datePart, timePart] = iso.split('T');
  return { date: datePart, time: (timePart || '').slice(0, 5) || '08:00' };
};

export function EditObservationModal({ isOpen, onClose, accessToken, observation, onSuccess, onDelete }: EditObservationModalProps) {
  const { date: initialDate, time: initialTime } = getInitialDateAndTime(observation);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lepidopteraImages, setLepidopteraImages] = useState<string[]>([]);
  const [hostPlantImages, setHostPlantImages] = useState<string[]>([]);
  const [lepidopteraSpecies, setLepidopteraSpecies] = useState('');
  const [lepidopteraTaxonomicLevel, setLepidopteraTaxonomicLevel] = useState('');
  const [lepidopteraId, setLepidopteraId] = useState<string>('');
  const [hostPlantSpecies, setHostPlantSpecies] = useState('');
  const [hostPlantTaxonomicLevel, setHostPlantTaxonomicLevel] = useState('');
  const [hostPlantId, setHostPlantId] = useState<string>('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
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

  // Seed initial values when observation changes
  useEffect(() => {
    setLepidopteraImages(observation?.lepidoptera?.image ? [observation.lepidoptera.image] : observation?.image_url ? [observation.image_url] : []);
    setHostPlantImages(observation?.hostPlant?.image ? [observation.hostPlant.image] : observation?.plant_image_url ? [observation.plant_image_url] : []);
    const lepId = observation?.lepidoptera_current_identification || observation?.lepidoptera?.species || '';
    const plantId = observation?.plant_current_identification || observation?.hostPlant?.species || '';
    setLepidopteraSpecies(lepId);
    setHostPlantSpecies(plantId);
    setLepidopteraSearch(lepId);
    setHostPlantSearch(plantId);
    setLocation(observation?.location || '');
    setLatitude(observation?.latitude ? String(observation.latitude) : '');
    setLongitude(observation?.longitude ? String(observation.longitude) : '');
    setNotes(observation?.notes || '');
    const { date: d, time: t } = getInitialDateAndTime(observation);
    setDate(d);
    setTime(t);
  }, [observation]);

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

      const response = await apiClient.get(
        `/species/search?q=${encodeURIComponent(query)}&type=${type}`,
        accessToken
      );

      if (response.success) {
        let results = response.data || [];
        const hasGenusMatch = results.some((item: any) => item.taxonomic_level === 'genus');

        if (hasGenusMatch) {
          const genusName = results.find((item: any) => item.taxonomic_level === 'genus')?.display_name;
          results = results.filter((item: any) => (item.genus === genusName) && (item.is_placeholder || !item.is_placeholder));
        } else {
          results = results.filter((item: any) => item.is_placeholder);
        }

        if (type === 'lepidoptera') {
          setLepidopteraSuggestions(results);
        } else {
          setHostPlantSuggestions(results);
        }
      } else {
        if (type === 'lepidoptera') {
          setLepidopteraSuggestions([]);
        } else {
          setHostPlantSuggestions([]);
        }
      }
    } catch (error) {
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
    if (lepidopteraSearchTimeout.current) clearTimeout(lepidopteraSearchTimeout.current);
    if (lepidopteraSearch.length > 0) {
      lepidopteraSearchTimeout.current = setTimeout(() => {
        searchSpecies(lepidopteraSearch, 'lepidoptera');
      }, 300);
    } else {
      setLepidopteraSuggestions([]);
    }
    return () => {
      if (lepidopteraSearchTimeout.current) clearTimeout(lepidopteraSearchTimeout.current);
    };
  }, [lepidopteraSearch]);

  useEffect(() => {
    if (hostPlantSearchTimeout.current) clearTimeout(hostPlantSearchTimeout.current);
    if (hostPlantSearch.length > 0) {
      hostPlantSearchTimeout.current = setTimeout(() => {
        searchSpecies(hostPlantSearch, 'plant');
      }, 300);
    } else {
      setHostPlantSuggestions([]);
    }
    return () => {
      if (hostPlantSearchTimeout.current) clearTimeout(hostPlantSearchTimeout.current);
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
        () => {
          toast.error('Failed to get location');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observation?.id) {
      toast.error('Missing observation id');
      return;
    }
    setIsSaving(true);

    try {
      const observationDateTime = date && time ? `${date}T${time}` : date;
      const lepidopteraIdentification = lepidopteraSpecies || lepidopteraSearch;
      const plantIdentification = hostPlantSpecies || hostPlantSearch;

      const payload: any = {
        lepidopteraImages,
        hostPlantImages,
        lepidopteraSpecies: lepidopteraSpecies || null,
        hostPlantSpecies: hostPlantSpecies || null,
        lepidoptera_id: lepidopteraId || null,
        plant_id: hostPlantId || null,
        // Send both for compatibility with backend and direct Supabase update
        observation_date: observationDateTime,
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

      let response = await apiClient.put(`/observations/${observation.id}`, payload, accessToken);

      // If the edge function fails, fall back to direct Supabase update so critical fields are saved.
      if (!response.success) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          const sb = createClient(supabaseUrl, supabaseAnonKey);

          const { data: userData } = await sb.auth.getUser();
          const userId = userData?.user?.id;

          // Preserve existing values if the form left them blank
          const latVal = latitude !== '' ? parseFloat(latitude) : (observation?.latitude ?? null);
          const lonVal = longitude !== '' ? parseFloat(longitude) : (observation?.longitude ?? null);
          const locVal = location !== '' ? location : (observation?.location ?? null);
          const dateVal = observationDateTime || observation?.observation_date || observation?.observed_at || null;
          const notesVal = notes !== '' ? notes : (observation?.notes ?? null);

          const updatePayload: any = {
            location: locVal,
            latitude: latVal,
            longitude: lonVal,
            observation_date: dateVal,
            notes: notesVal,
            lepidoptera_current_identification: lepidopteraIdentification || null,
            plant_current_identification: plantIdentification || null,
          };

          if (lepidopteraId) updatePayload.lepidoptera_id = lepidopteraId;
          if (hostPlantId) updatePayload.plant_id = hostPlantId;

          const { error: updErr } = await sb.from('observations').update(updatePayload).eq('id', observation.id);
          if (updErr) throw updErr;

          // Replace images only when new images are provided
          const uploadBase64Image = async (base64: string, type: 'lepidoptera' | 'plant') => {
            if (!userId) return null;
            const res = await fetch(base64);
            const blob = await res.blob();
            const fileExt = (blob.type.split('/')?.[1]) || 'png';
            const path = `${userId}/${observation.id}/${Date.now()}-${type}.${fileExt}`;
            const { data: stored, error: storeErr } = await sb.storage.from('observation_images').upload(path, blob, { upsert: true });
            if (storeErr) throw storeErr;
            const { data: pub } = sb.storage.from('observation_images').getPublicUrl(stored.path);
            return pub?.publicUrl || null;
          };

          const replaceImages = async (imgs: string[], type: 'lepidoptera' | 'plant') => {
            if (!imgs || imgs.length === 0 || !userId) return;
            // Remove old images of this type
            await sb.from('observation_images').delete().eq('observation_id', observation.id).eq('image_type', type);
            const url = await uploadBase64Image(imgs[0], type);
            if (url) {
              await sb.from('observation_images').insert([{ observation_id: observation.id, image_url: url, image_type: type }]);
            }
          };

          await replaceImages(lepidopteraImages, 'lepidoptera');
          await replaceImages(hostPlantImages, 'plant');

          response = { success: true };
        } catch (fallbackErr: any) {
          console.error('Edit fallback error', fallbackErr);
          throw new Error(response.error || fallbackErr?.message || 'Failed to save observation');
        }
      }

      toast.success('Observation updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save observation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete observation');
    } finally {
      setIsDeleting(false);
    }
  };

  // Prevent closing on outside click to avoid accidental loss
  const [internalOpen, setInternalOpen] = useState(isOpen);
  useEffect(() => { setInternalOpen(isOpen); }, [isOpen]);
  const handleOpenChange = (open: boolean) => {
    if (!open && internalOpen) {
      setInternalOpen(true);
    }
  };

  return (
    <Dialog open={internalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-observation-description">
        <RadixDialog.Description id="edit-observation-description" className="sr-only">
          Edit an existing observation, including images and details.
        </RadixDialog.Description>
        <DialogHeader>
          <DialogTitle>Edit Observation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Lepidoptera Section */}
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="font-semibold">Lepidoptera</h3>

              <div>
                <Label htmlFor="lepidoptera-image-edit">Image</Label>
                <div className="mt-2">
                  <div className="relative">
                    {lepidopteraImages.length > 0 && (
                      <>
                        <img src={lepidopteraImages[0]} alt="Lepidoptera" className="w-full h-48 object-cover rounded" />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {lepidopteraImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Lepidoptera ${idx + 1}`} className="w-12 h-12 object-cover rounded border" />
                          ))}
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
                          id="lepidoptera-image-edit"
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
                <Label htmlFor="lepidoptera-species-edit">Species</Label>
                <div className="relative">
                  <Input
                    id="lepidoptera-species-edit"
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
                <Label htmlFor="hostplant-image-edit">Image</Label>
                <div className="mt-2">
                  <div className="relative">
                    {hostPlantImages.length > 0 && (
                      <>
                        <img src={hostPlantImages[0]} alt="Host Plant" className="w-full h-48 object-cover rounded" />
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {hostPlantImages.map((img, idx) => (
                            <img key={idx} src={img} alt={`Host Plant ${idx + 1}`} className="w-12 h-12 object-cover rounded border" />
                          ))}
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
                          id="hostplant-image-edit"
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
                <Label htmlFor="hostplant-species-edit">Species</Label>
                <div className="relative">
                  <Input
                    id="hostplant-species-edit"
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
                  <Label htmlFor="date-edit">Date</Label>
                  <Input
                    id="date-edit"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time-edit">Time</Label>
                  <Input
                    id="time-edit"
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
                <Label htmlFor="location-edit">Location Name</Label>
                <Input
                  id="location-edit"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Central Park, NYC"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="latitude-edit">Latitude</Label>
                <Input
                  id="latitude-edit"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="40.7128"
                />
              </div>
              <div>
                <Label htmlFor="longitude-edit">Longitude</Label>
                <Input
                  id="longitude-edit"
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
              <Label htmlFor="notes-edit">Notes</Label>
              <Textarea
                id="notes-edit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional observations, habitat details, behavior, etc."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-4 justify-between">
            <Button type="button" variant="destructive" onClick={handleDeleteClick} disabled={isDeleting || isSaving}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
      <DialogDescription className="sr-only">Edit observation modal</DialogDescription>
    </Dialog>
  );
}
