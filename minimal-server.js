// Minimal HTTP server with PSN API integration
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const psnApi = require('./psn-minimal-api');
const formidable = require('formidable');
const db = require('./db');

// Initialization for PSN API
const NPSSO = process.env.PSN_NPSSO;
let psnInitialized = false;

// In-memory cache for overlays
const overlaysCache = new Map();

// Initialize PSN API on server startup
async function initializePSN() {
    if (!NPSSO) {
        console.error('PSN_NPSSO environment variable not found');
        return false;
    }

    try {
        const result = await psnApi.initializePSNApi(NPSSO);
        if (result.success) {
            console.log('PSN API initialized successfully');
            psnInitialized = true;
            return true;
        } else {
            console.error('Failed to initialize PSN API:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Error during PSN API initialization:', error.message);
        return false;
    }
}

// Parse URL parameters
function parseQueryParams(reqUrl) {
    const parsedUrl = url.parse(reqUrl, true);
    return parsedUrl.query;
}

// Create the home page HTML
function getHomePageHtml(psnStatus) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>PSN Trophy Tracker Overlay. Project by Crusafitch</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Roboto', sans-serif;
                background-color: #0a0a0a;
                color: white;
                margin: 0;
                padding: 20px;
                background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4"><path fill="rgba(255,255,255,0.05)" d="M1 3h1v1H1V3zm2-2h1v1H3V1z"/></svg>');
            }
            .container {
                max-width: 800px;
                margin: 20px auto;
                background-color: #1a1a1a;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
                border: 1px solid #8B0000;
            }
            .header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #8B0000;
                padding-bottom: 15px;
            }
            .logo {
                width: 120px;
                height: auto;
                margin-right: 20px;
            }
            .title-container {
                flex: 1;
            }
            h1, h2 {
                color: #ff0000;
                font-family: 'Press Start 2P', cursive;
                margin: 0;
                text-shadow: 2px 2px 0px #000000;
            }
            h1 {
                font-size: 1.5rem;
                margin-bottom: 5px;
            }
            h2 {
                font-size: 1.2rem;
                margin: 20px 0 15px 0;
            }
            .subtitle {
                font-size: 0.9rem;
                opacity: 0.9;
                color: #ffffff;
            }
            p {
                margin: 10px 0;
                line-height: 1.5;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: #ffffff;
            }
            input, select {
                width: 100%;
                padding: 12px;
                border: 1px solid #8B0000;
                border-radius: 5px;
                background-color: #2a2a2a;
                color: white;
                box-sizing: border-box;
            }
            input[type="color"] {
                height: 40px;
                cursor: pointer;
            }
            input[type="file"] {
                background-color: #2a2a2a;
                color: #ffffff;
                padding: 10px;
                border: 1px solid #8B0000;
            }
            button {
                background-color: #8B0000;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.3s ease;
                font-family: 'Press Start 2P', cursive;
                font-size: 0.9rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 4px 0 #5c0000;
            }
            button:hover {
                background-color: #ff0000;
                transform: translateY(-2px);
                box-shadow: 0 6px 0 #5c0000;
            }
            button:active {
                transform: translateY(2px);
                box-shadow: 0 2px 0 #5c0000;
            }
            .status {
                padding: 15px;
                border-radius: 5px;
                background-color: #2a2a2a;
                margin: 20px 0;
                display: flex;
                align-items: center;
                border: 1px solid #8B0000;
            }
            .result {
                margin-top: 20px;
                padding: 20px;
                border-radius: 5px;
                background-color: #2a2a2a;
                display: none;
                border: 1px solid #8B0000;
                position: relative;
                overflow: hidden;
            }
            .result:before {
                content: '🏆';
                position: absolute;
                top: 10px;
                right: 10px;
                font-size: 24px;
                opacity: 0.2;
            }
            .api-status {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 10px;
            }
            .api-status.online {
                background-color: #00FF00;
                box-shadow: 0 0 10px #00FF00;
            }
            .api-status.offline {
                background-color: #FF0000;
                box-shadow: 0 0 10px #FF0000;
            }
            code {
                display: block;
                padding: 15px;
                background-color: #0a0a0a;
                border-radius: 5px;
                overflow-x: auto;
                margin-top: 15px;
                color: #00FF00;
                font-family: monospace;
                border: 1px solid #8B0000;
            }
            .hint {
                font-size: 0.85rem;
                color: #cccccc;
                margin-top: 5px;
            }
            .meme-container {
                margin: 20px 0;
                text-align: center;
            }
            .meme-image {
                max-width: 100%;
                border-radius: 5px;
                border: 2px solid #8B0000;
            }
            .pixel-border {
                border: 3px solid;
                border-image: linear-gradient(45deg, #8B0000, #ff0000, #ffffff, #ff0000, #8B0000) 1;
            }
            .glow-text {
                text-shadow: 0 0 5px #ff0000, 0 0 10px #ff0000;
                color: #ffffff;
            }

            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }

            .pulse {
                animation: pulse 2s infinite ease-in-out;
            }

            /* Retro scanline effect */
            .scanline {
                position: relative;
            }
            .scanline:before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    rgba(0, 0, 0, 0),
                    rgba(0, 0, 0, 0),
                    rgba(0, 0, 0, 0.3),
                    rgba(0, 0, 0, 0)
                );
                background-size: 100% 4px;
                z-index: 1;
                opacity: 0.3;
                pointer-events: none;
            }
        </style>
    </head>
    <body>
        <div class="container scanline">
            <div class="header">
                <img src="/images/cf-logo.png" alt="CF Gaming Logo" class="logo">
                <div class="title-container">
                    <h1>PSN TROPHY TRACKER</h1>
                    <div class="subtitle">Overlay Project by Crusafitch</div>
                </div>
            </div>

            <div class="status">
                <span class="api-status ${psnStatus ? 'online' : 'offline'}"></span>
                <span class="api-text"><strong>PSN API STATUS:</strong> ${psnStatus ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>

            <div class="meme-container">
                <img src="/images/its-happening-meme.jpg" alt="It's Happening Meme" class="meme-image pulse">
            </div>

            <div class="form-group">
                <h2>CREATE YOUR TROPHY OVERLAY</h2>
                <p>Enter your PSN ID to generate a unique browser source URL for OBS.</p>

                <div class="form-group">
                    <label for="psnId">PSN ID:</label>
                    <input type="text" id="psnId" placeholder="Your PlayStation Network ID">
                </div>

                <div class="form-group">
                    <label for="progressColor">Progress Bar Color:</label>
                    <input type="color" id="progressColor" value="#ff0000">
                </div>


                <div class="form-group">
                    <label for="profilePic">Custom Profile Picture (optional):</label>
                    <input type="file" id="profilePic" accept="image/*">
                    <p class="hint">Replace the default icon with your custom image</p>
                </div>

                <div class="form-group">
                    <label for="trophyGif">Custom Trophy Animation (optional):</label>
                    <input type="file" id="trophyGif" accept="image/gif" onchange="validateGifFile(this)">
                    <p class="hint">This GIF will play when you earn a new trophy (only GIF files allowed)</p>
                </div>

                <button id="createBtn" class="pulse">CREATE OVERLAY</button>
            </div>

            <div class="result pixel-border" id="result">
                <h2 class="glow-text">IT'S HAPPENING: OVERLAY CREATED!</h2>
                <p>Use this URL as a browser source in OBS Studio or Streamlabs</p>
                <code id="overlayUrl"></code>
                <p>Your overlay will automatically check for trophy updates every minute.</p>
            </div>
        </div>

        <script>
            // Validate that uploaded trophy files are GIF format
            function validateGifFile(fileInput) {
                const file = fileInput.files[0];
                if (!file) return; // No file selected

                // Check file extension
                const fileName = file.name.toLowerCase();
                const isGif = fileName.endsWith('.gif');

                // Check mimetype if available
                const isGifMimetype = file.type === 'image/gif';

                if (!isGif || !isGifMimetype) {
                    alert('Please select a GIF file for trophy animations. Other file types are not supported.');
                    fileInput.value = ''; // Clear the file input
                }
            }

            document.getElementById('createBtn').addEventListener('click', async function() {
                const psnId = document.getElementById('psnId').value;
                const progressColor = document.getElementById('progressColor').value;
                const profilePic = document.getElementById('profilePic').files[0];
                const trophyGif = document.getElementById('trophyGif').files[0];

                if (!psnId) {
                    alert('Please enter your PSN ID');
                    return;
                }

                try {
                    // Show loading state
                    const btn = document.getElementById('createBtn');
                    const originalText = btn.textContent;
                    btn.textContent = 'CREATING...';
                    btn.disabled = true;

                    // First create the overlay to get the ID
                    const response = await fetch(\`/api/create-overlay?psnId=\${encodeURIComponent(psnId)}&progressColor=\${encodeURIComponent(progressColor)}\`);
                    const data = await response.json();

                    if (data.success) {
                        const overlayId = data.overlayId;
                        document.getElementById('overlayUrl').textContent = window.location.origin + '/overlay/' + overlayId;
                        document.getElementById('result').style.display = 'block';

                        // Handle file uploads if selected
                        if (profilePic || trophyGif) {
                            const formData = new FormData();
                            formData.append('overlayId', overlayId);

                            if (profilePic) {
                                const profileFormData = new FormData();
                                profileFormData.append('overlayId', overlayId);
                                profileFormData.append('fileType', 'profile');
                                profileFormData.append('file', profilePic);

                                await fetch('/api/upload', {
                                    method: 'POST',
                                    body: profileFormData
                                });
                            }

                            if (trophyGif) {
                                const trophyFormData = new FormData();
                                trophyFormData.append('overlayId', overlayId);
                                trophyFormData.append('fileType', 'trophy');
                                trophyFormData.append('file', trophyGif);

                                await fetch('/api/upload', {
                                    method: 'POST',
                                    body: trophyFormData
                                });
                            }
                        }

                        // Scroll to result
                        document.getElementById('result').scrollIntoView({
                            behavior: 'smooth'
                        });
                    } else {
                        alert('Error: ' + data.error);
                    }

                    // Restore button
                    btn.textContent = originalText;
                    btn.disabled = false;
                } catch (error) {
                    alert('Error creating overlay: ' + error.message);
                    document.getElementById('createBtn').textContent = originalText;
                    document.getElementById('createBtn').disabled = false;
                }
            });
        </script>
    </body>
    </html>
    `;
}

// Create overlay HTML
function getOverlayHtml(overlayData) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <meta charset="UTF-8" />
  <title>PSN Combined Overlay</title>
  <style>
    :root {
      --progress-color: ${overlayData.progressColor || '#ffdd00'};
    }
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: Arial, sans-serif;
      color: #fff;
      font-size: 16px;
    }
    .bottom-bar {
      width: 1920px;
      height: 40px;
      background: linear-gradient(45deg, rgba(20, 20, 20, 0.85), rgba(40, 40, 40, 0.75), rgba(20, 20, 20, 0.85));
      background-size: 400% 400%;
      animation: gradientBG 8s ease infinite;
      display: flex;
      align-items: center;
      padding: 0 50px;
      box-sizing: border-box;
      position: fixed;
      bottom: 0;
      left: 0;
    }
    /* LEFT GROUP: Game Info */
    .left-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .psn-icon, .game-icon {
      width: 30px;
      height: 30px;
      background-size: cover;
      background-position: center;
    }
    /* Title container: holds game title and platform */
    .title-container {
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .game-title {
      font-size: 16px;
      font-weight: bold;
    }
    .platform {
      font-size: 16px;
      color: #ccc;
    }
    /* Progress group: holds raw count and mini progress bar */
    .progress-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
    }
    /* Raw trophy count text (e.g., (40/73)) */
    #raw-count {
      font-size: 16px;
      font-weight: bold;
    }
    /* Weighted completion label (e.g., 40.00%) */
    #weighted-completion {
      font-size: 16px;
      font-weight: bold;
      color: #fff;
    }
    /* XP bar styling */
    .mini-progress-container {
      width: 120px;
      height: 12px;
      border: 2px solid #4a4a4a;
      border-radius: 6px;
      background: #1a1a1a;
      box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
      padding: 2px;
    }
    .mini-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--progress-color), var(--progress-color));
      width: 0%;
      border-radius: 3px;
      transition: width 0.5s ease;
      box-shadow: 0 0 5px var(--progress-color);
      position: relative;
      overflow: visible;
    }
    .mini-progress-fill::before {
      content: '';
      position: absolute;
      right: -2px;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 15px;
      background: var(--progress-color);
      border-radius: 3px;
      box-shadow: 
        0 0 5px var(--progress-color),
        0 0 10px var(--progress-color),
        0 0 15px var(--progress-color);
      animation: glow 1s ease-in-out infinite alternate;
    }
    @keyframes glow {
      from {
        opacity: 0.7;
        box-shadow: 
          0 0 5px var(--progress-color)33,
          0 0 10px #ff3333,
          0 0 15px #ff3333;
      }
      to {
        opacity: 1;
        box-shadow: 
          0 0 10px #ff3333,
          0 0 20px #ff3333,
          0 0 30px #ff3333;
      }
    }
    .mini-progress-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 30%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: shimmer 2s ease-in-out infinite;
      border-radius: 3px;
    }
    @keyframes shimmer {
      0% { transform: translateX(0%); }
      100% { transform: translateX(300%); }
    }
    /* GIF for new trophy earned */
    #bar-gif {
      display: none;
      width: 200px;
      height: 200px;
      object-fit: contain;
      position: fixed;
      bottom: 40px;
      left: 20px;
      z-index: 1000;
    }

    /* Particle effects */
    .particle {
      position: absolute;
      width: 12px;
      height: 12px;
      background: ${overlayData.progressColor || '#2d7fea'};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 0 15px ${overlayData.progressColor || '#2d7fea'};
      opacity: 0.9;
    }

    /* +XP Animation */
    /* In-line XP Animation */
    .xp-popup {
      display: none;
      margin-left: 10px;
      background: linear-gradient(to right, #ffdd00, #ffa800);
      color: #000;
      padding: 2px 10px;
      border-radius: 15px;
      font-weight: bold;
      font-family: 'Press Start 2P', monospace;
      font-size: 12px;
      box-shadow: 0 0 10px rgba(255, 215, 0, 0.7);
      animation: bounceIn 0.5s ease-out, fadeOut 2s ease-in 1s forwards;
    }

    @keyframes bounceIn {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.2); opacity: 0.7; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes fadeOut {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }

    @keyframes xpTextAnim {
      0% { transform: translateX(0) scale(0.8); opacity: 0; }
      20% { transform: translateX(5px) scale(1.2); opacity: 1; }
      50% { transform: translateX(5px) scale(1); opacity: 1; }
      100% { transform: translateX(10px) scale(0.8); opacity: 0; }
    }

    @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }


    /* RIGHT GROUP: Trophy Counts, Username, Thanos Icon */
    .right-group {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      margin-right: 50px;
      flex-shrink: 0;
    }
    .trophy-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .trophy-box {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 16px;
    }
    .trophy-box img {
      width: 24px;
      height: 24px;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }

    .trophy-count {
      font-weight: bold;
      text-align: right;
      min-width: 26px;
      display: inline-block;
      text-shadow: 0 0 5px rgba(255,255,255,0.3);
    }

    .trophy-count.pulse {
      animation: pulse 0.5s ease-in-out;
    }
    .username {
      font-size: 16px;
      font-weight: bold;
    }
    .thanos-icon {
      width: 30px;
      height: 30px;
      margin-left: 8px;
      object-fit: cover;
    }
    .level-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 85px;
      padding: 4px 8px;
      background: linear-gradient(45deg, #2a2a2a, #4a4a4a);
      border: 2px solid ${overlayData.progressColor || '#8B0000'};
      border-radius: 12px;
      box-shadow: 0 0 10px rgba(139, 0, 0, 0.3);
      font-family: 'Press Start 2P', monospace;
      font-size: 14px;
    }
    .level-badge span {
      color: #ffffff; /* Always white */
      text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
    }

    /* Test Button Styles */
    .test-button {
      position: fixed;
      top: 10px;
      left: 10px;
      padding: 8px 16px;
      background: #8B0000;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    }

    .test-button:hover {
      background: #ff3333;
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="bottom-bar">
    <!-- LEFT GROUP: Game Info -->
    <div class="left-group">
      <div class="game-icon" id="game-icon"></div>
      <!-- Title container: game title and platform -->
      <div class="title-container">
        <span class="game-title" id="game-title">Loading...</span>
        <span class="platform" id="platform"></span>
      </div>
      <!-- GIF for new trophy earned, only if provided -->
      ${overlayData.trophyGifPath ? `<img id="bar-gif" src="${overlayData.trophyGifPath}" alt="Trophy Animation" />` : ''}
      <!-- Progress group: raw trophy count and mini progress bar -->
      <div class="progress-group">
        <span id="raw-count">(0/0)</span>
        <span id="weighted-completion">0.00%</span>
        <div class="mini-progress-container">
          <div class="mini-progress-fill" id="mini-progress-fill"></div>
        </div>
        <span id="xp-popup" class="xp-popup">+XP!</span>
      </div>
    </div>

    <!-- RIGHT GROUP: Trophy Counts, Username, and Thanos Icon -->
    <div class="right-group">
      <div class="trophy-group">
        <div class="trophy-box">
          <div class="level-badge">LV.<span id="level-number">0</span></div>
          <img src="/40-platinum.png" alt="Platinum Icon" />
          <span id="platinum-count" class="trophy-count">0</span>
        </div>
        <div class="trophy-box">
          <img src="/40-gold.png" alt="Gold Icon" />
          <span id="gold-count" class="trophy-count">0</span>
        </div>
        <div class="trophy-box">
          <img src="/40-silver.png" alt="Silver Icon" />
          <span id="silver-count" class="trophy-count">0</span>
        </div>
        <div class="trophy-box">
          <img src="/40-bronze.png" alt="Bronze Icon" />
          <span id="bronze-count" class="trophy-count">0</span>
        </div>
      </div>
      <div class="username" id="psn-username">${overlayData.psnId}</div>
      ${overlayData.profilePicPath ? `<img class="thanos-icon" src="${overlayData.profilePicPath}" alt="Profile Icon">` : ''}
    </div>
  </div>

  <!-- Test Button -->
  <button id="test-achievement" class="test-button">Test Achievement</button>

  <script>
    // Store these values in localStorage so they persist across refreshes
    let previousGameEarned = parseInt(localStorage.getItem('previousGameEarned')) || 0;
    let previousLevel = parseInt(localStorage.getItem('previousLevel')) || 0;
    let lastCompletion = localStorage.getItem('lastCompletion');
    let previousGameTitle = localStorage.getItem('previousGameTitle') || '';
    const overlayId = '${overlayData.id}';

    async function fetchGameData() {
      try {
        const response = await fetch(\`/api/psn-title?overlayId=\${overlayId}&ts=\${new Date().getTime()}\`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error('Network response not OK');
        }

        const data = await response.json();
        console.log("Fetched game data:", data);

        // Set icons
        // We don't override psn-icon here as it's already set with the user's custom profile picture
        if (data.titleIconUrl) {
          document.getElementById('game-icon').style.backgroundImage = \`url(\${data.titleIconUrl})\`;
        }

        // Update game title and platform info
        document.getElementById('game-title').textContent = data.titleName || "Game";
        document.getElementById('platform').textContent = data.trophyTitlePlatform || "";

        // Update raw trophy count (e.g., (40/73))
        document.getElementById('raw-count').textContent = \`(\${data.earnedTrophies}/\${data.definedTrophies})\`;

        // Update weighted completion and progress bar
        // data.completion is a string like "40.00%
        document.getElementById('weighted-completion').textContent = data.completion;
        document.getElementById('mini-progress-fill').style.width = data.completion;

        // Trigger animations if new trophies were earned or game changed
        console.log("Trophy check - Previous:", previousGameEarned, "Current:", data.earnedTrophies);
        console.log("Game check - Previous:", previousGameTitle, "Current:", data.titleName);

        // Initialize on first load or trigger on trophy increase/game change
        if (previousGameEarned === null) {
          previousGameEarned = data.earnedTrophies;
          localStorage.setItem('previousGameTitle', data.titleName);
        } else if (data.earnedTrophies > previousGameEarned || 
                  (data.titleName !== previousGameTitle && data.earnedTrophies > 0)) {
          console.log("Trophy earned or new game trophy! Triggering animations");
          localStorage.setItem('previousGameEarned', data.earnedTrophies);
          localStorage.setItem('previousGameTitle', data.titleName);
          const progressBar = document.querySelector('.mini-progress-fill');
          const rect = progressBar.getBoundingClientRect();
          showAchievementAnimations(rect);
        }

        previousGameEarned = data.earnedTrophies;
      } catch (error) {
        console.error("Error fetching game data:", error);
      }
    }

    function showCompletionOrLevelUp(completion) {
      const xpPopup = document.getElementById('xp-popup');
      if (xpPopup) {
        xpPopup.textContent = completion === "100.00%" ? "Level Up!" : "+XP!";
        xpPopup.style.display = 'inline-block';

        // Reset animation
        xpPopup.style.animation = 'none';
        void xpPopup.offsetWidth; // Trigger reflow
        xpPopup.style.animation = 'bounceIn 0.5s ease-out, fadeOut 2s ease-in 1s forwards';

        setTimeout(() => {
          xpPopup.style.display = 'none';
        }, 2000);
      }
    }

    function createParticle(x, y) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = \`\${x}px\`;
      particle.style.top = \`\${y}px\`;
      document.body.appendChild(particle);

      const progressBar = document.querySelector('.mini-progress-fill');
      const progressRect = progressBar.getBoundingClientRect();
      const duration = 800;
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadRadius = 60;
      const startTime = performance.now();

      function animate() {
        const progress = (performance.now() - startTime) / duration;
        if (progress >= 1) {
          particle.remove();
          return;
        }

        // Update progress bar endpoint position
        const currentProgressRect = progressBar.getBoundingClientRect();
        const targetX = currentProgressRect.right;
        const targetY = currentProgressRect.top + (currentProgressRect.height / 2);

        // Particle spreads out then gets sucked in
        const spreadPhase = Math.min(progress * 2, 1);
        const suckPhase = Math.max((progress - 0.5) * 2, 0);

        const spreadX = Math.cos(spreadAngle) * spreadRadius * (1 - suckPhase);
        const spreadY = Math.sin(spreadAngle) * spreadRadius * (1 - suckPhase);

        const currentX = x + spreadX + (targetX - x - spreadX) * suckPhase;
        const currentY = y + spreadY + (targetY - y - spreadY) * suckPhase;

        particle.style.left = \`\${currentX}px\`;
        particle.style.top = \`\${currentY}px\`;
        particle.style.opacity = 1 - (progress * 0.5);
        particle.style.transform = \`scale(\${1 - progress * 0.5})\`;

        requestAnimationFrame(animate);
      }

      animate();
    }

    async function fetchOverallTrophies() {
      try {
        const response = await fetch(\`/api/psn-stats?overlayId=\${overlayId}\`);
        if (!response.ok) throw new Error("Network response not OK");
        const data = await response.json();
        console.log("Fetched overall trophy data:", data);
        const earned = data.earnedTrophies || {};
        document.getElementById("platinum-count").textContent = earned.platinum || 0;
        document.getElementById("gold-count").textContent = earned.gold || 0;
        document.getElementById("silver-count").textContent = earned.silver || 0;
        document.getElementById("bronze-count").textContent = earned.bronze || 0;
        document.getElementById("level-number").textContent = data.trophyLevel || 0;

        // Check if level went up
        if (previousLevel !== null && data.trophyLevel > previousLevel) {
          console.log("Level up detected!");
          // Show level up animation using xp-popup
          const xpPopup = document.getElementById('xp-popup');
          if (xpPopup) {
            xpPopup.textContent = "Level Up!";
            xpPopup.style.display = 'inline-block';

            // Reset animation
            xpPopup.style.animation = 'none';
            void xpPopup.offsetWidth; // Trigger reflow
            xpPopup.style.animation = 'bounceIn 0.5s ease-out, fadeOut 2s ease-in 1s forwards';

            setTimeout(() => {
              xpPopup.style.display = 'none';
            }, 3000);
          }
        }
        previousLevel = data.trophyLevel;
        localStorage.setItem('previousLevel', previousLevel);

        // Update username if needed
        if (data.onlineId) {
          document.getElementById("psn-username").textContent = data.onlineId;
        }
      } catch (error) {
        console.error("Error fetching overall trophy data:", error);
      }
    }

    let animationInProgress = false;

    function showAchievementAnimations(rect) {
      if (animationInProgress) return;
      animationInProgress = true;

      console.log("Showing achievement animations");

      // Show trophy GIF if it exists (only if user uploaded one)
      const gif = document.getElementById('bar-gif');
      if (gif) {
        gif.style.display = 'inline-block';
      }

      // Show in-line XP popup
      const xpPopup = document.getElementById('xp-popup');
      if (xpPopup) {
        xpPopup.style.display = 'inline-block';

        // Reset animation by removing and adding the class
        xpPopup.style.animation = 'none';
        void xpPopup.offsetWidth; // Trigger reflow
        xpPopup.style.animation = 'bounceIn 0.5s ease-out, fadeOut 2s ease-in 1s forwards';
      }

      // Create particles
      for (let i = 0; i < 10; i++) {
        createParticle(rect.right, rect.top + rect.height / 2);
      }

      setTimeout(() => {
        // Hide gif if it exists
        if (gif) {
          gif.style.display = 'none';
        }
        // Always hide the XP popup
        if (xpPopup) {
          xpPopup.style.display = 'none';
        }
        animationInProgress = false;
      }, 3000);
    }

    // Event listener for the test button
    document.getElementById('test-achievement').addEventListener('click', function() {
      const progressBar = document.querySelector('.mini-progress-fill');
      const rect = progressBar.getBoundingClientRect();
      showAchievementAnimations(rect);
      // The xp-popup is already handled inside showAchievementAnimations
    });

    // Initial data fetch
    fetchGameData();
    fetchOverallTrophies();

    // Periodic refresh (every 60 seconds)
    setInterval(fetchGameData, 60000);
    setInterval(fetchOverallTrophies, 60000);
  </script>
</body>
</html>
    `;
}

// Handle API routes
async function handleApiRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const endpoint = parsedUrl.pathname;
    const params = parsedUrl.query;

    // API status endpoint
    if (endpoint === '/api/status') {
        const response = {
            status: 'OK',
            service: 'PSN Trophy Tracker',
            psnApiConnected: psnInitialized,
            serverTime: new Date().toISOString()
        };

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(response));
        return;
    }

    // Create overlay endpoint
    if (endpoint === '/api/create-overlay') {
        res.setHeader('Content-Type', 'application/json');
        
        if (!params.psnId) {
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID is required'
            }));
            return;
        }

        // Generate unique ID for the overlay
        const overlayId = uuidv4();

        // Store overlay configuration in database
        try {
            const overlayData = {
                id: overlayId,
                psnId: params.psnId,
                progressColor: params.progressColor || '#2d7fea', // Blue progress color (default)
                // levelColor removed as it's now always white (#ffffff)
            };

            // Store in database
            await db.createOverlay(overlayData);

            // Also cache in memory for faster access
            overlaysCache.set(overlayId, overlayData);

            console.log(`Created overlay ${overlayId} for PSN ID: ${params.psnId}`);

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                overlayId: overlayId
            }));
        } catch (error) {
            console.error(`Error creating overlay: ${error.message}`);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: 'Failed to create overlay'
            }));
        }
        return;
    }

    // Profile data endpoint
    if (endpoint === '/api/profile-data') {
        if (!params.overlayId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'Overlay ID is required'
            }));
            return;
        }

        // Get overlay configuration (first try cache, then database)
        let overlay = overlaysCache.get(params.overlayId);

        if (!overlay) {
            try {
                // If not in cache, try to get from database
                overlay = await db.getOverlay(params.overlayId);

                if (overlay) {
                    // Store in cache for future use
                    overlaysCache.set(params.overlayId, overlay);
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.writeHead(404);
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Overlay not found'
                    }));
                    return;
                }
            } catch (error) {
                console.error(`Error retrieving overlay ${params.overlayId}:`, error);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Failed to retrieve overlay'
                }));
                return;
            }
        }

        // Try to get profile data
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        try {
            const profileResult = await psnApi.getCompleteProfileData(overlay.psnId);
            if (!profileResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: profileResult.error
                }));
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                profile: profileResult.profile,
                latestTrophy: profileResult.latestTrophy || 'No recent trophies'
            }));
            return;
        } catch (error) {
            console.error('Error fetching profile data:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // PSN Stats endpoint for overall trophy information
    if (endpoint === '/api/psn-stats') {
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        // Get PSN ID from query or use default
        let psnId = params.psnId;

        // If no direct psnId but we have an overlayId, try to get it from the overlay
        if (!psnId && params.overlayId) {
            // First check cache
            let overlay = overlaysCache.get(params.overlayId);

            // If not in cache, try database
            if (!overlay) {
                try {
                    overlay = await db.getOverlay(params.overlayId);
                    if (overlay) {
                        // Add to cache for future use
                        overlaysCache.set(params.overlayId, overlay);
                    }
                } catch (error) {
                    console.error(`Error retrieving overlay for PSN ID lookup: ${error.message}`);
                }
            }

            // If we found the overlay, use its psnId
            if (overlay) {
                psnId = overlay.psnId;
            }
        }

        if (!psnId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID or overlay ID is required'
            }));
            return;
        }

        try {
            const profileResult = await psnApi.getCompleteProfileData(psnId);
            if (!profileResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: profileResult.error
                }));
                return;
            }

            const { profile } = profileResult;

            // Return trophy stats in the format expected by the original overlay
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                earnedTrophies: profile.trophySummary?.earnedTrophies || {
                    platinum: 0,
                    gold: 0,
                    silver: 0,
                    bronze: 0
                },
                // Use the correct trophyLevel property from the API response
                trophyLevel: profile.trophySummary?.trophyLevel || 0,
                progress: profile.trophySummary?.progress || 0,
                onlineId: profile.onlineId || psnId,
                avatarUrl: profile.avatarUrl || null
            }));
            return;
        } catch (error) {
            console.error('Error fetching PSN stats:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // Trophy titles endpoint for a PSN user
    if (endpoint === '/api/trophy-titles') {
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        // Get PSN ID from query params
        const psnId = params.psnId;

        if (!psnId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID is required'
            }));
            return;
        }

        try {
            // Get user trophy titles
            const titlesResult = await psnApi.getUserTrophyTitles(psnId);
            if (!titlesResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: titlesResult.error
                }));
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(titlesResult));
            return;
        } catch (error) {
            console.error('Error fetching trophy titles:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // Trophy summary endpoint for a PSN user
    if (endpoint === '/api/trophy-summary') {
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        // Get PSN ID from query params
        const psnId = params.psnId;

        if (!psnId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID is required'
            }));
            return;
        }

        try {
            // Get user trophy summary
            const summaryResult = await psnApi.getTrophySummary(psnId);
            if (!summaryResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: summaryResult.error
                }));
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(summaryResult));
            return;
        } catch (error) {
            console.error('Error fetching trophy summary:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // PSN Profile endpoint for direct profile retrieval
    if (endpoint === '/api/profile') {
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        // Get PSN ID from query params
        const psnId = params.psnId;

        if (!psnId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID is required'
            }));
            return;
        }

        try {
            // Get user profile 
            const profileResult = await psnApi.getUserProfile(psnId);
            if (!profileResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: profileResult.error
                }));
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(profileResult));
            return;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // PSN Title endpoint for current game information
    if (endpoint === '/api/psn-title') {
        if (!psnInitialized) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(503);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN API is not initialized'
            }));
            return;
        }

        // Get PSN ID from query or use default
        let psnId = params.psnId;

        // If no direct psnId but we have an overlayId, try to get it from the overlay
        if (!psnId && params.overlayId) {
            // First check cache
            let overlay = overlaysCache.get(params.overlayId);

            // If not in cache, try database
            if (!overlay) {
                try {
                    overlay = await db.getOverlay(params.overlayId);
                    if (overlay) {
                        // Add to cache for future use
                        overlaysCache.set(params.overlayId, overlay);
                    }
                } catch (error) {
                    console.error(`Error retrieving overlay for PSN ID lookup: ${error.message}`);
                }
            }

            // If we found the overlay, use its psnId
            if (overlay) {
                psnId = overlay.psnId;
            }
        }

        if (!psnId) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'PSN ID or overlay ID is required'
            }));
            return;
        }

        try {
            const profileResult = await psnApi.getCompleteProfileData(psnId);
            if (!profileResult.success) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: profileResult.error
                }));
                return;
            }

            const { profile, titles } = profileResult;

            // Get the most recently played title (first in the list)
            const latestTitle = titles && titles.length > 0 ? titles[0] : null;

            if (!latestTitle) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    titleName: "No recent game",
                    trophyTitlePlatform: "",
                    earnedTrophies: 0,
                    definedTrophies: 0,
                    completion: "0.00%",
                    titleIconUrl: null
                }));
                return;
            }

            // Extract and calculate values in the format expected by the original overlay
            const earnedCount = latestTitle.earnedTrophies?.bronze + 
                               latestTitle.earnedTrophies?.silver + 
                               latestTitle.earnedTrophies?.gold + 
                               latestTitle.earnedTrophies?.platinum || 0;

            const totalCount = latestTitle.definedTrophies?.bronze + 
                              latestTitle.definedTrophies?.silver + 
                              latestTitle.definedTrophies?.gold + 
                              latestTitle.definedTrophies?.platinum || 0;

            // Calculate completion percentage with correct trophy points
            const bronzePoints = 15;
            const silverPoints = 30;
            const goldPoints = 90;
            // Platinum not included in calculation

            const earnedPoints = 
                (latestTitle.earnedTrophies?.gold || 0) * goldPoints +
                (latestTitle.earnedTrophies?.silver || 0) * silverPoints +
                (latestTitle.earnedTrophies?.bronze || 0) * bronzePoints;

            const totalPoints = 
                (latestTitle.definedTrophies?.gold || 0) * goldPoints +
                (latestTitle.definedTrophies?.silver || 0) * silverPoints +
                (latestTitle.definedTrophies?.bronze || 0) * bronzePoints;

            const completionPercentage = totalPoints > 0 
                ? ((earnedPoints / totalPoints) * 100).toFixed(2) + '%'
                : '0.00%';

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                titleName: latestTitle.trophyTitleName || "Unknown Game",
                trophyTitlePlatform: latestTitle.trophyTitlePlatform || "",
                earnedTrophies: earnedCount,
                definedTrophies: totalCount,
                completion: completionPercentage,
                titleIconUrl: latestTitle.trophyTitleIconUrl || null
            }));
            return;
        } catch (error) {
            console.error('Error fetching PSN title data:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
            return;
        }
    }

    // Default JSON error for unknown API endpoints
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({
        success: false,
        error: 'API endpoint not found'
    }));
}

// Create the server
const server = http.createServer(async (req, res) => {
    console.log(`Request received: ${req.method} ${req.url} from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);

    // Add CORS headers to allow connections from anywhere
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve static files (images, GIFs, etc.)
    if (pathname.endsWith('.png') || pathname.endsWith('.gif') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        console.log(`Attempting to serve static file: ${pathname}`);

        let filePath;

        // Check if file is in uploads directory
        if (pathname.startsWith('/uploads/')) {
            filePath = path.join(__dirname, pathname);
            console.log(`Looking for upload in: ${filePath}`);
        } else {
            // Get the file path from public directory
            filePath = path.join(__dirname, 'public', pathname);
            console.log(`Looking for file in public: ${filePath}`);
        }

        try {
            const fileData = fs.readFileSync(filePath);
            console.log(`Successfully read file: ${pathname}`);

            // Set appropriate content type based on file extension
            let contentType = 'application/octet-stream';
            if (pathname.endsWith('.png')) contentType = 'image/png';
            else if (pathname.endsWith('.gif')) contentType = 'image/gif';
            else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) contentType = 'image/jpeg';

            res.setHeader('Content-Type', contentType);
            res.writeHead(200);
            res.end(fileData);
        } catch (error) {
            console.error(`Error serving file ${pathname}:`, error.message);

            // Try alternative file name formats (e.g., 40-platinum.png vs trophy-platinum.png)
            if (pathname.startsWith('/trophy-')) {
                const altPath = path.join(__dirname, 'public', pathname.replace('trophy-', '40-'));
                try {
                    const altFileData = fs.readFileSync(altPath);
                    res.setHeader('Content-Type', pathname.endsWith('.png') ? 'image/png' : 'image/gif');
                    res.writeHead(200);
                    res.end(altFileData);
                    return;
                } catch (altError) {
                    console.error(`Alternative file ${altPath} also not found:`, altError.message);
                }
            }

            res.writeHead(404);
            res.end('File not found');
        }
        return;
    }

    // Create a simple PSN icon if it doesn't exist
    if (pathname === '/psn-icon.png') {
        try {
            // First try to load it from the public folder
            const iconPath = path.join(__dirname, 'public', 'psn-icon.png');
            const iconData = fs.readFileSync(iconPath);
            res.setHeader('Content-Type', 'image/png');
            res.writeHead(200);
            res.end(iconData);
        } catch (error) {
            // If not found, check if we can use an alternative
            try {
                const altPath = path.join(__dirname, 'public', 'generated-icon.png');
                const altData = fs.readFileSync(altPath);
                res.setHeader('Content-Type', 'image/png');
                res.writeHead(200);
                res.end(altData);
            } catch (altError) {
                console.error('PSN icon not found and no alternative available');
                res.writeHead(404);
                res.end('Icon not found');
            }
        }
        return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
        // Handle file uploads
        if ((pathname === '/api/upload-media' || pathname === '/api/upload') && req.method === 'POST') {
            await handleFileUpload(req, res);
            return;
        }

        await handleApiRequest(req, res);
        return;
    }

    // Overlay route
    if (pathname.startsWith('/overlay/')) {
        const overlayId = pathname.split('/')[2];
        if (!overlayId) {
            res.writeHead(404);
            res.end('Overlay ID not provided');
            return;
        }

        // First look in memory cache
        let overlay = overlaysCache.get(overlayId);

        // If not in cache, try to get from database
        if (!overlay) {
            try {
                overlay = await db.getOverlay(overlayId);

                if (overlay) {
                    // Store in cache for future requests
                    overlaysCache.set(overlayId, overlay);
                } else {
                    res.writeHead(404);
                    res.end('Overlay not found');
                    return;
                }
            } catch (error) {
                console.error(`Error retrieving overlay ${overlayId}:`, error);
                res.writeHead(500);
                res.end('Error retrieving overlay');
                return;
            }
        }

        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(getOverlayHtml(overlay));
        return;
    }

    // Home page
    if (pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(getHomePageHtml(psnInitialized));
        return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end('Not found');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server started at ${new Date().toISOString()}`);
    console.log(`Listening on all interfaces (0.0.0.0:${PORT})`);
    console.log(`Access the application at: http://localhost:${PORT}/`);

    // Initialize database
    try {
        console.log('Initializing database...');
        await db.initializeDatabase();
        console.log('Database initialized successfully');

        // Check for existing overlays in the database
        try {
            const result = await db.query('SELECT COUNT(*) FROM overlays');
            const count = parseInt(result.rows[0].count);
            console.log(`Found ${count} existing overlays in the database`);

            if (count > 0) {
                // Get a sample of overlays to verify data structure
                const sampleResult = await db.query('SELECT id, psn_id FROM overlays LIMIT 5');
                console.log('Sample overlays:', sampleResult.rows);

                // Load existing overlays into memory cache
                const allOverlays = await db.query('SELECT * FROM overlays');
                console.log(`Found ${allOverlays.rows.length} overlays in database`);

                allOverlays.rows.forEach(row => {
                    // Transform database column names to camelCase for consistency with our code
                    const overlay = {
                        id: row.id,
                        psnId: row.psn_id,
                        progressColor: row.progress_color,
                        levelColor: row.level_color, 
                        profilePicPath: row.profile_pic_path,
                        trophyGifPath: row.trophy_gif_path,
                        createdAt: row.created_at
                    };

                    // Log each overlay's details
                    console.log(`Loading overlay ${row.id} with PSN ID: ${row.psn_id}`);

                    if (row.profile_pic_path) {
                        console.log(`  Profile picture path: ${row.profile_pic_path}`);
                    } else {
                        console.log('  No profile picture set');
                    }

                    if (row.trophy_gif_path) {
                        console.log(`  Trophy GIF path: ${row.trophy_gif_path}`);
                    } else {
                        console.log('  No trophy GIF set');
                    }

                    overlaysCache.set(row.id, overlay);
                });

                console.log(`Successfully loaded ${allOverlays.rows.length} overlays into memory cache`);
            }
        } catch (error) {
            console.error('Error checking existing overlays:', error);
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }

    // Initialize PSN API
    console.log('Initializing PSN API with NPSSO code');
    const psnStatus = await initializePSN();
    console.log(`PSN API Status: ${psnStatus ? 'Connected' : 'Disconnected'}`);
});
// Handle file uploads
async function handleFileUpload(req, res) {
    console.log('File upload request received');
    const form = new formidable.IncomingForm({
        uploadDir: path.join(__dirname, 'uploads'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024 // 5MB limit
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing form data:', err);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: 'Error processing upload'
            }));
            return;
        }

        console.log('Parsed form data:', { 
            fields: Object.keys(fields), 
            fieldValues: fields,
            files: Object.keys(files),
            fileDetails: Object.keys(files).map(key => ({
                key,
                type: files[key] ? (files[key].mimetype || 'unknown') : 'none'
            }))
        });

        // Check for overlay ID
        const overlayId = Array.isArray(fields.overlayId) ? fields.overlayId[0] : fields.overlayId;
        console.log('Overlay ID from form:', overlayId);

        if (!overlayId) {
            console.error('No overlay ID provided in upload');
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                error: 'Overlay ID is required'
            }));
            return;
        }

        // Retrieve overlay data (first from cache, then from database)
        let overlay = overlaysCache.get(overlayId);

        // If not in cache, try to get from database
        if (!overlay) {
            try {
                overlay = await db.getOverlay(overlayId);
                if (overlay) {
                    // Add to cache for future use
                    overlaysCache.set(overlayId, overlay);
                }
            } catch (error) {
                console.error(`Error retrieving overlay from database: ${error.message}`);
            }
        }

        console.log('Overlay found:', !!overlay, 'Overlay ID:', overlayId);

        if (!overlay) {
            console.error(`Overlay ${overlayId} not found in storage or database`);
            console.log('Available overlays in cache:', Array.from(overlaysCache.keys()));
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(404);
            res.end(JSON.stringify({
                success: false,
                error: 'Overlay not found'
            }));
            return;
        }

        // Process profile picture if uploaded
        // Check for both 'profilePic' and 'file' with fileType='profile'
        const fileTypeValue = fields.fileType && Array.isArray(fields.fileType) ? fields.fileType[0] : fields.fileType;
        console.log('File type value:', fileTypeValue);

        if (files.profilePic || (files.file && fileTypeValue === 'profile')) {
            const profilePicFile = files.profilePic || files.file;
            console.log('Profile pic file details:', JSON.stringify(profilePicFile, null, 2));

            // Handle the file as either an object or array
            const fileObj = Array.isArray(profilePicFile) ? profilePicFile[0] : profilePicFile;
            console.log('File object keys:', Object.keys(fileObj || {}));
            console.log('File object filepath exists:', fileObj && !!fileObj.filepath);
            console.log('File object path exists:', fileObj && !!fileObj.path);

            // Check for both filepath (newer formidable) and path (older formidable)
            if (fileObj && (fileObj.filepath || fileObj.path)) {
                const profilePicPath = fileObj.filepath || fileObj.path;

                // Get the file extension safely
                let fileExt = '.png';  // Default extension
                if (fileObj.originalFilename) {
                    fileExt = path.extname(fileObj.originalFilename) || '.png';
                } else if (fileObj.mimetype) {
                    // Try to determine from mimetype
                    const mimeMap = {
                        'image/jpeg': '.jpg',
                        'image/png': '.png',
                        'image/gif': '.gif'
                    };
                    fileExt = mimeMap[fileObj.mimetype] || '.png';
                }

                const newPath = path.join(__dirname, 'uploads', 'profiles', `${overlayId}${fileExt}`);

                try {
                    // Ensure directory exists
                    if (!fs.existsSync(path.join(__dirname, 'uploads', 'profiles'))) {
                        fs.mkdirSync(path.join(__dirname, 'uploads', 'profiles'), { recursive: true });
                    }

                    fs.renameSync(profilePicPath, newPath);
                    const updatedPath = `/uploads/profiles/${overlayId}${fileExt}`;
                    overlay.profilePicPath = updatedPath;
                    console.log(`Saved profile picture for overlay ${overlayId} at path: ${updatedPath}`);
                } catch (error) {
                    console.error('Error saving profile picture:', error);
                }
            } else {
                console.error('Invalid profile picture file object');
            }
        }

        // Process trophy GIF if uploaded
        // Check for both 'trophyGif' and 'file' with fileType='trophy'
        if (files.trophyGif || (files.file && fileTypeValue === 'trophy')) {
            const trophyGifFile = files.trophyGif || files.file;
            console.log('Trophy GIF file details:', JSON.stringify(trophyGifFile, null, 2));

            // Handle the file as either an object or array
            const fileObj = Array.isArray(trophyGifFile) ? trophyGifFile[0] : trophyGifFile;
            console.log('Trophy GIF file object keys:', Object.keys(fileObj || {}));
            console.log('Trophy GIF file object filepath exists:', fileObj && !!fileObj.filepath);
            console.log('Trophy GIF file object path exists:', fileObj && !!fileObj.path);

            // Check for both filepath (newer formidable) and path (older formidable)
            if (fileObj && (fileObj.filepath || fileObj.path)) {
                const trophyGifPath = fileObj.filepath || fileObj.path;

                // Check if this is actually a GIF file
                let isGif = false;
                let fileExt = '.gif';  // Always use .gif for trophy animations

                if (fileObj.mimetype) {
                    isGif = fileObj.mimetype === 'image/gif';
                } else if (fileObj.originalFilename) {
                    isGif = path.extname(fileObj.originalFilename).toLowerCase() === '.gif';
                }

                console.log(`Trophy file is GIF: ${isGif}, original mimetype: ${fileObj.mimetype}`);

                // Always save trophy animations with .gif extension
                const newPath = path.join(__dirname, 'uploads', 'gifs', `${overlayId}${fileExt}`);

                try {
                    // Ensure directory exists
                    if (!fs.existsSync(path.join(__dirname, 'uploads', 'gifs'))) {
                        fs.mkdirSync(path.join(__dirname, 'uploads', 'gifs'), { recursive: true });
                    }

                    fs.renameSync(trophyGifPath, newPath);
                    const updatedPath = `/uploads/gifs/${overlayId}${fileExt}`;
                    overlay.trophyGifPath = updatedPath;
                    console.log(`Saved trophy GIF for overlay ${overlayId} at path: ${updatedPath}`);

                    // Add warning if not actually a GIF
                    if (!isGif) {
                        console.warn(`Warning: Trophy animation for ${overlayId} may not be a proper GIF file`);
                    }
                } catch (error) {
                    console.error('Error saving trophy GIF:', error);
                }
            } else {
                console.error('Invalid trophy GIF file object');
            }
        }

        // Update overlay in memory cache
        overlaysCache.set(overlayId, overlay);

        // Update overlay in database
        try {
            // Prepare update data with only the fields that need to be updated
            const updateData = {};
            if (overlay.profilePicPath) {
                updateData.profilePicPath = overlay.profilePicPath;
                console.log(`Setting profile pic path for overlay ${overlayId} to: ${overlay.profilePicPath}`);
            }
            if (overlay.trophyGifPath) {
                updateData.trophyGifPath = overlay.trophyGifPath;
                console.log(`Setting trophy GIF path for overlay ${overlayId} to: ${overlay.trophyGifPath}`);
            }

            // Only update if there's something to update
            if (Object.keys(updateData).length > 0) {
                console.log(`Updating overlay ${overlayId} in database with data:`, updateData);
                await db.updateOverlay(overlayId, updateData);
                console.log(`Successfully updated overlay ${overlayId} in database`);
            } else {
                console.log(`No fields to update for overlay ${overlayId}`);
            }

            // Return success
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Files uploaded and saved successfully'
            }));
        } catch (error) {
            console.error(`Error updating overlay in database: ${error.message}`);

            // Still return success since files were saved, even if database update failed
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Files uploaded successfully, but there was an issue saving to the database'
            }));
        }
    });
}