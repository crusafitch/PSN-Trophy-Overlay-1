// server.js

// ===================== Imports & Requires =====================
const express = require("express");
const fetch = require("node-fetch");
const {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  exchangeRefreshTokenForAuthTokens,
  getUserTrophyProfileSummary,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getBasicPresence,
  getProfileFromUserName
} = require("psn-api");

// ===================== Initialize Express & Token Storage =====================
const app = express();
const port = 3000;

let tokenData = {
  accessToken: null,
  refreshToken: null,
  expirationDate: null
};

async function getValidAccessToken() {
  const npsso = process.env.PSN_NPSSO;
  
  if (!npsso) {
    console.error("[Auth] PSN_NPSSO not configured");
    throw new Error("PSN_NPSSO not configured");
  }
  console.log("[Auth] PSN_NPSSO length:", npsso.length);

  try {
    const currentTime = new Date();
    const isAccessTokenExpired = !tokenData.expirationDate || 
                                new Date(tokenData.expirationDate).getTime() < currentTime.getTime();

    if (tokenData.accessToken && !isAccessTokenExpired) {
      console.log("[Auth] Using existing valid token");
      return tokenData.accessToken;
    }

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

// Add CORS headers with explicit methods
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Serve static files from the "public" folder
app.use(express.static("public", {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ===================== Overall Trophy Summary Endpoint (/api/psn-stats) =====================
async function getTrophyData() {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) {
    console.error("[Trophy] Missing PSN_NPSSO environment variable");
    throw new Error("PSN authentication token not configured");
  }

  try {
    console.log("[Trophy] Starting authentication");
    const accessToken = await getValidAccessToken();
    
    console.log("[Trophy] Getting profile");
    const profileResponse = await getProfileFromUserName({ accessToken: accessToken }, "crusafitch");
    if (!profileResponse || !profileResponse.profile || !profileResponse.profile.accountId) {
      console.error("[Trophy] Invalid profile response:", profileResponse);
      throw new Error("Invalid profile response");
    }
    const profile = profileResponse.profile;
    console.log("[Trophy] Got profile:", profile.accountId);
    
    console.log("[Trophy] Fetching trophy summary");
    const trophySummary = await getUserTrophyProfileSummary({ accessToken: accessToken }, profile.accountId);
    console.log("[Trophy] Got trophy summary:", JSON.stringify(trophySummary, null, 2));

    return {
      trophyLevel: trophySummary?.trophyLevel || 0,
      progress: trophySummary?.progress || 0,
      earnedTrophies: {
        bronze: trophySummary.earnedTrophies.bronze,
        silver: trophySummary.earnedTrophies.silver,
        gold: trophySummary.earnedTrophies.gold,
        platinum: trophySummary.earnedTrophies.platinum
      },
      username: "crusafitch"
    };
  } catch (error) {
    console.error("[Trophy] Error in getTrophyData:", error);
    return {
      trophyLevel: 0,
      progress: 0,
      earnedTrophies: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      username: "crusafitch"
    };
  }
}

app.get("/api/psn-stats", async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const trophyData = await getTrophyData();
    res.json(trophyData);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// ===================== Trophy Descriptions Endpoint (/api/trophy-details) =====================
async function getTrophyDetails() {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) throw new Error("No NPSSO token provided in environment");
  try {
    const authCode = await exchangeNpssoForCode(npsso);
    const accessToken = await exchangeCodeForAccessToken(authCode);
    const titles = await getUserTitles(accessToken, "me");
    const recentTitle = titles.trophyTitles[0];

    const trophyInfo = await getTitleTrophies(accessToken, recentTitle.npCommunicationId);
    const userTrophies = await getUserTrophiesForTitle(
      accessToken,
      "me",
      recentTitle.npCommunicationId
    );

    return {
      trophies: trophyInfo.trophies.map(trophy => ({
        name: trophy.trophyName,
        description: trophy.trophyDetail,
        type: trophy.trophyType,
        earned: userTrophies.trophies.find(t => t.trophyId === trophy.trophyId)?.earned || false
      }))
    };
  } catch (error) {
    console.error("Error in getTrophyDetails:", error);
    throw error;
  }
}

app.get("/api/trophy-details", async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const trophyData = await getTrophyDetails();
    res.json(trophyData);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// ===================== Title Data Endpoint (/api/psn-title) =====================
async function getTitleData() {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) {
    console.error("[Deployment] Missing PSN_NPSSO environment variable");
    throw new Error("PSN authentication token not configured");
  }
  try {
    console.log("[Deployment] Getting access token");
    const accessToken = await getValidAccessToken();
    
    console.log("[Deployment] Getting profile");
    const profileResponse = await getProfileFromUserName({ accessToken: accessToken }, "crusafitch");
    if (!profileResponse || !profileResponse.profile || !profileResponse.profile.accountId) {
      console.error("[Deployment] Invalid profile response:", profileResponse);
      throw new Error("Invalid profile response");
    }
    const profile = profileResponse.profile;
    console.log("[Deployment] Got profile:", profile.accountId);

    console.log("[Deployment] Fetching user titles");
    const result = await Promise.race([
      getUserTitles({ accessToken: accessToken }, profile.accountId),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Title fetch timeout")), 15000))
    ]);
    const titles = result?.trophyTitles;
    if (!titles || titles.length === 0) throw new Error("No titles found for user");

    // Sort by most recent update.
    titles.sort((a, b) => new Date(b.lastUpdatedDateTime) - new Date(a.lastUpdatedDateTime));
    const recent = titles[0];

    // Get raw trophy counts (base game)
    const defined = recent.definedTrophies || {};
    const earned = recent.earnedTrophies || {};
    const totalDefined = (defined.bronze || 0) + (defined.silver || 0) + (defined.gold || 0) + (defined.platinum || 0);
    const totalEarned = (earned.bronze || 0) + (earned.silver || 0) + (earned.gold || 0) + (earned.platinum || 0);

    // Weighted calculation using bronze, silver, and gold only (excluding platinum)
    const pointsDefined =
      ((defined.bronze || 0) * 15) +
      ((defined.silver || 0) * 30) +
      ((defined.gold || 0) * 90);
    const pointsEarned =
      ((earned.bronze || 0) * 15) +
      ((earned.silver || 0) * 30) +
      ((earned.gold || 0) * 90);
    const weightedCompletion = pointsDefined > 0 ? ((pointsEarned / pointsDefined) * 100).toFixed(2) + "%" : "0%";

    const customTitleObj = {
      titleName: recent.trophyTitleName || "Unknown Game",
      titleIconUrl: recent.trophyTitleIconUrl || "",
      trophyTitlePlatform: recent.trophyTitlePlatform || "",
      definedTrophies: totalDefined,
      earnedTrophies: totalEarned,
      completion: weightedCompletion,
      breakdown: {
        bronzeDefined: defined.bronze || 0,
        silverDefined: defined.silver || 0,
        goldDefined: defined.gold || 0,
        platinumDefined: defined.platinum || 0,
        bronzeEarned: earned.bronze || 0,
        silverEarned: earned.silver || 0,
        goldEarned: earned.gold || 0,
        platinumEarned: earned.platinum || 0
      }
    };

    return customTitleObj;
  } catch (error) {
    console.error("[Deployment] Error in getTitleData:", {
      message: error.message,
      type: error.name,
      timestamp: new Date().toISOString(),
      npssoPresent: !!process.env.PSN_NPSSO
    });
    throw new Error(`PSN API Error: ${error.message}`);
  }
}

app.get("/api/psn-title", async (req, res) => {
  try {
    console.log("Fetching title data...");
    const titleData = await getTitleData();
    console.log("Title data fetched successfully:", titleData);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(titleData);
  } catch (error) {
    console.error("Detailed error in /api/psn-title:", error);
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ error: error.toString(), stack: error.stack });
  }
});

// ===================== Root Route & Start Server =====================
app.get("/", (req, res) => {
  res.send("PSN achievement auto-update server is running.");
});

// Add health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port} (0.0.0.0)`);
});