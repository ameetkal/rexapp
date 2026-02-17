import { NextResponse } from 'next/server';

// TODO: Replace with actual database integration
// If using Supabase, create a waitlist table:
// CREATE TABLE waitlist (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
// Then use Supabase client here to insert

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // TODO: Store in database (Supabase, Firebase, etc.)
    // For now, just log it
    console.log('[WAITLIST] New signup:', email);

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500));

    // TODO: Replace with actual database insert
    // Example with Supabase:
    // const { data, error } = await supabase
    //   .from('waitlist')
    //   .insert([{ email: email.trim().toLowerCase() }])
    //   .select();
    // if (error) throw error;

    return NextResponse.json(
      { success: true, message: 'Successfully joined waitlist' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[WAITLIST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again.' },
      { status: 500 }
    );
  }
}
