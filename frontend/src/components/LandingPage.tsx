import { Link } from 'wouter';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Search, Map, Users, TrendingUp, Mail, Github, Twitter } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LandingPage() {
  const [shuffledImages, setShuffledImages] = useState<string[]>([]);

  // Fisher-Yates shuffle algorithm
  const shuffleImages = () => {
    const images = Array.from({ length: 12 }, (_, i) => `image${i + 1}.svg`);
    
    for (let i = images.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [images[i], images[j]] = [images[j], images[i]];
    }
    
    setShuffledImages(images.slice(0, 8));
  };

  useEffect(() => {
    // Initialize with shuffled images on mount
    shuffleImages();
  }, []);

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

        {/* Hero Image Grid */}
        <div className="max-w-6xl mx-auto mb-20">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}>
            {shuffledImages.map((image, index) => (
              <div key={index} className="aspect-square overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={shuffleImages}>
                <img
                  src={`/landingpage_images/${image}`}
                  alt={`Lepidoptera and plant collection ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 mb-20" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                  {/*} Our system suggests species identifications automatically*/}
                  Comming soon!
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

      {/* Footer */}
      <footer className="bg-gray-700 text-gray-300 mt-20 border-t border-gray-700">
        <div className="container mx-auto px-4 py-16 pt-4">
          {/* Links and Logo Section - Horizontal Layout */}
          <div className="flex flex-row justify-center items-start gap-8 mb-12 pb-12 pt-20">
            {/* Platform Links */}
            <div>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/explore" className="text-gray-400 hover:text-green-500 transition">
                    Explore
                  </Link>
                </li>
                <li>
                  <Link href="/relationships" className="text-gray-400 hover:text-green-500 transition">
                    Relationships
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Community</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Blog</a>
                </li>
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Documentation</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Help Center</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">API</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Data Downloads</a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Terms of Service</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Contact Us</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-green-500 transition">Attributions</a>
                </li>
              </ul>
            </div>

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <img 
                src="/footer/footer_logo.svg" 
                alt="ChrysaLink Logo" 
                className="h-32 w-auto"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 mt-16">
            <div className="text-center text-sm text-gray-400 pt-4">
              <p>&copy; 2025 ChrysaLink. All rights reserved.</p>
              <p>Made with passion for nature and open science</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
