# PSN Trophy Tracker

A multi-user PlayStation Network trophy tracking application that automatically updates and displays user trophy information. The application allows users to create personalized browser source links for OBS streaming.

## Features

- Create custom overlays for any PSN ID without requiring user login
- Auto-updates with the latest trophy statistics
- Customizable progress bar and level indicator colors
- Support for custom profile pictures and animation GIFs
- Unique URLs for each overlay to use in OBS streaming
- Real-time trophy data retrieval from the PSN API

## How to Use

1. Visit the homepage to create a new overlay
2. Enter your PSN ID
3. Customize the progress bar and level indicator colors
4. Click "Create Overlay" to generate a unique URL
5. Add the URL as a browser source in OBS Studio

## API Endpoints

- `/api/status` - Check API and PSN connection status
- `/api/create-overlay` - Create a new overlay with a PSN ID
- `/api/profile-data` - Get profile data for an overlay
- `/api/psn-stats` - Get trophy statistics for an overlay
- `/api/trophy-titles` - Get trophy titles for a PSN user

## Testing

Run the test script to verify the application is working correctly:

```
node test-app.js
```

## Technical Details

The application uses:
- Node.js with a custom HTTP server
- PSN API integration with NPSSO authentication
- In-memory storage for overlay configurations
- HTML/CSS for the overlay display