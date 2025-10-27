'use client';

import { useEffect, useRef, useState } from 'react';
import { Thing, UserThingInteraction } from '@/lib/types';
import ThingDetailModal from './ThingDetailModal';

// Google Maps is loaded dynamically, so we need to handle it carefully

interface MapViewProps {
  things: Thing[];
  interactions: UserThingInteraction[];
  myInteractions: UserThingInteraction[];
  onThingClick: (thing: Thing) => void;
  centerOnLocation?: { lat: number; lng: number } | null;
}

export default function MapView({ things, interactions, myInteractions, centerOnLocation }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchMarkerRef = useRef<any>(null);
  const [selectedThing, setSelectedThing] = useState<Thing | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const hasCenteredOnPlace = useRef(false);

  // Filter for completed Places with coordinates
  const completedPlaces = things.filter(thing => {
    const hasLatLng = thing.metadata.latitude && thing.metadata.longitude;
    const isPlace = thing.category === 'places';
    const isCompleted = [...interactions, ...myInteractions].some(
      int => int.thingId === thing.id && int.state === 'completed'
    );
    return hasLatLng && isPlace && isCompleted;
  });

  // Get user's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      console.log('📍 Requesting user location...');
      
      // Add timeout
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Got user location:', position.coords.latitude, position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('❌ Geolocation error:', error.code, error.message);
          if (error.code === 1) {
            console.log('💡 Location permission denied. Enable location access in browser settings.');
          } else if (error.code === 2) {
            console.log('💡 Location unavailable.');
          } else if (error.code === 3) {
            console.log('💡 Location request timed out.');
          }
        },
        options
      );
    } else {
      console.log('⚠️ Geolocation not supported');
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.Map) {
      initializeMap();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.id = 'google-maps-script';
    
    script.onload = initializeMap;

    document.head.appendChild(script);

    function initializeMap() {
      // Determine map center - prioritize: user location > first place > default
      const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // NYC
      
      let center;
      if (userLocation) {
        center = userLocation;
      } else if (completedPlaces.length > 0 && completedPlaces[0].metadata.latitude) {
        center = {
          lat: completedPlaces[0].metadata.latitude!,
          lng: completedPlaces[0].metadata.longitude!
        };
      } else {
        center = defaultCenter;
      }

      // Initialize map
      const map = new google.maps.Map(mapRef.current!, {
        center,
        zoom: completedPlaces.length > 0 ? 10 : (userLocation ? 12 : 3),
        gestureHandling: 'cooperative', // Allow one-finger panning
      });
      
      // Store map instance
      mapInstanceRef.current = map;

      // Add markers for each completed place
      completedPlaces.forEach(place => {
        if (place.metadata.latitude && place.metadata.longitude) {
          const marker = new google.maps.Marker({
            position: { 
              lat: place.metadata.latitude, 
              lng: place.metadata.longitude
            },
            title: place.title,
            map: map,
          });

          // Click handler to open modal
          marker.addListener('click', () => {
            setSelectedThing(place);
          });
        }
      });

      setMapLoaded(true);
    }

    // No cleanup needed - let the script remain in DOM
  }, [completedPlaces, mapLoaded, userLocation]);

  // Re-center map when user location becomes available
  useEffect(() => {
    // Don't re-center to user location if we just centered on a searched place
    if (mapLoaded && userLocation && mapInstanceRef.current && !hasCenteredOnPlace.current) {
      console.log('🎯 Re-centering map to user location:', userLocation);
      mapInstanceRef.current.setCenter(userLocation);
      mapInstanceRef.current.setZoom(12);
    }
  }, [userLocation, mapLoaded]);

  // Center map on selected place location from search
  useEffect(() => {
    console.log('🗺️ MapView useEffect triggered:', { 
      mapLoaded, 
      centerOnLocation, 
      hasMapInstance: !!mapInstanceRef.current 
    });
    
    if (mapLoaded && centerOnLocation && mapInstanceRef.current) {
      console.log('📍 Centering map on selected place:', centerOnLocation);
      mapInstanceRef.current.setCenter(centerOnLocation);
      mapInstanceRef.current.setZoom(15); // Zoom closer for selected places
      hasCenteredOnPlace.current = true;
      
      // Remove previous search marker if exists
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
      }
      
      // Add a marker at the searched location
      searchMarkerRef.current = new google.maps.Marker({
        position: centerOnLocation,
        map: mapInstanceRef.current,
        title: 'Searched location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      console.log('✅ Map centered and marker added');
    } else if (!centerOnLocation && searchMarkerRef.current) {
      // Remove marker when location is cleared
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
      hasCenteredOnPlace.current = false;
    }
  }, [centerOnLocation, mapLoaded]);

  return (
    <div className="relative -mx-4 -mb-4" style={{ width: 'calc(100% + 2rem)', height: 'calc(100vh - 240px)', minHeight: '500px' }}>
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Selected Thing Modal */}
      {selectedThing && (
        <ThingDetailModal
          thing={selectedThing}
          onClose={() => setSelectedThing(null)}
          onUserClick={() => {}}
        />
      )}
    </div>
  );
}

