import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define public routes (accessible without auth)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite/(.*)',
  '/personal-invite/(.*)',
  '/post/(.*)', // Public post previews
]);

export default clerkMiddleware(async (auth, request) => {
  // Don't protect any routes - let the app handle auth state
  // This allows our custom auth UI to render on the home page
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

