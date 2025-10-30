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
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';
import { ObservationDetailModal } from './ObservationDetailModal';
import ExploreMap from './ExploreMap';
import { getSupabaseClient } from '../utils/supabase/client';

interface Observation {
  id: string;
  userId: string;
  lepidoptera: {
    image: string;
    species: string;
  };
  hostPlant: {
    image: string;
    species: string;
  };
  date: string;
  location: string;
  latitude?: number;
  longitude?: number;
  notes: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  };
  comments?: any[];
  identifications?: any[];
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
      filtered = filtered.filter(obs => 
        obs.lepidoptera.species?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obs.hostPlant.species?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Location filter
    if (filterByLocation.trim()) {
      filtered = filtered.filter(obs =>
        obs.location?.toLowerCase().includes(filterByLocation.toLowerCase())
      );
    }

    // User filter
    if (filterByUser && filterByUser !== 'all') {
      filtered = filtered.filter(obs =>
        filterByUser === 'mine' 
          ? obs.userId === userId 
          : obs.userId !== userId
      );
    }

    setFilteredObservations(filtered);
  }, [searchQuery, observations, filterByLocation, filterByUser, userId]);

  const fetchObservations = async () => {
    setIsLoading(true);
    try {
      // Try serverless function first
      const url = showOnlyUserObservations && userId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations?userId=${userId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setObservations(data.observations || []);
        setFilteredObservations(data.observations || []);
        return;
      }

      // If serverless fails, fetch directly from Supabase KV store
      console.log('Serverless function unavailable, fetching from KV store...');
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('kv_store_b55216b3')
        .select('value')
        .like('key', 'obs:%');

      if (error) {
        throw new Error(error.message || 'Failed to fetch observations');
      }

      // Parse the KV store values
      let obs = data
        ?.map((item: any) => {
          try {
            return typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          } catch (e) {
            console.error('Error parsing observation:', e);
            return null;
          }
        })
        .filter(Boolean) || [];

      // Filter by user if needed
      if (showOnlyUserObservations && userId) {
        obs = obs.filter((o: any) => o.userId === userId);
      }

      setObservations(obs);
      setFilteredObservations(obs);
    } catch (error: any) {
      console.error('Error fetching observations:', error);
      toast.error(error.message || 'Failed to load observations');
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
      {filteredObservations.map((obs) => (
        <Card
          key={obs.id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setSelectedObservation(obs)}
        >
          <div className="relative h-48">
            {obs.lepidoptera.image && (
              <img
                src={obs.lepidoptera.image}
                alt={obs.lepidoptera.species || 'Lepidoptera'}
                className="w-full h-full object-cover rounded-t-lg"
              />
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
                <p className="font-medium truncate">{obs.lepidoptera.species || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Host Plant</p>
                <p className="text-sm truncate">{obs.hostPlant.species || 'Unknown'}</p>
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
      ))}
    </div>
  );

  const ListView = () => (
    <div className="space-y-4">
      {filteredObservations.map((obs) => (
        <Card
          key={obs.id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setSelectedObservation(obs)}
        >
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex gap-2">
                {obs.lepidoptera.image && (
                  <img
                    src={obs.lepidoptera.image}
                    alt="Lepidoptera"
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
                {obs.hostPlant.image && (
                  <img
                    src={obs.hostPlant.image}
                    alt="Host Plant"
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{obs.lepidoptera.species || 'Unknown Species'}</h3>
                    <p className="text-sm text-gray-600">on {obs.hostPlant.species || 'Unknown Host Plant'}</p>
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
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{new Date(obs.date).toLocaleDateString()}</span>
                  </div>
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
      ))}
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
