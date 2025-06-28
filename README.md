# Rex - Social Recommendation Platform

**Rex** is a social platform where friends share and save trusted recommendations for movies, restaurants, books, music, and travel. Say goodbye to losing those great suggestions in text messages!

## ✨ Core Features

- 🔐 **User Authentication** - Sign up/login with email
- 👥 **Follow Friends** - Search and follow users to see their recommendations
- 📝 **Share Recommendations** - Quick form to post recommendations with categories
- 💾 **Save for Later** - Bookmark interesting recommendations to your personal backlog
- 🗂️ **Category Filtering** - Filter saved posts by: Restaurants, Movies/TV, Books, Music/Podcasts, Travel
- 📱 **Mobile-First Design** - Beautiful, responsive UI optimized for mobile

## 🎯 MVP Scope

This is the Phase 1 MVP focusing on the core user journey:
**Sign up/login → Follow friends → Post recommendations → See friend's recs → Save interesting ones → Browse saved backlog when needed**

## 🛠️ Tech Stack

- **Frontend:** Next.js 14+ with TypeScript and App Router
- **Styling:** Tailwind CSS (mobile-first responsive design)
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State Management:** Zustand
- **UI Components:** Headless UI
- **Icons:** Heroicons
- **Deployment:** Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project (free tier works fine)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd rex
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** with Email/Password
4. Create a **Firestore Database** in test mode
5. Get your config from Project Settings → General → Your apps

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 4. Firestore Security Rules

In Firebase Console → Firestore Database → Rules, add these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for search
    }
    
    // Posts are readable by authenticated users, writable by author
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == resource.data.authorId;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.authorId || 
         onlyUpdatingSavedBy());
    }
    
    function onlyUpdatingSavedBy() {
      return request.writeFields.size() == 1 && 'savedBy' in request.writeFields;
    }
  }
}
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see Rex in action!

## 📱 User Guide

### Getting Started
1. **Sign Up** - Create your account with email/password
2. **Find Friends** - Use the Profile tab to search for friends by name or email
3. **Follow Friends** - Follow users to see their recommendations in your feed
4. **Share Recommendations** - Use the Post tab to share your discoveries

### Core Workflow
1. **Feed** - See recommendations from people you follow
2. **Save** - Tap the bookmark icon to save interesting recommendations
3. **Post** - Share your own recommendations in 5 categories
4. **Saved** - Browse your personal backlog by category when you need ideas

## 🗂️ Project Structure

```
rex/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── AuthForm.tsx       # Login/signup form
│   ├── AuthProvider.tsx   # Auth state provider
│   ├── FeedScreen.tsx     # Main feed
│   ├── PostScreen.tsx     # Create post
│   ├── SavedScreen.tsx    # Saved posts
│   ├── ProfileScreen.tsx  # User profile & search
│   ├── PostCard.tsx       # Individual post display
│   ├── Navigation.tsx     # Bottom navigation
│   └── MainApp.tsx        # Main app orchestrator
├── lib/                   # Utilities and services
│   ├── firebase.ts        # Firebase config
│   ├── auth.ts           # Authentication service
│   ├── firestore.ts      # Database operations
│   ├── store.ts          # Zustand state management
│   └── types.ts          # TypeScript interfaces
└── public/               # Static assets
```

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Key Components

- **AuthProvider** - Handles authentication state
- **MainApp** - Routes between authenticated/unauthenticated states
- **Navigation** - Bottom tab navigation
- **PostCard** - Reusable post display with save functionality
- **Screen Components** - Feed, Post, Saved, Profile screens

### State Management

Using Zustand for clean, simple state management:
- **AuthStore** - User authentication state
- **AppStore** - Posts, saved posts, and app data

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Firebase Production Setup

1. Update Firestore rules for production
2. Enable security features in Firebase Console
3. Consider setting up Firebase App Check for additional security

## 🔮 Future Roadmap

Phase 1 is complete! Future phases could include:
- 💬 Comments and reactions on posts
- 📸 Image uploads for recommendations
- 🔍 Advanced search and discovery
- 📍 Location integration for restaurants/travel
- 🔔 Push notifications
- 📱 React Native mobile apps (same Firebase backend!)

## 🤝 Contributing

This is an MVP focused on core functionality. Feel free to:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this for your own projects!

## 🎯 Core Value Proposition

**"I can save my friend's restaurant recommendation from 2 weeks ago and find it instantly when I need dinner ideas tonight."**

Rex solves the problem of losing great recommendations in the noise of daily communication. Your friends' trusted suggestions deserve a permanent, organized home that you can reference anytime you need ideas.

---

Built with ❤️ for sharing great discoveries with friends.
