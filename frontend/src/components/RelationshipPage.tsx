import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Network, Search, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { apiClient } from '../api/client';

// Environment variables
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface Division {
  id: string;
  type: 'lepidoptera' | 'plant';
  division_name: string;
  common_name: string;
  description: string;
}

interface TaxonomyItem {
  id: string;
  division: string;
  family?: string;
  genus?: string;
  species?: string;
  common_name?: string;
}

interface Relationship {
  lepidoptera: string;
  plant: string;
  count: number;
}

export function RelationshipPage() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter types
  const filterTypes = ['Division', 'Family', 'Genus', 'Scientific Name'];
  
  // Lepidoptera side
  const [lepidopteraSearch, setLepidopteraSearch] = useState('');
  const [lepidopteraFilterType, setLepidopteraFilterType] = useState<string>('Division');
  const [showLepidopteraSearch, setShowLepidopteraSearch] = useState(false);
  const [lepidopteraNodes, setLepidopteraNodes] = useState<TaxonomyItem[]>([]);
  
  // Plant side
  const [plantSearch, setPlantSearch] = useState('');
  const [plantFilterType, setPlantFilterType] = useState<string>('Division');
  const [showPlantSearch, setShowPlantSearch] = useState(false);
  const [plantNodes, setPlantNodes] = useState<TaxonomyItem[]>([]);

  useEffect(() => {
    fetchTaxonomyAndRelationships();
  }, []);

  useEffect(() => {
    // Update lepidoptera nodes based on filter type
    fetchLepidopteraNodes();
  }, [lepidopteraFilterType, lepidopteraSearch]);

  useEffect(() => {
    // Update plant nodes based on filter type
    fetchPlantNodes();
  }, [plantFilterType, plantSearch]);

  const fetchLepidopteraNodes = async () => {
    try {
      let query = `*`;
      let filter = `division.eq."Rhopalocera",division.eq."Heterocera"`;

      if (lepidopteraFilterType === 'Division') {
        query = `division,common_name`;
        filter = `and(or(division.eq."Rhopalocera",division.eq."Heterocera"),family.is.null,genus.is.null,species.is.null)`;
      } else if (lepidopteraFilterType === 'Family') {
        query = `family,division`;
        filter = `and(or(division.eq."Rhopalocera",division.eq."Heterocera"),family.not.is.null,genus.is.null,species.is.null)`;
      } else if (lepidopteraFilterType === 'Genus') {
        query = `genus,family,division`;
        filter = `and(or(division.eq."Rhopalocera",division.eq."Heterocera"),genus.not.is.null,species.is.null)`;
      } else if (lepidopteraFilterType === 'Scientific Name') {
        query = `genus,species,family,division`;
        filter = `and(or(division.eq."Rhopalocera",division.eq."Heterocera"),species.not.is.null)`;
      }

      const response = await fetch(
        `https://${PROJECT_ID}.supabase.co/rest/v1/lepidoptera_taxonomy?select=${query}&${filter}`,
        {
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
            'apikey': ANON_KEY
          }
        }
      );

      if (response.ok) {
        let data = await response.json();
        
        // Remove duplicates based on the display value
        const seen = new Set();
        data = data.filter((item: TaxonomyItem) => {
          const key = lepidopteraFilterType === 'Division' 
            ? item.division 
            : lepidopteraFilterType === 'Family'
            ? item.family
            : lepidopteraFilterType === 'Genus'
            ? item.genus
            : `${item.genus} ${item.species}`;
          
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setLepidopteraNodes(data || []);
      }
    } catch (error) {
      console.error('Error fetching lepidoptera nodes:', error);
    }
  };

  const fetchPlantNodes = async () => {
    try {
      if (plantFilterType === 'Division') {
        const query = `division,common_name`;
        const filter = `and(or(division.eq."Pteridophyte",division.eq."Gymnosperm",division.eq."Angiosperm"),family.is.null,genus.is.null,species.is.null)`;
        
        const response = await fetch(
          `https://${PROJECT_ID}.supabase.co/rest/v1/plant_taxonomy?select=${query}&${filter}`,
          {
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'apikey': publicAnonKey
            }
          }
        );

        if (response.ok) {
          let data = await response.json();
          
          // Remove duplicates for divisions
          const seen = new Set();
          data = data.filter((item: TaxonomyItem) => {
            if (seen.has(item.division)) return false;
            seen.add(item.division);
            return true;
          });

          setPlantNodes(data || []);
        }
      } else if (plantFilterType === 'Family') {
        const query = `family,division`;
        const filter = `and(or(division.eq."Pteridophyte",division.eq."Gymnosperm",division.eq."Angiosperm"),family.not.is.null,genus.is.null,species.is.null)`;
        
        const response = await fetch(
          `https://${PROJECT_ID}.supabase.co/rest/v1/plant_taxonomy?select=${query}&${filter}`,
          {
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'apikey': publicAnonKey
            }
          }
        );

        if (response.ok) {
          let data = await response.json();
          
          // Remove duplicates based on family name
          const seen = new Set();
          data = data.filter((item: TaxonomyItem) => {
            if (seen.has(item.family)) return false;
            seen.add(item.family);
            return true;
          });

          setPlantNodes(data || []);
        }
      } else if (plantFilterType === 'Genus') {
        const query = `genus,family,division`;
        const filter = `and(or(division.eq."Pteridophyte",division.eq."Gymnosperm",division.eq."Angiosperm"),genus.not.is.null,species.is.null)`;
        
        const response = await fetch(
          `https://${PROJECT_ID}.supabase.co/rest/v1/plant_taxonomy?select=${query}&${filter}`,
          {
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'apikey': publicAnonKey
            }
          }
        );

        if (response.ok) {
          let data = await response.json();
          
          // Remove duplicates based on genus name
          const seen = new Set();
          data = data.filter((item: TaxonomyItem) => {
            if (seen.has(item.genus)) return false;
            seen.add(item.genus);
            return true;
          });

          setPlantNodes(data || []);
        }
      } else if (plantFilterType === 'Scientific Name') {
        const query = `genus,species,family,division`;
        const filter = `and(or(division.eq."Pteridophyte",division.eq."Gymnosperm",division.eq."Angiosperm"),species.not.is.null)`;
        
        const response = await fetch(
          `https://${PROJECT_ID}.supabase.co/rest/v1/plant_taxonomy?select=${query}&${filter}`,
          {
            headers: {
              'Authorization': `Bearer ${ANON_KEY}`,
              'apikey': publicAnonKey
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setPlantNodes(data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching plant nodes:', error);
    }
  };

  const fetchTaxonomyAndRelationships = async () => {
    setIsLoading(true);
    try {
      // Fetch relationships
      const response = await fetch(
        `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-b55216b3/relationships`,
        {
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`
          }
        }
      );

      const data = await response.json();
      if (response.ok) {
        setRelationships(data.relationships || []);
      }
      
      // Fetch initial nodes
      await fetchLepidopteraNodes();
      await fetchPlantNodes();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl mb-2 flex items-center gap-3">
            <Network className="h-8 w-8" />
            Ecological Relationships
          </h1>
          <p className="text-gray-600">
            Explore the connections between Lepidoptera species and their host plants
          </p>
        </div>

        {/* Bipartite Graph Container */}
        <Card>
          <CardContent className="p-8">
            <div className="flex gap-8">
              {/* LEFT SIDE: LEPIDOPTERA */}
              <div className="flex-1">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                   Lepidoptera
                </h2>

                {/* Search Bar - Lepidoptera */}
                <div className="mb-4">
                  <Input
                    placeholder="Search species..."
                    value={lepidopteraSearch}
                    onChange={(e) => setLepidopteraSearch(e.target.value)}
                    onFocus={() => setShowLepidopteraSearch(true)}
                    onBlur={() => setTimeout(() => setShowLepidopteraSearch(false), 200)}
                    className="w-full"
                  />
                </div>

                {/* Filter Dropdown - Lepidoptera */}
                {!showLepidopteraSearch && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mb-6">
                        <span>Filter by: {lepidopteraFilterType}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Select Filter Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {filterTypes.map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={lepidopteraFilterType === type}
                          onCheckedChange={() => setLepidopteraFilterType(type)}
                        >
                          {type}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Lepidoptera Nodes */}
                <div className="space-y-2">
                  {lepidopteraNodes.length > 0 ? (
                    lepidopteraNodes.map((node, idx) => (
                      <div
                        key={`${node.id}-${idx}`}
                        className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg text-center font-medium text-blue-900 hover:bg-blue-100 cursor-pointer transition-colors"
                      >
                        <div>
                          {lepidopteraFilterType === 'Division' && (
                            <>
                              <div>{node.division}</div>
                              <div className="text-xs text-blue-700">{node.common_name}</div>
                            </>
                          )}
                          {lepidopteraFilterType === 'Family' && <div>{node.family}</div>}
                          {lepidopteraFilterType === 'Genus' && <div>{node.genus}</div>}
                          {lepidopteraFilterType === 'Scientific Name' && (
                            <div>{node.genus} {node.species}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No nodes found
                    </div>
                  )}
                </div>
              </div>

              {/* CENTER: NETWORK VISUALIZATION */}
              <div className="flex items-center justify-center px-8">
                <div className="w-16 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-xs text-center">Network</span>
                </div>
              </div>

              {/* RIGHT SIDE: HOST PLANTS */}
              <div className="flex-1">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  Host Plants
                </h2>

                {/* Search Bar - Plants */}
                <div className="mb-4">
                  <Input
                    placeholder="Search species..."
                    value={plantSearch}
                    onChange={(e) => setPlantSearch(e.target.value)}
                    onFocus={() => setShowPlantSearch(true)}
                    onBlur={() => setTimeout(() => setShowPlantSearch(false), 200)}
                    className="w-full"
                  />
                </div>

                {/* Filter Dropdown - Plants */}
                {!showPlantSearch && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mb-6">
                        <span>Filter by: {plantFilterType}</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Select Filter Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {filterTypes.map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={plantFilterType === type}
                          onCheckedChange={() => setPlantFilterType(type)}
                        >
                          {type}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Plant Nodes */}
                <div className="space-y-2">
                  {plantNodes.length > 0 ? (
                    plantNodes.map((node, idx) => (
                      <div
                        key={`${node.id}-${idx}`}
                        className="p-4 border-2 border-green-200 bg-green-50 rounded-lg text-center font-medium text-green-900 hover:bg-green-100 cursor-pointer transition-colors"
                      >
                        <div>
                          {plantFilterType === 'Division' && (
                            <>
                              <div>{node.division}</div>
                              <div className="text-xs text-green-700">{node.common_name}</div>
                            </>
                          )}
                          {plantFilterType === 'Family' && <div>{node.family}</div>}
                          {plantFilterType === 'Genus' && <div>{node.genus}</div>}
                          {plantFilterType === 'Scientific Name' && (
                            <div>{node.genus} {node.species}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No nodes found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold mb-2">How to use</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Search for a Lepidoptera species or plant to see their connections</li>
            <li>• Use the filter dropdowns to browse by taxonomic division</li>
            <li>• When searching on one side, the other side will show filtered results</li>
            <li>• Click on a node to see detailed relationships and observation counts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
