const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Create a new user
async function createUser(username, password) {
  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insert user into database
    const result = await db.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    
    return { success: true, userId: result.rows[0].id };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
}

// Authenticate a user
async function authenticateUser(username, password) {
  try {
    // Get user from database
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    const user = result.rows[0];
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return { success: false, error: 'Invalid password' };
    }
    
    return { success: true, user: { id: user.id, username: user.username } };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return { success: false, error: error.message };
  }
}

// Create or update user profile
async function createUserProfile(userId, psnId) {
  try {
    // Check if profile already exists
    const profileResult = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    // Generate a unique UUID for this user's overlay
    const overlayUuid = uuidv4();
    
    if (profileResult.rows.length === 0) {
      // Create new profile
      const result = await db.query(
        `INSERT INTO user_profiles 
        (user_id, psn_id, overlay_uuid) 
        VALUES ($1, $2, $3) RETURNING *`,
        [userId, psnId, overlayUuid]
      );
      
      return { success: true, profile: result.rows[0] };
    } else {
      // Update existing profile
      const result = await db.query(
        `UPDATE user_profiles 
        SET psn_id = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $2 RETURNING *`,
        [psnId, userId]
      );
      
      return { success: true, profile: result.rows[0] };
    }
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    return { success: false, error: error.message };
  }
}

// Update user profile customization settings
async function updateProfileCustomization(userId, customizations) {
  try {
    const { progressBarColor, levelIndicatorColor, profilePicPath, trophyGifPath } = customizations;
    
    const result = await db.query(
      `UPDATE user_profiles 
      SET progress_bar_color = COALESCE($1, progress_bar_color),
          level_indicator_color = COALESCE($2, level_indicator_color),
          profile_pic_path = COALESCE($3, profile_pic_path),
          trophy_gif_path = COALESCE($4, trophy_gif_path),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5 RETURNING *`,
      [progressBarColor, levelIndicatorColor, profilePicPath, trophyGifPath, userId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Profile not found' };
    }
    
    return { success: true, profile: result.rows[0] };
  } catch (error) {
    console.error('Error updating profile customization:', error);
    return { success: false, error: error.message };
  }
}

// Get user profile by ID
async function getUserProfileById(userId) {
  try {
    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Profile not found' };
    }
    
    return { success: true, profile: result.rows[0] };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { success: false, error: error.message };
  }
}

// Get overlay details by UUID
async function getOverlayDetailsByUuid(uuid) {
  try {
    const result = await db.query(
      `SELECT up.*, u.username 
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      WHERE up.overlay_uuid = $1`,
      [uuid]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Overlay not found' };
    }
    
    return { success: true, overlay: result.rows[0] };
  } catch (error) {
    console.error('Error getting overlay details:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createUser,
  authenticateUser,
  createUserProfile,
  updateProfileCustomization,
  getUserProfileById,
  getOverlayDetailsByUuid
};