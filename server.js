// server.js - Multi-user PSN Trophy Tracker

// ===================== Imports & Requires =====================
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import our custom modules
const db = require('./db');
const auth = require('./auth');
const { uploadProfilePic, uploadTrophyGif } = require('./uploads');
const psnApi = require('./psn-api');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

// ===================== Initialize Express =====================
const app = express();
const port = process.env.PORT || process.env.NODE_PORT || 5000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Add CORS headers for Replit environments
app.use((req, res, next) => {
  // Allow requests from any origin
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
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
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Initialize database on startup
db.initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
    // Load PSN tokens from database
    return psnApi.loadTokensFromDatabase();
  })
  .then(() => {
    console.log('PSN tokens loaded from database (if available)');
  })
  .catch(err => console.error('Initialization error:', err));

// ==================== Authentication Routes ====================

// Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, psnId } = req.body;

    if (!username || !password || !psnId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create user in database
    const userResult = await auth.createUser(username, password);

    if (!userResult.success) {
      return res.status(400).json({ error: userResult.error });
    }

    // Create user profile with PSN ID
    const profileResult = await auth.createUserProfile(userResult.userId, psnId);

    if (!profileResult.success) {
      return res.status(500).json({ error: profileResult.error });
    }

    // Set session
    req.session.userId = userResult.userId;
    req.session.username = username;
    req.session.psnId = psnId;

    res.status(201).json({ 
      message: 'User registered successfully',
      overlayUrl: `/overlay/${profileResult.profile.overlay_uuid}`
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    // Authenticate user
    const authResult = await auth.authenticateUser(username, password);

    if (!authResult.success) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user profile
    const profileResult = await auth.getUserProfileById(authResult.user.id);

    if (!profileResult.success) {
      return res.status(500).json({ error: 'Failed to retrieve user profile' });
    }

    // Set session
    req.session.userId = authResult.user.id;
    req.session.username = authResult.user.username;
    req.session.psnId = profileResult.profile.psn_id;

    res.json({ 
      message: 'Login successful',
      user: {
        id: authResult.user.id,
        username: authResult.user.username,
        psnId: profileResult.profile.psn_id
      },
      overlayUrl: `/overlay/${profileResult.profile.overlay_uuid}`
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Check if user is logged in
app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      authenticated: true, 
      user: {
        id: req.session.userId,
        username: req.session.username,
        psnId: req.session.psnId
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== User Profile Routes ====================

// Update user profile customization
app.post('/api/profile/customize', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { progressBarColor, levelIndicatorColor } = req.body;

    const customizations = {
      progressBarColor,
      levelIndicatorColor,
      profilePicPath: null,
      trophyGifPath: null
    };

    // Update profile customization
    const result = await auth.updateProfileCustomization(req.session.userId, customizations);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: 'Profile customization updated successfully',
      profile: result.profile
    });
  } catch (error) {
    console.error('Profile customization error:', error);
    res.status(500).json({ error: 'Failed to update profile customization' });
  }
});

// Upload profile picture
app.post('/api/profile/upload-pic', (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    uploadProfilePic(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get relative path for database storage
      const profilePicPath = `/uploads/profile_pics/${req.file.filename}`;

      // Update profile with the new profile picture path
      const result = await auth.updateProfileCustomization(req.session.userId, { profilePicPath });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({ 
        message: 'Profile picture uploaded successfully',
        profilePicUrl: profilePicPath
      });
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Upload trophy animation GIF
app.post('/api/profile/upload-gif', (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    uploadTrophyGif(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get relative path for database storage
      const trophyGifPath = `/uploads/trophy_gifs/${req.file.filename}`;

      // Update profile with the new trophy GIF path
      try {
        const result = await auth.updateProfileCustomization(req.session.userId, {
          trophyGifPath,
          profilePicPath: null // Preserve existing profile pic path
        });

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        console.log('Trophy GIF update successful:', trophyGifPath);
      } catch (err) {
        console.error('Trophy GIF update error:', err);
        return res.status(500).json({ error: 'Failed to update trophy GIF' });
      }

      res.json({ 
        message: 'Trophy animation GIF uploaded successfully',
        trophyGifUrl: trophyGifPath
      });
    });
  } catch (error) {
    console.error('Trophy GIF upload error:', error);
    res.status(500).json({ error: 'Failed to upload trophy animation GIF' });
  }
});

// Get user profile
app.get('/api/profile', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user profile
    const result = await auth.getUserProfileById(req.session.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      profile: {
        psnId: result.profile.psn_id,
        overlayUuid: result.profile.overlay_uuid,
        progressBarColor: result.profile.progress_bar_color,
        levelIndicatorColor: result.profile.level_indicator_color,
        profilePic: result.profile.profile_pic_path,
        trophyGif: result.profile.trophy_gif_path
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile data' });
  }
});

// ==================== PSN API Routes ====================

// Get overall trophy summary for the specified PSN ID
app.get('/api/psn-stats/:psnId', async (req, res) => {
  try {
    const psnId = req.params.psnId;

    if (!psnId) {
      return res.status(400).json({ error: 'PSN ID is required' });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const trophyData = await psnApi.getPSNStats(psnId);
    res.json(trophyData);
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    res.status(500).json({ error: error.toString() });
  }
});

// Get recent title data for the specified PSN ID
app.get('/api/psn-title/:psnId', async (req, res) => {
  try {
    const psnId = req.params.psnId;

    if (!psnId) {
      return res.status(400).json({ error: 'PSN ID is required' });
    }

    console.log("Fetching title data...");
    const titleData = await psnApi.getTitleData(psnId);
    console.log("Title data fetched successfully:", titleData);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(titleData);
  } catch (error) {
    console.error("Detailed error in /api/psn-title:", error);
    res.set('Cache-Control', 'no-store');
    res.status(500).json({ error: error.toString() });
  }
});

// ==================== Overlay Routes ====================

// Create an overlay configuration (No login required)
app.post('/api/overlay/create', upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'trophyGif', maxCount: 1 }
]), async (req, res) => {
  try {
    const { psnId } = req.body;

    if (!psnId) {
      return res.status(400).json({ error: 'PSN ID is required' });
    }

    // Get color values from request body or use defaults
    const progressBarColor = req.body.progressBarColor || '#0072ce';
    const levelIndicatorColor = req.body.levelIndicatorColor || '#f7a600';

    // Generate UUID for this overlay
    const uuid = uuidv4();

    // Create the overlay entry
    const result = await auth.createUserProfile(uuid, psnId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Update customization settings
    const customizations = {
      progressBarColor,
      levelIndicatorColor,
      profilePicPath: null,
      trophyGifPath: null
    };

    // Process file uploads if they exist
    if (req.files) {
      // Profile picture
      if (req.files.profilePic && req.files.profilePic.length > 0) {
        const profilePicFile = req.files.profilePic[0];
        customizations.profilePicPath = `/uploads/${profilePicFile.filename}`;
      }

      // Trophy GIF
      if (req.files.trophyGif && req.files.trophyGif.length > 0) {
        const trophyGifFile = req.files.trophyGif[0];
        customizations.trophyGifPath = `/uploads/${trophyGifFile.filename}`;
      }
    }

    // Update settings in database
    await auth.updateProfileCustomization(uuid, customizations);

    // Return success with the overlay ID
    res.status(201).json({
      message: 'Overlay created successfully',
      overlayId: uuid
    });
  } catch (error) {
    console.error('Overlay creation error:', error);
    res.status(500).json({ error: 'Failed to create overlay' });
  }
});

// Serve the overlay HTML for a specific UUID
app.get('/overlay/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;

    if (!uuid) {
      return res.status(400).send('Overlay ID is required');
    }

    // Get overlay details from database
    const result = await auth.getOverlayDetailsByUuid(uuid);

    if (!result.success) {
      return res.status(404).send('Overlay not found');
    }

    // Serve the overlay HTML file
    res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
  } catch (error) {
    console.error('Overlay fetch error:', error);
    res.status(500).send('Error loading overlay');
  }
});

// Get overlay configuration for a specific UUID
app.get('/api/overlay/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;

    if (!uuid) {
      return res.status(400).json({ error: 'Overlay ID is required' });
    }

    // Get overlay details from database
    const result = await auth.getOverlayDetailsByUuid(uuid);

    if (!result.success) {
      return res.status(404).json({ error: 'Overlay not found' });
    }

    // Return overlay configuration
    res.json({
      overlay: {
        psnId: result.overlay.psn_id,
        progressBarColor: result.overlay.progress_bar_color,
        levelIndicatorColor: result.overlay.level_indicator_color,
        profilePic: result.overlay.profile_pic_path,
        trophyGif: result.overlay.trophy_gif_path
      }
    });
  } catch (error) {
    console.error('Overlay API error:', error);
    res.status(500).json({ error: 'Error loading overlay configuration' });
  }
});

// ==================== Root Route & Start Server =====================

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port} (0.0.0.0)`);
  console.log(`Access the application at: http://localhost:${port}`);
  console.log(`Server ready for external connections`);
});