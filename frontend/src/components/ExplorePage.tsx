import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Search, MapPin, Calendar, MessageSquare, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import { ObservationDetailModal } from './ObservationDetailModal';
import ExploreMap from './ExploreMap';
import { apiClient } from '../api/client';

interface Observation {
  id: string;
  user_id?: string;
  userId?: string;
  image_url?: string;
  lepidoptera?: {
    image?: string;
    species?: string;
    id?: string;
  };
  hostPlant?: {
    image?: string;
    species?: string;
    id?: string;
  };
  date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  created_at?: string;
  createdAt?: string;
  user?: {
    id: string;
    name: string;
  };
  comments?: any[];
  identifications?: any[];
  [key: string]: any; // Allow for additional fields from Supabase
}

interface ExplorePageProps {
  accessToken?: string;
  userId?: string;
  showOnlyUserObservations?: boolean;
}

export function ExplorePage({ accessToken, userId, showOnlyUserObservations = false }: ExplorePageProps) {
  const [activeTab, setActiveTab] = useState('map');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [filteredObservations, setFilteredObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [filterByLocation, setFilterByLocation] = useState<string>('');
  const [filterByUser, setFilterByUser] = useState<string>('');

  useEffect(() => {
    fetchObservations();
  }, [showOnlyUserObservations, userId]);

  useEffect(() => {
    // Filter observations based on search query and filters
    let filtered = observations;

    // Species search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(obs => {
        const lepidopteraSpecies = obs.lepidoptera?.species || '';
        const hostPlantSpecies = obs.hostPlant?.species || '';
        const searchLower = searchQuery.toLowerCase();
        return lepidopteraSpecies.toLowerCase().includes(searchLower) ||
               hostPlantSpecies.toLowerCase().includes(searchLower);
      });
    }

    // Location filter
    if (filterByLocation.trim()) {
      filtered = filtered.filter(obs =>
        (obs.location || '').toLowerCase().includes(filterByLocation.toLowerCase())
      );
    }

    // User filter
    if (filterByUser && filterByUser !== 'all') {
      filtered = filtered.filter(obs =>
        filterByUser === 'mine' 
          ? (obs.userId || obs.user_id) === userId 
          : (obs.userId || obs.user_id) !== userId
      );
    }

    setFilteredObservations(filtered);
  }, [searchQuery, observations, filterByLocation, filterByUser, userId]);

  const fetchObservations = async () => {
    setIsLoading(true);
    try {
      // Try backend API first, fallback to direct Supabase query
      const query = showOnlyUserObservations && userId ? `?userId=${userId}` : '';
      let response = await apiClient.get(`/observations${query}`, accessToken || undefined);

      // If backend fails, use fallback Supabase query
      if (!response.success) {
        console.log('Backend unavailable, using fallback Supabase query...');
        response = await apiClient.getObservations();
      }

      if (response.success) {
        setObservations(response.data || []);
        setFilteredObservations(response.data || []);
      } else {
        toast.error('Failed to load observations');
      }
    } catch (error) {
      console.error('Error fetching observations:', error);
      toast.error('Failed to load observations');
    } finally {
      setIsLoading(false);
    }
  };

  const MapView = () => (
    <div className="h-[600px] relative z-0">
      <ExploreMap
        observations={filteredObservations}
        height={600}
        onSelect={(obs) => setSelectedObservation(obs as Observation)}
        isModalOpen={!!selectedObservation}
      />
    </div>
  );

  const GridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredObservations.map((obs) => {
        const imageUrl = obs.image_url || obs.lepidoptera?.image;
        const lepidopteraSpecies = obs.lepidoptera?.species || 'Unknown';
        const hostPlantSpecies = obs.hostPlant?.species || 'Unknown';
        return (
          <Card
            key={obs.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedObservation(obs)}
          >
            <div className="relative h-48 bg-gray-200">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={lepidopteraSpecies}
                  className="w-full h-full object-cover rounded-t-lg"
                />
              )}
              {!imageUrl && (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}
              {obs.comments && obs.comments.length > 0 && (
                <Badge className="absolute top-2 right-2">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {obs.comments.length}
                </Badge>
              )}
            </div>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Lepidoptera</p>
                  <p className="font-medium truncate">{lepidopteraSpecies}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Host Plant</p>
                  <p className="text-sm truncate">{hostPlantSpecies}</p>
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="truncate">{obs.location || 'Unknown location'}</span>
                </div>
                {obs.user && (
                  <p className="text-xs text-gray-500">by {obs.user.name}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const ListView = () => (
    <div className="space-y-4">
      {filteredObservations.map((obs) => {
        const lepidopteraImage = obs.lepidoptera?.image;
        const hostPlantImage = obs.hostPlant?.image;
        const lepidopteraSpecies = obs.lepidoptera?.species || 'Unknown Species';
        const hostPlantSpecies = obs.hostPlant?.species || 'Unknown Host Plant';
        const observationDate = obs.date || obs.created_at;
        
        return (
          <Card
            key={obs.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedObservation(obs)}
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex gap-2">
                  {lepidopteraImage && (
                    <img
                      src={lepidopteraImage}
                      alt={lepidopteraSpecies}
                      className="w-24 h-24 object-cover rounded"
                    />
                  )}
                  {hostPlantImage && (
                    <img
                      src={hostPlantImage}
                      alt={hostPlantSpecies}
                      className="w-24 h-24 object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{lepidopteraSpecies}</h3>
                      <p className="text-sm text-gray-600">on {hostPlantSpecies}</p>
                    </div>
                    {obs.comments && obs.comments.length > 0 && (
                      <Badge variant="secondary">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {obs.comments.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{obs.location || 'Unknown location'}</span>
                      {obs.latitude && obs.longitude && (
                        <span className="ml-2 text-xs">
                          ({obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)})
                        </span>
                      )}
                    </div>
                    {observationDate && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{new Date(observationDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {obs.user && (
                      <p className="text-xs mt-2">Observed by {obs.user.name}</p>
                    )}
                  </div>
                  {obs.notes && (
                    <p className="mt-2 text-sm text-gray-700 line-clamp-2">{obs.notes}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-4">
          {showOnlyUserObservations ? 'Your Observations' : 'Explore Observations'}
        </h1>
        
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by species..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ChevronDown className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Location Filter */}
              <div className="px-3 py-2">
                <label className="text-sm font-medium block mb-2">Location</label>
                <Input
                  placeholder="Filter by location..."
                  value={filterByLocation}
                  onChange={(e) => setFilterByLocation(e.target.value)}
                  className="text-sm"
                />
              </div>

              <DropdownMenuSeparator />

              {/* User Filter */}
              <div className="px-3 py-2">
                <label className="text-sm font-medium block mb-2">Observations</label>
                <div className="space-y-2">
                  <DropdownMenuCheckboxItem
                    checked={filterByUser === 'all'}
                    onCheckedChange={() => setFilterByUser('all')}
                  >
                    All Observations
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filterByUser === 'mine'}
                    onCheckedChange={() => setFilterByUser('mine')}
                  >
                    My Observations
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filterByUser === 'others'}
                    onCheckedChange={() => setFilterByUser('others')}
                  >
                    Others' Observations
                  </DropdownMenuCheckboxItem>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Clear Filters */}
              <DropdownMenuItem onClick={() => {
                setFilterByLocation('');
                setFilterByUser('all');
                setSearchQuery('');
              }}>
                <span className="text-sm">Clear All Filters</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={fetchObservations}>
            Refresh
          </Button>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || filterByLocation || (filterByUser && filterByUser !== 'all')) && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {searchQuery && (
              <Badge variant="secondary">
                Species: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="ml-2">×</button>
              </Badge>
            )}
            {filterByLocation && (
              <Badge variant="secondary">
                Location: {filterByLocation}
                <button onClick={() => setFilterByLocation('')} className="ml-2">×</button>
              </Badge>
            )}
            {filterByUser === 'mine' && (
              <Badge variant="secondary">
                My Observations
                <button onClick={() => setFilterByUser('all')} className="ml-2">×</button>
              </Badge>
            )}
            {filterByUser === 'others' && (
              <Badge variant="secondary">
                Others' Observations
                <button onClick={() => setFilterByUser('all')} className="ml-2">×</button>
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          {isLoading ? (
            <div className="h-[600px] flex items-center justify-center">
              <p>Loading observations...</p>
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="h-[600px] flex items-center justify-center text-gray-500">
              <p>No observations found</p>
            </div>
          ) : (
            <MapView />
          )}
        </TabsContent>

        <TabsContent value="grid">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p>Loading observations...</p>
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No observations found</p>
            </div>
          ) : (
            <GridView />
          )}
        </TabsContent>

        <TabsContent value="list">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p>Loading observations...</p>
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No observations found</p>
            </div>
          ) : (
            <ListView />
          )}
        </TabsContent>
      </Tabs>

      <div className="relative z-50">
        {selectedObservation && (
          <ObservationDetailModal
            observation={selectedObservation}
            isOpen={!!selectedObservation}
            onClose={() => setSelectedObservation(null)}
            accessToken={accessToken}
            currentUserId={userId}
            onUpdate={fetchObservations}
          />
        )}
      </div>
    </div>
  );
}
