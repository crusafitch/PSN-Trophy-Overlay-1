const { Pool } = require('pg');
require('dotenv').config();

// Create a new Pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database tables (if they don't exist)
async function initializeDatabase() {
  // Use a transaction to avoid partial setup
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if users table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create users table
      await client.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create user_profiles table to store PSN info and customization
      await client.query(`
        CREATE TABLE user_profiles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          psn_id VARCHAR(255) NOT NULL,
          overlay_uuid VARCHAR(255) UNIQUE NOT NULL,
          progress_bar_color VARCHAR(50) DEFAULT '#FFFFFF',
          level_indicator_color VARCHAR(50) DEFAULT '#FFFFFF',
          profile_pic_path VARCHAR(255),
          trophy_gif_path VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create auth_tokens table to store refresh tokens
      await client.query(`
        CREATE TABLE auth_tokens (
          id SERIAL PRIMARY KEY,
          token_type VARCHAR(50) NOT NULL,
          token_value TEXT NOT NULL,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('Database tables created successfully');
    } else {
      // Check if auth_tokens table exists, and create it if not
      const authTokensExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'auth_tokens'
        )
      `);
      
      if (!authTokensExists.rows[0].exists) {
        // Create auth_tokens table to store refresh tokens
        await client.query(`
          CREATE TABLE auth_tokens (
            id SERIAL PRIMARY KEY,
            token_type VARCHAR(50) NOT NULL,
            token_value TEXT NOT NULL,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('Auth tokens table created successfully');
      }
      
      console.log('Database tables already exist');
    }
    
    // Check if overlays table exists, and create it if not
    const overlaysExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'overlays'
      )
    `);
    
    if (!overlaysExists.rows[0].exists) {
      // Create overlays table to store user's custom overlay settings
      await client.query(`
        CREATE TABLE overlays (
          id VARCHAR(36) PRIMARY KEY,
          psn_id VARCHAR(255) NOT NULL,
          progress_color VARCHAR(50) DEFAULT '#2d7fea',
          level_color VARCHAR(50) DEFAULT '#FFD700',
          profile_pic_path TEXT,
          trophy_gif_path TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Overlays table created successfully');
    }
    
    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// Functions to manage authentication tokens
async function saveToken(tokenType, tokenValue, expiresAt) {
  try {
    // Check if a token of this type already exists
    const existing = await pool.query('SELECT id FROM auth_tokens WHERE token_type = $1', [tokenType]);
    
    if (existing.rows.length > 0) {
      // Update existing token
      const result = await pool.query(
        'UPDATE auth_tokens SET token_value = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP WHERE token_type = $3 RETURNING *',
        [tokenValue, expiresAt, tokenType]
      );
      console.log(`Updated ${tokenType} token`);
      return result.rows[0];
    } else {
      // Insert new token
      const result = await pool.query(
        'INSERT INTO auth_tokens (token_type, token_value, expires_at) VALUES ($1, $2, $3) RETURNING *',
        [tokenType, tokenValue, expiresAt]
      );
      console.log(`Saved new ${tokenType} token`);
      return result.rows[0];
    }
  } catch (error) {
    console.error(`Error saving ${tokenType} token:`, error);
    throw error;
  }
}

async function getToken(tokenType) {
  try {
    const result = await pool.query('SELECT * FROM auth_tokens WHERE token_type = $1', [tokenType]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving ${tokenType} token:`, error);
    throw error;
  }
}

// Functions to manage overlay data
async function createOverlay(overlayData) {
  try {
    const { id, psnId, progressColor, levelColor } = overlayData;
    
    const result = await pool.query(
      'INSERT INTO overlays (id, psn_id, progress_color, level_color) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, psnId, progressColor, levelColor]
    );
    console.log(`Created overlay for PSN ID: ${psnId} with ID: ${id}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating overlay:', error);
    throw error;
  }
}

async function getOverlay(overlayId) {
  try {
    const result = await pool.query('SELECT * FROM overlays WHERE id = $1', [overlayId]);
    if (result.rows.length > 0) {
      // Transform database column names to camelCase for consistency with our code
      const overlay = result.rows[0];
      return {
        id: overlay.id,
        psnId: overlay.psn_id,
        progressColor: overlay.progress_color,
        levelColor: overlay.level_color, 
        profilePicPath: overlay.profile_pic_path,
        trophyGifPath: overlay.trophy_gif_path,
        createdAt: overlay.created_at
      };
    }
    return null;
  } catch (error) {
    console.error('Error retrieving overlay:', error);
    throw error;
  }
}

async function updateOverlay(overlayId, updateData) {
  try {
    console.log(`Updating overlay ${overlayId} with data:`, JSON.stringify(updateData, null, 2));
    
    const { profilePicPath, trophyGifPath } = updateData;
    const updates = [];
    const values = [];
    
    if (profilePicPath !== undefined) {
      updates.push(`profile_pic_path = $${updates.length + 1}`);
      values.push(profilePicPath);
      console.log(`Adding profile_pic_path update with value: ${profilePicPath}`);
    }
    
    if (trophyGifPath !== undefined) {
      updates.push(`trophy_gif_path = $${updates.length + 1}`);
      values.push(trophyGifPath);
      console.log(`Adding trophy_gif_path update with value: ${trophyGifPath}`);
    }
    
    if (updates.length === 0) {
      console.log(`No fields to update for overlay ${overlayId}`);
      return null; // Nothing to update
    }
    
    values.push(overlayId);
    
    const query = `
      UPDATE overlays 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length} 
      RETURNING *
    `;
    
    console.log(`Executing SQL query: ${query.replace(/\n/g, ' ').trim()}`);
    console.log(`With values: ${JSON.stringify(values)}`);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length > 0) {
      console.log(`Successfully updated overlay ${overlayId} in database`);
      // Transform database column names to camelCase for consistency
      const overlay = result.rows[0];
      const updatedOverlay = {
        id: overlay.id,
        psnId: overlay.psn_id,
        progressColor: overlay.progress_color,
        levelColor: overlay.level_color, 
        profilePicPath: overlay.profile_pic_path,
        trophyGifPath: overlay.trophy_gif_path,
        createdAt: overlay.created_at
      };
      
      console.log(`Updated overlay object:`, JSON.stringify(updatedOverlay, null, 2));
      return updatedOverlay;
    }
    
    console.log(`No rows returned after update for overlay ${overlayId}`);
    return null;
  } catch (error) {
    console.error(`Error updating overlay ${overlayId}:`, error);
    console.error(`Stack trace: ${error.stack}`);
    throw error;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
  saveToken,
  getToken,
  createOverlay,
  getOverlay,
  updateOverlay
};