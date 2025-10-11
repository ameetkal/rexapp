# Clerk Phone Authentication Setup Guide

## ✅ Completed Steps:
1. ✅ Installed @clerk/nextjs package
2. ✅ Added ClerkProvider to app/layout.tsx
3. ✅ Created middleware.ts for route protection
4. ✅ Created ClerkAuthProvider for Firestore sync
5. ✅ Replaced AuthForm with Clerk's SignIn/SignUp components
6. ✅ Updated store to use AuthUser type (works with both Firebase and Clerk)

## 🔧 Configuration Needed:

### 1. Verify `.env.local` has these variables:

```bash
# Clerk Keys (from dashboard - you already added these)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs (for redirects) - ADD THESE:
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Your existing Firebase keys (keep as is)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_TMDB_API_KEY=...
```

### 2. Configure Clerk Dashboard:

#### Enable Phone Authentication:
1. Go to https://dashboard.clerk.com
2. Select your Rex app
3. Navigate to **"User & Authentication"** → **"Email, Phone, Username"**
4. Under **"Phone number"**:
   - ✅ Toggle ON
   - Set as **"Required"** (or optional if you want email fallback)
   - Enable **"Verification"** (SMS codes)
5. Click **"Save"**

#### Optional - Customize Appearance:
1. Go to **"Customization"** → **"Theme"**
2. Match Rex's brand colors:
   - Primary: `#2563eb` (blue-600)
   - Background: `#f9fafb` (gray-50)

#### Set up Webhook (for real-time Firestore sync):
1. Go to **"Webhooks"** in Clerk dashboard
2. Add endpoint: `https://your-domain.com/api/clerk-webhook` (we'll create this)
3. Subscribe to: `user.created`, `user.updated`
4. This ensures Firestore stays in sync with Clerk

---

## 🚀 How It Works Now:

### Phone Auth Flow:
1. User opens app → sees Clerk's phone auth UI
2. Enters phone number → receives SMS code
3. Enters code → authenticated ✅
4. `ClerkAuthProvider` creates Firestore user document automatically
5. User lands in Rex feed with full access

### Email/Password Fallback:
- Clerk's UI automatically shows email option if phone fails
- Users can toggle between phone and email methods

### User Sync:
- Clerk user ID → Firestore `users/{clerkUserId}` document
- Auto-generates username from Clerk user data
- Syncs name, email, phone number to Firestore

---

## 🧪 Testing:

### Test with Phone Number:
1. Run `npm run dev`
2. Click "Sign up"
3. Choose "Continue with phone"
4. Enter phone number (use your real number for testing)
5. Enter SMS code
6. Should auto-create Firestore user and land in app ✅

### Test Numbers (Clerk provides these for development):
- Clerk allows you to add test phone numbers in dashboard
- Go to "Testing" → "Test phone numbers"
- Add: `+15555550100` (or any number you want)
- Use code: `424242` (Clerk's test code)

---

## 📝 Next Steps After Testing:

1. Remove old Firebase Auth code from `lib/auth.ts` (keep `getUserProfile`)
2. Delete old `AuthForm.tsx` component
3. Update Firestore rules (already compatible - Clerk uses same UID system)
4. Deploy to production with Clerk keys in environment

---

## 🎯 Benefits You'll Get:

- ✅ Phone-first authentication (better UX)
- ✅ SMS verification handled automatically
- ✅ Beautiful pre-built UI
- ✅ International phone support
- ✅ Email/password fallback
- ✅ Session management
- ✅ Security best practices
- ✅ User management dashboard
- ✅ Free up to 10,000 MAU

---

**Ready to test!** Just add those environment variables and restart your dev server.

