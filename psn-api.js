const fetch = require('node-fetch');
require('dotenv').config();
const db = require('./db');
const { 
  exchangeNpssoForCode, 
  exchangeCodeForAccessToken, 
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTrophyProfileSummary,
  getBasicPresence,
  getUserTitles: psnGetUserTitles,
  getTitleTrophies
} = require('psn-api');

// Sony PlayStation API authentication data
let accessToken = null;
let refreshToken = null;
let tokenExpiry = null;

// Load tokens from database at startup
async function loadTokensFromDatabase() {
  try {
    console.log('[Auth] Loading tokens from database');
    
    // Try to get refresh token from database
    const savedRefreshToken = await db.getToken('refresh_token');
    if (savedRefreshToken) {
      refreshToken = savedRefreshToken.token_value;
      console.log('[Auth] Loaded refresh token from database');
    }
    
    // Try to get access token from database
    const savedAccessToken = await db.getToken('access_token');
    if (savedAccessToken && savedAccessToken.expires_at) {
      // Only use if not expired
      if (new Date() < new Date(savedAccessToken.expires_at)) {
        accessToken = savedAccessToken.token_value;
        tokenExpiry = savedAccessToken.expires_at;
        console.log('[Auth] Loaded valid access token from database');
        console.log('[Auth] Token expires:', new Date(tokenExpiry).toISOString());
      } else {
        console.log('[Auth] Saved access token is expired, will refresh');
      }
    }
  } catch (error) {
    console.error('[Auth] Error loading tokens from database:', error.message);
    // Continue without tokens, they will be fetched fresh
  }
}

// Initialize the authentication with your NPSSO token (as a service account)
async function getAccessToken() {
  // If token is still valid, use it
  if (accessToken && tokenExpiry && new Date() < new Date(tokenExpiry)) {
    console.log('[Auth] Using existing valid token');
    return accessToken;
  }
  
  // Try to refresh the token if we have a refresh token
  if (refreshToken) {
    try {
      console.log('[Auth] Attempting to refresh token using psn-api library');
      const authorization = await exchangeRefreshTokenForAuthTokens(refreshToken);
      
      accessToken = authorization.accessToken;
      refreshToken = authorization.refreshToken;
      
      const now = new Date();
      tokenExpiry = new Date(now.getTime() + authorization.expiresIn * 1000);
      
      console.log('[Auth] Successfully refreshed token');
      console.log('[Auth] New token expires:', tokenExpiry.toISOString());
      
      // Save refreshed tokens to database
      try {
        await db.saveToken('access_token', accessToken, tokenExpiry);
        await db.saveToken('refresh_token', refreshToken, null);
        console.log('[Auth] Saved refreshed tokens to database');
      } catch (error) {
        console.error('[Auth] Failed to save refreshed tokens to database:', error.message);
      }
      
      return accessToken;
    } catch (error) {
      console.warn('[Auth] Failed to refresh token, will try to get a new one:', error.message);
      // Continue with the normal flow if refresh fails
    }
  }
  
  console.log('[Auth] Getting new tokens using NPSSO');
  const npsso = process.env.PSN_NPSSO;
  console.log('[Auth] PSN_NPSSO length:', npsso ? npsso.length : 'Not found');
  
  if (!npsso) {
    throw new Error('PSN_NPSSO environment variable is not set');
  }
  
  try {
    // Step 1: Exchange NPSSO for access code using the psn-api library
    console.log('[Auth] Exchanging NPSSO for access code');
    const accessCode = await exchangeNpssoForCode(npsso);
    console.log('[Auth] Got access code');
    
    // Step 2: Exchange access code for tokens using the psn-api library
    console.log('[Auth] Exchanging access code for tokens');
    const authorization = await exchangeCodeForAccessToken(accessCode);
    
    accessToken = authorization.accessToken;
    refreshToken = authorization.refreshToken;
    
    const now = new Date();
    tokenExpiry = new Date(now.getTime() + authorization.expiresIn * 1000);
    
    console.log('[Auth] Got access token');
    console.log('[Auth] Token expires:', tokenExpiry.toISOString());
    
    // Save tokens to database for persistence
    try {
      await db.saveToken('access_token', accessToken, tokenExpiry);
      await db.saveToken('refresh_token', refreshToken, null); // Refresh tokens don't expire
      console.log('[Auth] Saved tokens to database');
    } catch (error) {
      console.error('[Auth] Failed to save tokens to database:', error.message);
      // Continue even if saving fails
    }
    
    return accessToken;
  } catch (error) {
    console.error('[Auth] Failed to get access token:', error);
    throw error;
  }
}

// Get PSN user profile by PSN ID or online ID
async function getUserProfile(psnId) {
  try {
    console.log('[Trophy] Getting profile for', psnId);
    const token = await getAccessToken();
    
    // Use the psn-api library's getProfileFromUserName function
    try {
      const profile = await getProfileFromUserName(token, psnId);
      console.log('[Trophy] Got profile for', psnId, 'with accountId:', profile.accountId);
      return profile;
    } catch (error) {
      console.error('[Trophy] Failed to get profile for', psnId, ':', error.message);
      throw error;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Get trophy summary for a user
async function getTrophySummary(accountId) {
  try {
    console.log('[Trophy] Fetching trophy summary for accountId:', accountId);
    const token = await getAccessToken();
    
    // Use the psn-api library's getUserTrophyProfileSummary function
    const trophySummary = await getUserTrophyProfileSummary(token, accountId);
    console.log('[Trophy] Got trophy summary');
    
    return trophySummary;
  } catch (error) {
    console.error('Error getting trophy summary:', error);
    throw error;
  }
}

// Get recent titles for a user
async function getUserTitles(accountId) {
  try {
    console.log('[Deployment] Fetching user titles for accountId:', accountId);
    const token = await getAccessToken();
    
    // Use the psn-api library function
    const titlesResponse = await psnGetUserTitles(token, accountId, { limit: 10 });
    console.log('[Deployment] Got user titles');
    
    return titlesResponse.trophyTitles;
  } catch (error) {
    console.error('Error getting user titles:', error);
    throw error;
  }
}

// Get detailed trophy data for a title
async function getTrophyData(accountId, npCommunicationId) {
  try {
    console.log('[Trophy] Fetching trophy data for title:', npCommunicationId);
    const token = await getAccessToken();
    
    // Use the psn-api library's getTitleTrophies function
    const trophyData = await getTitleTrophies(token, npCommunicationId, accountId);
    console.log('[Trophy] Got trophy data for title');
    
    return trophyData;
  } catch (error) {
    console.error('Error getting trophy data:', error);
    throw error;
  }
}

// Get formatted PSN statistics for a user
async function getPSNStats(psnId) {
  try {
    console.log('[Trophy] Starting authentication');
    // First get the user's profile to get the account ID
    const profile = await getUserProfile(psnId);
    const accountId = profile.accountId;
    console.log('[Trophy] Got profile:', accountId);
    
    // Then get trophy summary
    const trophySummary = await getTrophySummary(accountId);
    
    // Format the data for the frontend
    return {
      trophyLevel: trophySummary.trophyLevel,
      progress: trophySummary.progress,
      earnedTrophies: {
        bronze: trophySummary.earnedTrophies.bronze,
        silver: trophySummary.earnedTrophies.silver,
        gold: trophySummary.earnedTrophies.gold,
        platinum: trophySummary.earnedTrophies.platinum
      },
      username: profile.onlineId
    };
  } catch (error) {
    console.error('Error getting PSN stats:', error);
    throw error;
  }
}

// Get title data for the most recent game
async function getTitleData(psnId) {
  try {
    console.log('Fetching title data...');
    console.log('[Deployment] Getting access token');
    const token = await getAccessToken();
    
    console.log('[Deployment] Getting profile');
    // First get the user's profile to get the account ID
    const profile = await getUserProfile(psnId);
    const accountId = profile.accountId;
    console.log('[Deployment] Got profile:', accountId);
    
    // Get the user's titles
    const titles = await getUserTitles(accountId);
    
    if (titles.length === 0) {
      throw new Error('No titles found for this user');
    }
    
    // Get the most recent title (first in the list)
    const recentTitle = titles[0];
    
    // Calculate percentage completion with two decimal places
    const totalTrophies = 
      recentTitle.definedTrophies.bronze + 
      recentTitle.definedTrophies.silver + 
      recentTitle.definedTrophies.gold + 
      recentTitle.definedTrophies.platinum;
    
    const earnedTrophies = 
      recentTitle.earnedTrophies.bronze + 
      recentTitle.earnedTrophies.silver + 
      recentTitle.earnedTrophies.gold + 
      recentTitle.earnedTrophies.platinum;
    
    const completionPercentage = ((earnedTrophies / totalTrophies) * 100).toFixed(2) + '%';
    
    // Format the data for the frontend
    const titleData = {
      titleName: recentTitle.trophyTitleName,
      titleIconUrl: recentTitle.trophyTitleIconUrl,
      trophyTitlePlatform: recentTitle.trophyTitlePlatform,
      definedTrophies: totalTrophies,
      earnedTrophies: earnedTrophies,
      completion: completionPercentage,
      breakdown: {
        bronzeDefined: recentTitle.definedTrophies.bronze,
        silverDefined: recentTitle.definedTrophies.silver,
        goldDefined: recentTitle.definedTrophies.gold,
        platinumDefined: recentTitle.definedTrophies.platinum,
        bronzeEarned: recentTitle.earnedTrophies.bronze,
        silverEarned: recentTitle.earnedTrophies.silver,
        goldEarned: recentTitle.earnedTrophies.gold,
        platinumEarned: recentTitle.earnedTrophies.platinum
      }
    };
    
    console.log('Title data fetched successfully:', titleData);
    return titleData;
  } catch (error) {
    console.error('Error getting title data:', error);
    throw error;
  }
}

module.exports = {
  loadTokensFromDatabase,
  getAccessToken,
  getUserProfile,
  getTrophySummary,
  getUserTitles,
  getTrophyData,
  getPSNStats,
  getTitleData
};