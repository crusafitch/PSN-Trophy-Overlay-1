const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Create SQLite database connection
const dbPromise = open({
  filename: 'overlay.db',
  driver: sqlite3.Database
});

// Initialize database tables (if they don't exist)
async function initializeDatabase() {
  // Get database connection
  const db = await dbPromise;

  try {
    await db.exec('BEGIN');

    // Create overlays table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS overlays (
        id TEXT PRIMARY KEY,
        psn_id TEXT NOT NULL,
        progress_color TEXT DEFAULT '#2d7fea',
        level_color TEXT DEFAULT '#FFD700',
        profile_pic_path TEXT,
        trophy_gif_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.exec('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Functions to manage overlay data
async function createOverlay(overlayData) {
  const db = await dbPromise;
  const { id, psnId, progressColor, levelColor } = overlayData;

  try {
    // Create the new overlay
    const result = await db.run(
      'INSERT INTO overlays (id, psn_id, progress_color, level_color) VALUES (?, ?, ?, ?)',
      [id, psnId, progressColor, levelColor]
    );
    
    console.log(`Created overlay for PSN ID: ${psnId} with ID: ${id}`);
    return { id, psnId, progressColor, levelColor };
  } catch (error) {
    console.error('Error creating overlay:', error);
    throw error;
  }
}

async function getOverlay(overlayId) {
  const db = await dbPromise;
  try {
    const result = await db.get('SELECT * FROM overlays WHERE id = ?', [overlayId]);
    if (result) {
      return {
        id: result.id,
        psnId: result.psn_id,
        progressColor: result.progress_color,
        levelColor: result.level_color,
        profilePicPath: result.profile_pic_path,
        trophyGifPath: result.trophy_gif_path,
        createdAt: result.created_at
      };
    }
    return null;
  } catch (error) {
    console.error('Error retrieving overlay:', error);
    throw error;
  }
}

async function updateOverlay(overlayId, updateData) {
  const db = await dbPromise;
  try {
    const { profilePicPath, trophyGifPath } = updateData;
    const updates = [];
    const values = [];

    if (profilePicPath !== undefined) {
      updates.push('profile_pic_path = ?');
      values.push(profilePicPath);
    }

    if (trophyGifPath !== undefined) {
      updates.push('trophy_gif_path = ?');
      values.push(trophyGifPath);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(overlayId);

    const query = `
      UPDATE overlays 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `;

    await db.run(query, values);
    return getOverlay(overlayId);
  } catch (error) {
    console.error('Error updating overlay:', error);
    throw error;
  }
}

async function query(text, params) {
  const db = await dbPromise;
  return db.all(text, params);
}

module.exports = {
  initializeDatabase,
  createOverlay,
  getOverlay,
  updateOverlay,
  query
};