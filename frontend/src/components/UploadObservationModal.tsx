import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Upload, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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
  const [lepidopteraImage, setLepidopteraImage] = useState('');
  const [hostPlantImage, setHostPlantImage] = useState('');
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
    if (lepidopteraSearch.length > 2) {
      searchSpecies(lepidopteraSearch, 'lepidoptera');
    }
  }, [lepidopteraSearch]);

  useEffect(() => {
    if (hostPlantSearch.length > 2) {
      searchSpecies(hostPlantSearch, 'plant');
    }
  }, [hostPlantSearch]);

  const searchSpecies = async (query: string, type: 'lepidoptera' | 'plant') => {
    try {
      const response = await apiClient.get(
        `/species/search?q=${encodeURIComponent(query)}&type=${type}`,
        accessToken
      );

      if (response.success) {
        if (type === 'lepidoptera') {
          setLepidopteraSuggestions(response.data || []);
        } else {
          setHostPlantSuggestions(response.data || []);
        }
      }
    } catch (error) {
      console.error('Error searching species:', error);
    }
  };

  const handleImageUpload = (type: 'lepidoptera' | 'hostPlant') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === 'lepidoptera') {
          setLepidopteraImage(base64);
        } else {
          setHostPlantImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
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
          lepidopteraImage,
          lepidopteraSpecies,
          hostPlantImage,
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
            lepidopteraImage,
            lepidopteraSpecies,
            hostPlantImage,
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
      setLepidopteraImage('');
      setHostPlantImage('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  {lepidopteraImage ? (
                    <div className="relative">
                      <img src={lepidopteraImage} alt="Lepidoptera" className="w-full h-48 object-cover rounded" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        onClick={() => setLepidopteraImage('')}
                        title="Remove image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
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

              <div>
                <Label htmlFor="lepidoptera-species">Species</Label>
                <Popover open={showLepidopteraPopover} onOpenChange={setShowLepidopteraPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      type="button"
                    >
                      {lepidopteraSpecies || "Search species..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search species..." 
                        value={lepidopteraSearch}
                        onValueChange={setLepidopteraSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No species found.</CommandEmpty>
                        <CommandGroup>
                          {lepidopteraSuggestions.map((species) => (
                            <CommandItem
                              key={species.id}
                              onSelect={() => {
                                setLepidopteraSpecies(species.name);
                                setShowLepidopteraPopover(false);
                              }}
                            >
                              <div>
                                <div>{species.name}</div>
                                {species.commonName && (
                                  <div className="text-xs text-gray-500">{species.commonName}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Host Plant Section */}
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="font-semibold">Host Plant</h3>
              
              <div>
                <Label htmlFor="hostplant-image">Image</Label>
                <div className="mt-2">
                  {hostPlantImage ? (
                    <div className="relative">
                      <img src={hostPlantImage} alt="Host Plant" className="w-full h-48 object-cover rounded" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        onClick={() => setHostPlantImage('')}
                        title="Remove image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
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

              <div>
                <Label htmlFor="hostplant-species">Species</Label>
                <Popover open={showHostPlantPopover} onOpenChange={setShowHostPlantPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      type="button"
                    >
                      {hostPlantSpecies || "Search species..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search species..." 
                        value={hostPlantSearch}
                        onValueChange={setHostPlantSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No species found.</CommandEmpty>
                        <CommandGroup>
                          {hostPlantSuggestions.map((species) => (
                            <CommandItem
                              key={species.id}
                              onSelect={() => {
                                setHostPlantSpecies(species.name);
                                setShowHostPlantPopover(false);
                              }}
                            >
                              <div>
                                <div>{species.name}</div>
                                {species.commonName && (
                                  <div className="text-xs text-gray-500">{species.commonName}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
