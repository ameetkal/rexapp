import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }
    
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    
    if (!API_KEY) {
      console.error('Google Places API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    
    // Use Google Places Text Search API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}&fields=place_id,name,formatted_address,rating,price_level,photos,types,website,formatted_phone_number`
    );
    
    if (!response.ok) {
      console.error('Google Places API error:', response.status);
      return NextResponse.json({ error: 'Places API error' }, { status: response.status });
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      console.error('Google Places API status:', data.status);
      console.error('Google Places API error message:', data.error_message);
      console.error('Google Places API response:', JSON.stringify(data, null, 2));
      
      let errorMessage = `Places API status: ${data.status}`;
      if (data.error_message) {
        errorMessage += ` - ${data.error_message}`;
      }
      
      // Provide specific guidance for common errors
      if (data.status === 'REQUEST_DENIED') {
        errorMessage += '. This usually means: 1) API key is invalid, 2) Places API is not enabled, or 3) Billing is not set up in Google Cloud Console.';
      }
      
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in places API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 