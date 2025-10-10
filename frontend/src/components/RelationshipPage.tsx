import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { TrendingUp, Network } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface Relationship {
  lepidoptera: string;
  plant: string;
  count: number;
}

export function RelationshipPage() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRelationships();
  }, []);

  const fetchRelationships = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/relationships`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setRelationships(data.relationships || []);
      }
    } catch (error) {
      console.error('Error fetching relationships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl mb-2 flex items-center gap-3">
            <Network className="h-8 w-8" />
            Ecological Relationships
          </h1>
          <p className="text-gray-600">
            Explore the connections between Lepidoptera species and their host plants
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl">{relationships.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unique Lepidoptera</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl">
                {new Set(relationships.map(r => r.lepidoptera)).size}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unique Host Plants</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl">
                {new Set(relationships.map(r => r.plant)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Host Plant Associations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : relationships.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No relationships recorded yet</p>
                <p className="text-sm mt-2">
                  Start uploading observations to see ecological connections
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {relationships
                  .sort((a, b) => b.count - a.count)
                  .map((rel, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl">🦋</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{rel.lepidoptera}</p>
                        <p className="text-sm text-gray-600 truncate">
                          <span className="text-green-600">→</span> {rel.plant}
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {rel.count} {rel.count === 1 ? 'observation' : 'observations'}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

  <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
          <h3 className="font-semibold mb-2">Coming Soon: Advanced Visualizations</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Interactive network graphs showing species connections</li>
            <li>• Filter by taxonomic family (e.g., Nymphalidae, Papilionidae)</li>
            <li>• Geographic distribution of host plant associations</li>
            <li>• Temporal patterns in Lepidoptera-plant relationships</li>
            <li>• Statistical analysis of observation patterns</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
