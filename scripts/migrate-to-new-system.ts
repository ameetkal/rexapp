#!/usr/bin/env tsx

/**
 * Migration script to convert existing posts and personal_items to the new data model
 * 
 * This script:
 * 1. Reads all existing posts and personal_items
 * 2. Converts them to the new system (things, user_thing_interactions, posts_v2, recommendations)
 * 3. Preserves all existing data
 * 
 * Run with: npx tsx scripts/migrate-to-new-system.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Post, PersonalItem } from '../lib/types';
import { 
  migratePostToNewSystem, 
  migratePersonalItemToNewSystem,
  getPost,
  getPersonalItem 
} from '../lib/firestore';

// Firebase config (you may need to adjust this)
const firebaseConfig = {
  // Add your Firebase config here
  // This should match your existing Firebase setup
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateAllData() {
  console.log('🚀 Starting migration to new data model...');
  
  try {
    // 1. Migrate all posts
    console.log('\n📝 Migrating posts...');
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    console.log(`Found ${postsSnapshot.size} posts to migrate`);
    
    let postsMigrated = 0;
    let postsErrors = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      try {
        const post = { id: postDoc.id, ...postDoc.data() } as Post;
        console.log(`Migrating post: "${post.title}"`);
        
        const result = await migratePostToNewSystem(post);
        console.log(`✅ Migrated post "${post.title}" -> Thing: ${result.thingId}, PostV2: ${result.postId}`);
        postsMigrated++;
        
        // Add small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error migrating post ${postDoc.id}:`, error);
        postsErrors++;
      }
    }
    
    // 2. Migrate all personal items
    console.log('\n📋 Migrating personal items...');
    const personalItemsSnapshot = await getDocs(collection(db, 'personal_items'));
    console.log(`Found ${personalItemsSnapshot.size} personal items to migrate`);
    
    let personalItemsMigrated = 0;
    let personalItemsErrors = 0;
    
    for (const itemDoc of personalItemsSnapshot.docs) {
      try {
        const personalItem = { id: itemDoc.id, ...itemDoc.data() } as PersonalItem;
        console.log(`Migrating personal item: "${personalItem.title}"`);
        
        const result = await migratePersonalItemToNewSystem(personalItem);
        console.log(`✅ Migrated personal item "${personalItem.title}" -> Thing: ${result.thingId}`);
        personalItemsMigrated++;
        
        // Add small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error migrating personal item ${itemDoc.id}:`, error);
        personalItemsErrors++;
      }
    }
    
    // 3. Summary
    console.log('\n🎉 Migration completed!');
    console.log(`📝 Posts migrated: ${postsMigrated}/${postsSnapshot.size} (${postsErrors} errors)`);
    console.log(`📋 Personal items migrated: ${personalItemsMigrated}/${personalItemsSnapshot.size} (${personalItemsErrors} errors)`);
    
    if (postsErrors === 0 && personalItemsErrors === 0) {
      console.log('✅ All data migrated successfully!');
    } else {
      console.log(`⚠️  Migration completed with ${postsErrors + personalItemsErrors} errors. Check logs above.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateAllData()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateAllData };
