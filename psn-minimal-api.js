// Minimal PSN API integration using the official psn-api library
const { exchangeNpssoForCode, exchangeCodeForAccessToken, getProfileFromUserName, getTitleTrophies, getUserTrophiesForTitle, getUserTrophyProfileSummary, getUserTitles, exchangeRefreshTokenForAuthTokens } = require('psn-api');

// Store tokens in memory similar to the successful implementation
let tokenData = {
  accessToken: null,
  refreshToken: null,
  expirationDate: null
};

/**
 * Initialize the PSN API with NPSSO code
 * @param {string} npssoCode - The NPSSO code from environment variable
 * @returns {Promise<object>} - The authentication result
 */
async function initializePSNApi(npssoCode) {
  try {
    console.log('Initializing PSN API with NPSSO code');
    
    // Get a valid token by using the getValidAccessToken function with NPSSO
    const accessToken = await getValidAccessToken(npssoCode);
    if (!accessToken) {
      throw new Error('Failed to obtain a valid access token');
    }
    
    console.log('Successfully initialized PSN API');
    return { success: true };
  } catch (error) {
    console.error('Error initializing PSN API:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get valid access token, refreshing if necessary or getting a new one
 * @param {string} [npssoCode] - Optional NPSSO code to use for getting a new token
 * @returns {Promise<string|null>} - The valid access token or null if failed
 */
async function getValidAccessToken(npssoCode = null) {
  const npsso = npssoCode || process.env.PSN_NPSSO;
  
  if (!npsso) {
    console.error("[Auth] PSN_NPSSO not configured");
    throw new Error("PSN_NPSSO not configured");
  }

  try {
    const currentTime = new Date();
    const isAccessTokenExpired = !tokenData.expirationDate || 
                              new Date(tokenData.expirationDate).getTime() < currentTime.getTime();

    // If we have a token and it's not expired, use it
    if (tokenData.accessToken && !isAccessTokenExpired) {
      console.log("[Auth] Using existing valid token");
      return tokenData.accessToken;
    }

    // Try refreshing if we have a refresh token
    if (tokenData.refreshToken) {
      console.log("[Auth] Token expired, attempting refresh");
      try {
        const newTokens = await exchangeRefreshTokenForAuthTokens(tokenData.refreshToken);
        const newExpirationDate = new Date(currentTime.getTime() + newTokens.expiresIn * 1000).toISOString();
        console.log("[Auth] Refresh successful, expires:", newExpirationDate);
        
        tokenData = {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expirationDate: newExpirationDate
        };
        return tokenData.accessToken;
      } catch (refreshError) {
        console.log("[Auth] Refresh failed:", refreshError.message);
      }
    }

    // If refresh failed or no refresh token, get a new token
    console.log("[Auth] Getting new tokens");
    const authCode = await exchangeNpssoForCode(npsso);
    console.log("[Auth] Got auth code");
    const tokens = await exchangeCodeForAccessToken(authCode);
    console.log("[Auth] Got access token");
    
    const expirationDate = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
    console.log("[Auth] Token expires:", expirationDate);
    
    tokenData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expirationDate: expirationDate
    };
    return tokenData.accessToken;
  } catch (error) {
    console.error("Token refresh failed:", error);
    throw error;
  }
}

/**
 * Get a user profile by PSN ID
 * @param {string} psnId - The PlayStation Network ID
 * @returns {Promise<object>} - The user profile data
 */
async function getUserProfile(psnId) {
  try {
    // Get a valid token
    const token = await getValidAccessToken();
    
    // Use the token directly to get the profile, using the accessToken property
    const profileResponse = await getProfileFromUserName({ accessToken: token }, psnId);
    console.log(`[Profile Debug] Profile response structure: ${JSON.stringify(Object.keys(profileResponse || {}))}`);
    
    // Make sure we're accessing the profile property from the response
    if (!profileResponse || !profileResponse.profile) {
      console.error(`[Profile Error] Invalid profile response structure for ${psnId}`);
      return { success: false, error: "Invalid profile response from PSN API" };
    }
    
    return { success: true, profile: profileResponse.profile };
  } catch (error) {
    console.error(`Error getting profile for ${psnId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get trophy information for a specific game
 * @param {string} psnId - The PlayStation Network ID
 * @param {string} gameId - The game's npCommunicationId
 * @returns {Promise<object>} - The trophy data
 */
async function getGameTrophyData(psnId, gameId) {
  try {
    // Get profile first to get the account ID
    const profileResult = await getUserProfile(psnId);
    if (!profileResult.success) {
      throw new Error(`Failed to get profile for ${psnId}: ${profileResult.error}`);
    }
    
    const accountId = profileResult.profile.accountId;
    console.log(`[Trophy Debug] Getting game trophy data for accountId: ${accountId}, gameId: ${gameId}`);
    
    try {
      // Get a valid token
      let token = await getValidAccessToken();
      if (!token) {
        throw new Error('Not authenticated. Initialize PSN API first.');
      }
      
      // Create auth object - this matches your original implementation
      const authObj = { accessToken: token };
      
      try {
        console.log('[Trophy Debug] Getting title trophies');
        // Get title trophy information (trophy list with details)
        const titleTrophies = await getTitleTrophies(authObj, gameId);
        
        console.log('[Trophy Debug] Getting user trophies for title');
        // Get user's earned trophies for this title
        const userTrophies = await getUserTrophiesForTitle(authObj, accountId, gameId);
        
        return {
          success: true,
          titleTrophies: titleTrophies,
          userTrophies: userTrophies
        };
      } catch (error) {
        console.error('[Trophy Debug] Error in trophy data retrieval:', error.message);
        
        // If token is invalid, force getting a fresh token and retry
        if (error.message === 'Invalid access token') {
          console.log('Got invalid token error in getGameTrophyData, getting fresh token and retrying...');
          
          // Force a new token by setting the expiration date to the past
          tokenData.expirationDate = new Date(0).toISOString();
          
          // Get a fresh token
          token = await getValidAccessToken();
          if (!token) {
            throw new Error('Failed to get fresh authentication token.');
          }
          
          const authObj = { accessToken: token };
          
          // Retry with new token
          console.log('[Trophy Debug] Retrying trophy data retrieval with fresh token');
          const titleTrophies = await getTitleTrophies(authObj, gameId);
          const userTrophies = await getUserTrophiesForTitle(authObj, accountId, gameId);
          
          return {
            success: true,
            titleTrophies: titleTrophies,
            userTrophies: userTrophies
          };
        }
        
        // Handle other errors
        return {
          success: false,
          error: error.message
        };
      }
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error(`Error getting trophy data for ${psnId} and game ${gameId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get trophy summary for a user
 * @param {string} psnId - The PlayStation Network ID
 * @returns {Promise<object>} - Trophy summary data
 */
async function getTrophySummary(psnId) {
  try {
    // Get profile first to get the account ID
    const profileResult = await getUserProfile(psnId);
    if (!profileResult.success) {
      throw new Error(`Failed to get profile for ${psnId}: ${profileResult.error}`);
    }

    const accountId = profileResult.profile.accountId;
    console.log(`[Trophy Debug] Getting trophy summary for accountId: ${accountId}`);
    
    try {
      // Get a valid token
      let token = await getValidAccessToken();
      if (!token) {
        throw new Error('Not authenticated. Initialize PSN API first.');
      }
      
      try {
        // This follows the same pattern as the original working code
        console.log('[Trophy Debug] Calling getUserTrophyProfileSummary with access token');
        
        // Here's the important change - match the format from the original working code
        const trophySummary = await getUserTrophyProfileSummary({ accessToken: token }, accountId);
        
        console.log('[Trophy Debug] Trophy summary response structure:', 
          JSON.stringify(Object.keys(trophySummary || {})));
        
        return {
          success: true,
          trophySummary: trophySummary
        };
      } catch (error) {
        console.error('[Trophy Debug] Error in getUserTrophyProfileSummary:', error.message);
        
        // If token is invalid, force getting a fresh token and retry
        if (error.message === 'Invalid access token') {
          console.log('Got invalid token error in getTrophySummary, getting fresh token and retrying...');
          
          // Force a new token by setting the expiration date to the past
          tokenData.expirationDate = new Date(0).toISOString();
          
          // Get a fresh token
          token = await getValidAccessToken();
          if (!token) {
            throw new Error('Failed to get fresh authentication token.');
          }
          
          // Retry with new token
          console.log('[Trophy Debug] Retrying getUserTrophyProfileSummary with fresh token');
          // Using the correct format for the API call
          const trophySummary = await getUserTrophyProfileSummary({ accessToken: token }, accountId);
          return {
            success: true,
            trophySummary: trophySummary
          };
        }
        
        // Handle other errors
        return {
          success: false,
          error: error.message
        };
      }
    } catch (error) {
      throw error; 
    }
  } catch (error) {
    console.error(`Error getting trophy summary for ${psnId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all trophy titles for a user
 * @param {string} psnId - The PlayStation Network ID
 * @returns {Promise<object>} - Trophy titles data
 */
async function getUserTrophyTitles(psnId) {
  try {
    // Get profile first to get the account ID
    const profileResult = await getUserProfile(psnId);
    if (!profileResult.success) {
      throw new Error(`Failed to get profile for ${psnId}: ${profileResult.error}`);
    }

    const accountId = profileResult.profile.accountId;
    console.log(`[Trophy Debug] Getting trophy titles for accountId: ${accountId}`);
    
    try {
      // Get a valid token
      let token = await getValidAccessToken();
      if (!token) {
        throw new Error('Not authenticated. Initialize PSN API first.');
      }
      
      try {
        // Following the same pattern as the original working code
        console.log('[Trophy Debug] Calling getUserTitles with auth object');
        
        // Using the same format as in the original working code
        // Matching how your original implementation calls getUserTitles
        const trophyTitlesResult = await getUserTitles({ accessToken: token }, accountId);
        
        console.log('[Trophy Debug] Trophy titles response structure:', 
          JSON.stringify(Object.keys(trophyTitlesResult || {})));
        
        return {
          success: true,
          trophyTitles: trophyTitlesResult
        };
      } catch (error) {
        console.error('[Trophy Debug] Error in getUserTitles:', error.message);
        
        // If token is invalid, force getting a fresh token and retry
        if (error.message === 'Invalid access token') {
          console.log('Got invalid token error in getUserTrophyTitles, getting fresh token and retrying...');
          
          // Force a new token by setting the expiration date to the past
          tokenData.expirationDate = new Date(0).toISOString();
          
          // Get a fresh token
          token = await getValidAccessToken();
          if (!token) {
            throw new Error('Failed to get fresh authentication token.');
          }
          
          // Retry with new token
          console.log('[Trophy Debug] Retrying getUserTitles with fresh token');
          // Using the correct format that matches the original code
          const trophyTitlesResult = await getUserTitles({ accessToken: token }, accountId);
          return {
            success: true,
            trophyTitles: trophyTitlesResult
          };
        }
        
        // Handle other errors
        return {
          success: false,
          error: error.message
        };
      }
    } catch (error) {
      throw error; 
    }
  } catch (error) {
    console.error(`Error getting trophy titles for ${psnId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get complete profile data with trophy information
 * @param {string} psnId - The PlayStation Network ID
 * @returns {Promise<object>} - Complete profile data
 */
async function getCompleteProfileData(psnId) {
  try {
    const token = await getValidAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Initialize PSN API first.');
    }

    // Get basic profile
    const profileResult = await getUserProfile(psnId);
    if (!profileResult.success) {
      throw new Error(`Failed to get profile for ${psnId}: ${profileResult.error}`);
    }
    
    const profile = profileResult.profile;
    
    // Get trophy summary
    const summaryResult = await getTrophySummary(psnId);
    if (summaryResult.success) {
      profile.trophySummary = summaryResult.trophySummary;
    }
    
    // Get trophy titles and latest trophy
    let latestTrophy = null;
    let titles = [];
    try {
      const titlesResult = await getUserTrophyTitles(psnId);
      if (titlesResult.success && titlesResult.trophyTitles && titlesResult.trophyTitles.trophyTitles) {
        const trophyTitles = titlesResult.trophyTitles.trophyTitles;
        
        if (Array.isArray(trophyTitles) && trophyTitles.length > 0) {
          // Sort by last played date
          const sortedTitles = [...trophyTitles].sort((a, b) => {
            return new Date(b.lastUpdatedDateTime) - new Date(a.lastUpdatedDateTime);
          });
          
          // Save the sorted titles to return them
          titles = sortedTitles;
          
          if (sortedTitles.length > 0) {
            const recentTitle = sortedTitles[0];
            latestTrophy = `${recentTitle.trophyTitleName} (${recentTitle.progress}%)`;
          }
        } else {
          console.warn('Trophy titles array is empty or not in expected format');
        }
      } else {
        console.warn('Trophy titles data not in expected format');
      }
    } catch (error) {
      console.warn('Failed to get trophy titles:', error.message);
    }
    
    return {
      success: true,
      profile: profile,
      titles: titles,
      latestTrophy: latestTrophy
    };
  } catch (error) {
    console.error(`Error getting complete profile data for ${psnId}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializePSNApi,
  getUserProfile,
  getGameTrophyData,
  getTrophySummary,
  getUserTrophyTitles,
  getCompleteProfileData,
  getValidAccessToken
};