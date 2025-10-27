import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const place_id = searchParams.get('place_id');
    
    if (!place_id) {
      return NextResponse.json({ error: 'place_id parameter is required' }, { status: 400 });
    }
    
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    
    if (!API_KEY) {
      console.error('Google Places API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }
    
    // Use Google Places Details API
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,formatted_address,rating,price_level,photos,types,website,formatted_phone_number,geometry&key=${API_KEY}`;
    console.log('🔍 Calling Google Places Details API:', apiUrl.replace(API_KEY, 'HIDDEN_KEY'));
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places Details API HTTP error:', response.status, errorText);
      return NextResponse.json({ error: `Places Details API HTTP error: ${response.status}`, details: errorText }, { status: response.status });
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      console.error('Google Places Details API status:', data.status);
      console.error('Google Places Details API error message:', data.error_message);
      
      let errorMessage = `Places Details API status: ${data.status}`;
      if (data.error_message) {
        errorMessage += ` - ${data.error_message}`;
      }
      
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in places details API route:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

