import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    if (!lat || !lng) {
      return NextResponse.json({ error: 'Lat and lng parameters are required' }, { status: 400 });
    }
    
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    
    if (!API_KEY) {
      console.error('Google Places API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    
    // Use Google Places Nearby Search API with larger radius and fields for better results
    const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=200&type=point_of_interest|establishment&key=${API_KEY}`;
    console.log('🔍 Calling Google Places Nearby Search API:', apiUrl.replace(API_KEY, 'HIDDEN_KEY'));
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API HTTP error:', response.status, errorText);
      return NextResponse.json({ error: `Places API HTTP error: ${response.status}`, details: errorText }, { status: response.status });
    }
    
    const data = await response.json();
    
    // Handle different status codes
    if (data.status === 'ZERO_RESULTS') {
      console.log('📍 No places found near:', lat, lng);
      return NextResponse.json({ results: [] });
    }
    
    if (data.status !== 'OK') {
      console.error('Google Places API status:', data.status);
      console.error('Google Places API error message:', data.error_message);
      
      let errorMessage = `Places API status: ${data.status}`;
      if (data.error_message) {
        errorMessage += ` - ${data.error_message}`;
      }
      
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in places nearby API route:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

