// Simple server to test connectivity
const express = require('express');
const path = require('path');

const app = express();
const port = 5000;

// Serve static files from the "public" folder
app.use(express.static('public'));

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
});