import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredObservations.map((obs) => {
        const lepidopteraScientificName = obs.lepidoptera?.scientific_name || 'Unknown';
        const lepidopteraCommonName = obs.lepidoptera?.common_name;
        const lepidopteraFamily = obs.lepidoptera?.family;
        const plantScientificName = obs.plant?.scientific_name || 'Unknown';
        const plantCommonName = obs.plant?.common_name;
        const plantFamily = obs.plant?.family;
        
        // Get separate images
        const lepidopteraImage = obs.lepidoptera_image_url || obs.image_url;
        const plantImage = obs.plant_image_url;
        
        // Get user info - try multiple sources
        const userName = obs.user?.name || obs.user?.username || 'User' + (obs.user_id?.substring(0, 8) || '');
        const userAvatar = obs.user?.avatar_url;
        
        // Calculate time ago
        const createdDate = new Date(obs.created_at || '');
        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const timeAgo = diffDays > 0 ? `${diffDays}d` : diffHours > 0 ? `${diffHours}h` : 'Just now';
        
        // Current identifications
        const lepCurrentId = obs.lepidoptera_current_identification;
        const plantCurrentId = obs.plant_current_identification;
        
        return (
          <div
            key={obs.id}
            className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer flex flex-col h-full"
            onClick={() => setSelectedObservation(obs)}
          >
            {/* Dual Image Section - Fixed Square Frames */}
            <div className="w-full flex flex-row">
              {/* Lepidoptera Image */}
              <div className="w-24 h-24 relative overflow-hidden bg-gray-900 flex items-center justify-center">
                {lepidopteraImage ? (
                  <img src={lepidopteraImage} alt="Lepidoptera" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400 text-sm">No Image</div>
                )}
              </div>
              {/* Host Plant Image */}
              <div className="w-24 h-24 relative overflow-hidden bg-gray-900 flex items-center justify-center ml-2">
                {plantImage ? (
                  <img src={plantImage} alt="Host Plant" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-sm">No Image</div>
                )}
              </div>
            </div>
            
            {/* Caption Section */}
            <div className="p-4 flex flex-col gap-3">
              {/* User Row - Avatar, Username, Observation Count */}
              <div className="flex items-center p-2">
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm mr-3">
                  <AvatarImage src={obs.user?.avatar || obs.user?.avatar_url} />
                  <AvatarFallback>{obs.user?.username?.[0] || obs.user?.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col ml-2">
                  <span className="font-bold text-base text-gray-900">{obs.user?.username || obs.user?.name || obs.user?.fullName || 'Unknown User'}</span>
                  <span className="text-sm text-gray-500 font-medium">
                    {obs.user?.observationCount || 0} observations
                  </span>
                </div>
              </div>
              
              {/* Species Section */}
              <div className="flex flex-col gap-2">
                {/* Lepidoptera */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    Lepidoptera
                  </div>
                  <div className="font-semibold text-[14px] text-gray-800 hover:text-amber-600">
                    {lepCurrentId ? lepCurrentId : 'Unknown'}
                  </div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {obs.quality_grade ? obs.quality_grade.replace(/_/g, ' ') : 'Needs ID'}
                  </Badge>
                  {/*}
                  <div className="text-[12px] text-gray-500 italic">
                    {lepidopteraScientificName}
                  </div>
                  */} 
                </div>
                
                {/* Host Plant */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    Host Plant
                  </div>
                  <div className="font-semibold text-[14px] text-gray-800 hover:text-green-600">
                    {plantCurrentId ? plantCurrentId : 'Unknown'}
                  </div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {obs.quality_grade ? obs.quality_grade.replace(/_/g, ' ') : 'Needs ID'}
                  </Badge>
                  {/*
                  <div className="text-[12px] text-gray-500 italic">
                    {plantScientificName}
                  </div>
                  */}
                </div>
              </div>
              
              {/* Meta Section */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-3 text-[12px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,3.5A1.5,1.5 0 0,1 13.5,5A1.5,1.5 0 0,1 12,6.5A1.5,1.5 0 0,1 10.5,5A1.5,1.5 0 0,1 12,3.5M9.5,8H14.5V9.5H9.5M9.5,11.5H14.5V13H9.5M9.5,15H14.5V16.5H9.5"/></svg>
                    {obs.identifications?.length || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {obs.comments?.length || 0}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {timeAgo}
                  </span>
                </div>
                
                <div className="text-[11px] text-gray-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {obs.location || 'Unknown location'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const ListView = () => (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 border-b-2 border-gray-200 text-left">
          <tr>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide w-20" style={{textAlign: 'left'}}>Lepidoptera Media</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[180px]" style={{textAlign: 'left'}}>Lepidoptera Name</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide w-20" style={{textAlign: 'left'}}>Host Plant Media</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[180px]" style={{textAlign: 'left'}}>Host Plant Name</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[120px]" style={{textAlign: 'left'}}>User</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[140px] cursor-pointer hover:bg-gray-100" style={{textAlign: 'left'}}>Observed</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[200px]" style={{textAlign: 'left'}}>Place</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide min-w-[140px] cursor-pointer hover:bg-gray-100" style={{textAlign: 'left'}}>Added</th>
          </tr>
        </thead>
        <tbody>
          {filteredObservations.map((obs) => {
            const lepidopteraScientificName = obs.lepidoptera?.scientific_name || 'Unknown';
            const lepidopteraCommonName = obs.lepidoptera?.common_name;
            const plantScientificName = obs.plant?.scientific_name || 'Unknown';
            const plantCommonName = obs.plant?.common_name;
            
            const lepidopteraImage = obs.lepidoptera_image_url || obs.image_url;
            const plantImage = obs.plant_image_url;
            
            const userName = obs.user?.name || obs.user?.username || 'User' + (obs.user_id?.substring(0, 8) || '');
            const userAvatar = obs.user?.avatar_url;
            
            const observedDate = new Date(obs.observation_date || obs.created_at || '');
            const createdDate = new Date(obs.created_at || '');
            const now = new Date();
            
            const formatDate = (date: Date) => {
              const diffMs = now.getTime() - date.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              
              if (diffDays === 0) return 'Today';
              if (diffDays === 1) return 'Yesterday';
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            };
            
            const formatTime = (date: Date) => {
              return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            };
            
            return (
              <tr 
                key={obs.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedObservation(obs)}
              >
                {/* Lepidoptera Media Column */}
                <td className="px-3 py-2">
                  <div className="w-24 h-24 relative rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {lepidopteraImage ? (
                      <img src={lepidopteraImage} alt="Lepidoptera" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-400">No Image</div>
                    )}
                  </div>
                </td>

                {/* Lepidoptera Name Column */}
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <a href="#" className="text-[12px] font-semibold text-gray-800 hover:text-amber-600 leading-tight">
                      {obs.lepidoptera_current_identification ? obs.lepidoptera_current_identification : 'Unknown'}
                    </a>
                    {/*<span className="text-[11px] text-gray-500 italic leading-tight">{lepidopteraScientificName}</span>*/}
                    <Badge variant="secondary" className="text-xs mt-1">
                      {obs.quality_grade ? obs.quality_grade.replace(/_/g, ' ') : 'Needs ID'}
                    </Badge>
                  </div>
                </td>

                {/* Host Plant Media Column */}
                <td className="px-3 py-2">
                  <div className="w-24 h-24 relative rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {plantImage ? (
                      <img src={plantImage} alt="Host Plant" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-400">No Image</div>
                    )}
                  </div>
                </td>

                {/* Host Plant Name Column */}
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <a href="#" className="text-[12px] font-semibold text-gray-800 hover:text-green-600 leading-tight">
                      {obs.plant_current_identification ? obs.plant_current_identification : 'Unknown'}
                    </a>
                    {/*<span className="text-[11px] text-gray-500 italic leading-tight">{plantScientificName}</span>*/}
                    <Badge variant="secondary" className="text-xs mt-1">
                      {obs.quality_grade ? obs.quality_grade.replace(/_/g, ' ') : 'Needs ID'}
                    </Badge>
                  </div>
                </td>

                {/* User Column */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex-shrink-0" />
                    )}
                    <a href="#" className="text-[12px] text-gray-800 hover:text-amber-600 font-medium">
                      {userName}
                    </a>
                  </div>
                </td>

                {/* Observed Date Column */}
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-gray-800 leading-tight">{formatDate(observedDate)}</span>
                    <span className="text-[10px] text-gray-500 leading-tight">{formatTime(observedDate)}</span>
                  </div>
                </td>

                {/* Place Column */}
                <td className="px-3 py-2">
                  <div className="flex items-start gap-1">
                    <MapPin className="h-2.5 w-2.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-[11px] text-gray-600 leading-tight">
                      {obs.location || 'Unknown location'}
                    </span>
                  </div>
                </td>

                {/* Added Date Column */}
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-gray-800 leading-tight">{formatDate(createdDate)}</span>
                    <span className="text-[10px] text-gray-500 leading-tight">{formatTime(createdDate)}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

          {/*<Button variant="outline" onClick={fetchObservations}>
            Refresh
          </Button>
          */}
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
          ) : (
            <>
              <MapView />
              {filteredObservations.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p>No observations found</p>
                </div>
              )}
            </>
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
