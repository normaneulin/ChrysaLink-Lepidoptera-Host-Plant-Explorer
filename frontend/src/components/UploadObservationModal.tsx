import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
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
  const [hostPlantSpecies, setHostPlantSpecies] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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

  useEffect(() => {
    if (lepidopteraSearch.length > 0) {
      searchSpecies(lepidopteraSearch, 'lepidoptera');
    } else {
      setLepidopteraSuggestions([]);
    }
  }, [lepidopteraSearch]);

  useEffect(() => {
    if (hostPlantSearch.length > 0) {
      searchSpecies(hostPlantSearch, 'plant');
    } else {
      setHostPlantSuggestions([]);
    }
  }, [hostPlantSearch]);

  const searchSpecies = async (query: string, type: 'lepidoptera' | 'plant') => {
    try {
      console.log('Searching for:', query, 'type:', type);
      const response = await apiClient.get(
        `/species/search?q=${encodeURIComponent(query)}&type=${type}`,
        accessToken
      );

      console.log('Search response:', response);

      if (response.success) {
        if (type === 'lepidoptera') {
          setLepidopteraSuggestions(response.data || []);
          console.log('Lepidoptera suggestions:', response.data);
        } else {
          setHostPlantSuggestions(response.data || []);
          console.log('Plant suggestions:', response.data);
        }
      } else {
        console.error('Search failed:', response.error);
      }
    } catch (error) {
      console.error('Error searching species:', error);
    }
  };

  const handleImageUpload = (type: 'lepidoptera' | 'hostPlant') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === 'lepidoptera') {
          setLepidopteraImages(prev => [...prev, base64]);
        } else {
          setHostPlantImages(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
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
      // Try backend API first
      let response = await apiClient.post(
        '/observations',
        {
          lepidopteraImages,
          lepidopteraSpecies,
          hostPlantImages,
          hostPlantSpecies,
          date,
          location,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          notes
        },
        accessToken
      );

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

        response = await apiClient.createObservation(
          {
            lepidopteraImages,
            lepidopteraSpecies,
            hostPlantImages,
            hostPlantSpecies,
            date,
            location,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            notes
          },
          user.id
        );
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to create observation');
      }

      toast.success('Observation uploaded successfully!');
      onSuccess();
      onClose();
      
      // Reset form
      setLepidopteraImages([]);
      setHostPlantImages([]);
      setLepidopteraSpecies('');
      setHostPlantSpecies('');
      setLocation('');
      setLatitude('');
      setLongitude('');
      setNotes('');
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
      <DialogContent className="!max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Observation</DialogTitle>
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
                          {lepidopteraImages.length < 10 && (
                            <label className="flex flex-col items-center justify-center w-12 h-12 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ml-2">
                              <Upload className="h-5 w-5 text-gray-400 mb-1" />
                              <span className="text-xs text-gray-500">Add</span>
                              <input
                                id="lepidoptera-image-add"
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload('lepidoptera')}
                              />
                            </label>
                          )}
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
                          multiple
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
                  {showLepidopteraPopover && lepidopteraSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {lepidopteraSuggestions.map((species) => (
                        <button
                          key={species.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                          onClick={() => {
                            setLepidopteraSpecies(species.display_name || species.scientific_name);
                            setLepidopteraSearch(species.display_name || species.scientific_name);
                            setShowLepidopteraPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="font-medium italic">{species.display_name || species.scientific_name}</div>
                            {species.taxonomic_level && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                {species.taxonomic_level}
                              </span>
                            )}
                          </div>
                          {species.common_name && (
                            <div className="text-xs text-gray-500">{species.common_name}</div>
                          )}
                          {species.family && species.taxonomic_level !== 'family' && (
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
                          {hostPlantImages.length < 10 && (
                            <label className="flex flex-col items-center justify-center w-12 h-12 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ml-2">
                              <Upload className="h-5 w-5 text-gray-400 mb-1" />
                              <span className="text-xs text-gray-500">Add</span>
                              <input
                                id="hostplant-image-add"
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload('hostPlant')}
                              />
                            </label>
                          )}
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
                          multiple
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
                  {showHostPlantPopover && hostPlantSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {hostPlantSuggestions.map((species) => (
                        <button
                          key={species.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                          onClick={() => {
                            setHostPlantSpecies(species.display_name || species.scientific_name);
                            setHostPlantSearch(species.display_name || species.scientific_name);
                            setShowHostPlantPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="font-medium italic">{species.display_name || species.scientific_name}</div>
                            {species.taxonomic_level && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                {species.taxonomic_level}
                              </span>
                            )}
                          </div>
                          {species.common_name && (
                            <div className="text-xs text-gray-500">{species.common_name}</div>
                          )}
                          {species.family && species.taxonomic_level !== 'family' && (
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
