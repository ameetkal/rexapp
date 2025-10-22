// SMS Invite Utility Functions

/**
 * Send SMS invite with invitation code
 * New system: uses short invite codes (e.g., rex.app/?i=ABC123)
 */
export const sendSMSInvite = (
  recommenderName: string, 
  currentUserName: string, 
  itemTitle: string,
  inviteCode: string
) => {
  // Extract first name from recommender name
  const firstName = recommenderName.split(' ')[0];
  const displayName = firstName || recommenderName;
  
  const message = `Hey ${displayName}! I just added "${itemTitle}" to Rex and said you recommended it. Check it out: ${window.location.origin}/?i=${inviteCode}`;
  
  console.log('📱 SMS Invite - Message:', message);
  console.log('📱 SMS Invite - Attempting to open SMS app...');
  
  const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
  console.log('📱 SMS Invite - SMS URL:', smsUrl);
  
  try {
    window.open(smsUrl, '_self');
    console.log('📱 SMS Invite - window.open called successfully');
  } catch (error) {
    console.error('📱 SMS Invite - Error opening SMS app:', error);
  }
};

export const shouldOfferSMSInvite = (recommenderName: string): boolean => {
  // Simple validation - check if it looks like a person's name
  const trimmed = recommenderName.trim();
  console.log(`🔍 SMS Invite Check: "${trimmed}"`);
  
  if (!trimmed || trimmed.length < 2) {
    console.log(`❌ SMS Invite: Too short (${trimmed.length} chars)`);
    return false;
  }
  
  // Skip if it looks like a website/app (contains dots or common website words)
  const websiteKeywords = ['website', 'app', 'blog', 'tiktok', 'instagram', 'youtube', 'twitter', 'facebook'];
  const lowerName = trimmed.toLowerCase();
  
  if (lowerName.includes('.')) {
    console.log(`❌ SMS Invite: Contains dot - looks like website`);
    return false;
  }
  
  if (websiteKeywords.some(keyword => lowerName.includes(keyword))) {
    console.log(`❌ SMS Invite: Contains website keyword`);
    return false;
  }
  
  // Skip if it's too generic
  const genericWords = ['friend', 'coworker', 'family', 'someone', 'person'];
  if (genericWords.includes(lowerName)) {
    console.log(`❌ SMS Invite: Generic word`);
    return false;
  }
  
  // If it passes these checks, it's probably a person's name
  console.log(`✅ SMS Invite: "${trimmed}" passed all checks!`);
  return true;
}; 