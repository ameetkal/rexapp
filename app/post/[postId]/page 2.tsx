'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Post } from '@/lib/types';
import { getPost } from '@/lib/firestore';
import PostDetailScreen from '@/components/PostDetailScreen';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const postId = params.postId as string;
  const from = searchParams.get('from');
  const userId = searchParams.get('userId');
  const userName = searchParams.get('userName');

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return;
      
      try {
        setLoading(true);
        const postData = await getPost(postId);
        
        if (!postData) {
          setError('Post not found');
          return;
        }
        
        setPost(postData);
      } catch (err) {
        console.error('Error loading post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  const handleBack = () => {
    if (from === 'profile') {
      if (userId && userName) {
        // Navigate back to the specific user's profile
        router.push(`/?viewProfile=${userId}&userName=${encodeURIComponent(userName)}`);
      } else {
        // Navigate back to your own profile
        router.push('/?screen=profile');
      }
    } else if (from === 'feed') {
      // Navigate back to feed
      router.push('/');
    } else {
      // Default: navigate back to feed
      router.push('/');
    }
  };

  const getBackButtonText = () => {
    if (from === 'profile') {
      if (userName) {
        return `Back to ${userName}'s Profile`;
      } else {
        return 'Back to Profile';
      }
    } else if (from === 'feed') {
      return 'Back to Feed';
    }
    return 'Back to Feed';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Post not found'}</p>
          <button
            onClick={handleBack}
            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>{getBackButtonText()}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PostDetailScreen 
        post={post} 
        onBack={handleBack}
        backButtonText={getBackButtonText()}
      />
    </div>
  );
} 