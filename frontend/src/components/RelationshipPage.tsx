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
import { RelationshipGraph } from './RelationshipGraph';
import { useRelationshipGraph } from '../hooks/useRelationshipGraph';
import { relationshipService } from '../services/relationshipService';
import { TaxonomyNode } from '../types/relationship';

export function RelationshipPage() {
  // Graph data and visualization state
  const { graphData, isLoading: graphLoading, error: graphError, refetch } = useRelationshipGraph();

  // UI state for filters and search
  const [lepidopteraSearch, setLepidopteraSearch] = useState('');
  const [plantSearch, setPlantSearch] = useState('');
  const [selectedLepidoptera, setSelectedLepidoptera] = useState<TaxonomyNode | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<TaxonomyNode | null>(null);

  // Divisions for filter dropdowns
  const [lepidopteraDivisions, setLepidopteraDivisions] = useState<string[]>([]);
  const [plantDivisions, setPlantDivisions] = useState<string[]>([]);
  const [selectedLepidopteraDivision, setSelectedLepidopteraDivision] = useState<string>('');
  const [selectedPlantDivision, setSelectedPlantDivision] = useState<string>('');

  // Search results
  const [lepidopteraSearchResults, setLepidopteraSearchResults] = useState<TaxonomyNode[]>([]);
  const [plantSearchResults, setPlantSearchResults] = useState<TaxonomyNode[]>([]);
  const [showLepidopteraResults, setShowLepidopteraResults] = useState(false);
  const [showPlantResults, setShowPlantResults] = useState(false);

  // Initialize: load divisions and graph data
  useEffect(() => {
    const initializeData = async () => {
      try {
        const [lepDivs, plantDivs] = await Promise.all([
          relationshipService.fetchDivisions('lepidoptera'),
          relationshipService.fetchDivisions('plant'),
        ]);
        setLepidopteraDivisions(lepDivs);
        setPlantDivisions(plantDivs);
      } catch (error) {
        console.error('Error initializing divisions:', error);
      }
    };

    initializeData();
  }, []);

  // Handle lepidoptera search
  useEffect(() => {
    const handleSearch = async () => {
      if (lepidopteraSearch.trim().length > 2) {
        const results = await relationshipService.searchTaxonomy(
          lepidopteraSearch,
          'lepidoptera'
        );
        setLepidopteraSearchResults(results);
        setShowLepidopteraResults(true);
      } else {
        setLepidopteraSearchResults([]);
        setShowLepidopteraResults(false);
      }
    };

    const debounceTimer = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [lepidopteraSearch]);

  // Handle plant search
  useEffect(() => {
    const handleSearch = async () => {
      if (plantSearch.trim().length > 2) {
        const results = await relationshipService.searchTaxonomy(
          plantSearch,
          'plant'
        );
        setPlantSearchResults(results);
        setShowPlantResults(true);
      } else {
        setPlantSearchResults([]);
        setShowPlantResults(false);
      }
    };

    const debounceTimer = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [plantSearch]);

  // Handle graph refresh when divisions change
  useEffect(() => {
    const filters = {
      lepidoptera_division: selectedLepidopteraDivision || undefined,
      plant_division: selectedPlantDivision || undefined,
    };

    refetch(Object.keys(filters).some((k) => filters[k as keyof typeof filters]) ? filters : undefined);
  }, [selectedLepidopteraDivision, selectedPlantDivision, refetch]);

  const handleLepidopteraSelect = (node: TaxonomyNode) => {
    setSelectedLepidoptera(node);
    setLepidopteraSearch(node.display_name);
    setShowLepidopteraResults(false);
  };

  const handlePlantSelect = (node: TaxonomyNode) => {
    setSelectedPlant(node);
    setPlantSearch(node.display_name);
    setShowPlantResults(false);
  };

  const handleGraphNodeClick = (node: any) => {
    if (node.data.type === 'lepidoptera') {
      setSelectedLepidoptera(node.data);
    } else {
      setSelectedPlant(node.data);
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
        </div>

        {/* Main visualization card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Relationship Network Graph</span>
              {graphLoading && <Badge variant="outline">Loading...</Badge>}
              {graphError && <Badge variant="destructive">Error</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>

            {/* WebGL Graph Visualization */}
            <RelationshipGraph
              nodes={graphData?.nodes || []}
              edges={graphData?.edges || []}
              isLoading={graphLoading}
              height={600}
              onNodeClick={handleGraphNodeClick}
            />

            {graphError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">
                  Error loading graph: {graphError.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and detail sections */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Lepidoptera search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Lepidoptera</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  placeholder="Search by name or division..."
                  value={lepidopteraSearch}
                  onChange={(e) => setLepidopteraSearch(e.target.value)}
                  onFocus={() => setShowLepidopteraResults(true)}
                  className="w-full"
                />
                {showLepidopteraResults && lepidopteraSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                    {lepidopteraSearchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleLepidopteraSelect(result)}
                        className="w-full text-left px-4 py-2 hover:bg-yellow-50 border-b last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{result.display_name}</div>
                          <div className="text-xs text-gray-500">
                            {result.taxonomic_level} {result.is_placeholder ? '(placeholder)' : ''}
                          </div>
                        </div>
                        {result.is_placeholder && (
                          <Badge variant="secondary" className="ml-2">PH</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedLepidoptera && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="font-medium text-yellow-900">Selected:</div>
                  <div className="text-sm text-yellow-800 mt-2">
                    <div><strong>Name:</strong> <em>{selectedLepidoptera.display_name}</em></div>
                    <div><strong>Division:</strong> {selectedLepidoptera.division}</div>
                    {selectedLepidoptera.family && <div><strong>Family:</strong> {selectedLepidoptera.family}</div>}
                    {selectedLepidoptera.genus && <div><strong>Genus:</strong> {selectedLepidoptera.genus}</div>}
                    {selectedLepidoptera.is_placeholder && (
                      <div className="mt-2 text-xs italic">This is a placeholder taxon (no species designation)</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plant search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Plants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  placeholder="Search by name or division..."
                  value={plantSearch}
                  onChange={(e) => setPlantSearch(e.target.value)}
                  onFocus={() => setShowPlantResults(true)}
                  className="w-full"
                />
                {showPlantResults && plantSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                    {plantSearchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handlePlantSelect(result)}
                        className="w-full text-left px-4 py-2 hover:bg-green-50 border-b last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{result.display_name}</div>
                          <div className="text-xs text-gray-500">
                            {result.taxonomic_level} {result.is_placeholder ? '(placeholder)' : ''}
                          </div>
                        </div>
                        {result.is_placeholder && (
                          <Badge variant="secondary" className="ml-2">PH</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedPlant && (
                <div className="mt-6 p-4 bg-green-0 border border-black-200 rounded-lg">
                  <div className="font-medium text-green-900">Selected:</div>
                  <div className="text-sm text-green-800 mt-2">
                    <div><strong>Scientific Name:</strong> <em>{selectedPlant.display_name}</em></div>
                    <div><strong>Division:</strong> {selectedPlant.division}</div>
                    {selectedPlant.family && <div><strong>Family:</strong> {selectedPlant.family}</div>}
                    {selectedPlant.genus && <div><strong>Genus:</strong> {selectedPlant.genus}</div>}
                    {selectedPlant.is_placeholder && (
                      <div className="mt-2 text-xs italic">This is a placeholder taxon (no species designation)</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Box */}
        <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold mb-2">How to use</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <strong>Graph Visualization:</strong> The interactive WebGL graph shows relationships between
              Lepidoptera (left, yellow) and their host plants (right, green)
            </li>
            <li>
              <strong>Drill Down:</strong> Click on nodes in the graph to expand to the next taxonomic level
              (Division → Family → Genus → Species)
            </li>
            <li>
              <strong>Search:</strong> Use the search boxes to find specific species or taxa.
            </li>
            <li>
              <strong>Edges:</strong> Lines connecting nodes represent observed relationships between species
              with observation and verification counts
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
