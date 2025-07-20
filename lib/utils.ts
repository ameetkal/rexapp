// SMS Invite Utility Functions

export const sendSMSInvite = (
  recommenderName: string, 
  currentUserName: string, 
  itemTitle: string,
  itemId: string,
  isPost: boolean = true
) => {
  const itemType = isPost ? 'shared on Rex' : 'saved on Rex';
  const basePath = isPost ? '/invite' : '/personal-invite';
  
  // Extract first name from recommender name
  const firstName = recommenderName.split(' ')[0];
  const displayName = firstName || recommenderName; // Fallback to full name if no space found
  
  const message = `Hey ${displayName}! Your recommendation for "${itemTitle}" is being ${itemType} by ${currentUserName}. Check it out: ${window.location.origin}${basePath}/${itemId}?ref=${encodeURIComponent(recommenderName)}`;
  
  const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
  window.open(smsUrl, '_self');
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