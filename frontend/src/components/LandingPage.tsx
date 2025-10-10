import { Link } from 'wouter';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Search, Map, Users, TrendingUp } from 'lucide-react';

export function LandingPage() {
  return (
  <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl mb-6">
            Explore the Connection Between Butterflies, Moths & Host Plants
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            ChrysaLink is a community-driven platform for documenting and visualizing 
            the ecological relationships between Lepidoptera and their host plants.
          </p>
          <Button asChild size="lg" className="bg-black text-white hover:bg-black/90">
            <Link href="/auth">Get Started</Link>
          </Button>
        </div>

        {/* Hero Image */}
        <div className="max-w-4xl mx-auto mb-20">
          <img
            src="/images/hero.svg"
            alt="Butterfly on plant"
            className="w-full h-96 object-cover rounded-lg shadow-xl"
          />
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2">AI-Powered ID</h3>
                <p className="text-sm text-gray-600">
                  Upload photos and get automated species identification using iNaturalist
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Map className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2">Explore Maps</h3>
                <p className="text-sm text-gray-600">
                  View geotagged observations on interactive maps
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2">Community Verification</h3>
                <p className="text-sm text-gray-600">
                  Collaborate with experts to verify identifications
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2">Visualize Data</h3>
                <p className="text-sm text-gray-600">
                  Discover patterns in host plant relationships
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-3xl mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                1
              </div>
              <div>
                <h3 className="mb-2">Upload Observations</h3>
                <p className="text-gray-600">
                  Take photos of butterflies, moths, and their host plants in the field
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                2
              </div>
              <div>
                <h3 className="mb-2">Get AI Identification</h3>
                <p className="text-gray-600">
                  Our system suggests species identifications automatically
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                3
              </div>
              <div>
                <h3 className="mb-2">Community Collaboration</h3>
                <p className="text-gray-600">
                  Experts verify identifications and earn credibility ratings
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                4
              </div>
              <div>
                <h3 className="mb-2">Explore Relationships</h3>
                <p className="text-gray-600">
                  Visualize and analyze host plant-Lepidoptera connections
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
