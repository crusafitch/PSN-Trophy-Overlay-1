#!/bin/bash

# Clean up
rm -rf psn_achievement_app

echo "Creating a directory for the project..."
mkdir -p public/uploads/profile_pics
mkdir -p public/uploads/trophy_gifs

# Copy the trophy icon images to the public folder if they don't exist
if [ ! -f "public/40-bronze.png" ]; then
  cp attached_assets/40-bronze.png public/
fi

if [ ! -f "public/40-silver.png" ]; then
  cp attached_assets/40-silver.png public/
fi

if [ ! -f "public/40-gold.png" ]; then
  cp attached_assets/40-gold.png public/
fi

if [ ! -f "public/40-platinum.png" ]; then
  cp attached_assets/40-platinum.png public/
fi

# Make sure the database is initialized
echo "Initializing database..."
node -e "require('./db').initializeDatabase().then(() => console.log('Database initialized')).catch(e => console.error('Database error:', e))"

echo "Setup complete!"