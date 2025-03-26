const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const profilePicsDir = path.join(__dirname, 'public/uploads/profile_pics');
const trophyGifsDir = path.join(__dirname, 'public/uploads/trophy_gifs');

// Create directories if they don't exist
try {
  if (!fs.existsSync('public/uploads')) {
    fs.mkdirSync('public/uploads', { recursive: true });
  }
  if (!fs.existsSync(profilePicsDir)) {
    fs.mkdirSync(profilePicsDir, { recursive: true });
  }
  if (!fs.existsSync(trophyGifsDir)) {
    fs.mkdirSync(trophyGifsDir, { recursive: true });
  }
} catch (err) {
  console.error('Error creating upload directories:', err);
}

// Configure storage for profile pictures
const profilePicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profilePicsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// Configure storage for trophy GIFs
const trophyGifStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, trophyGifsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'trophy-' + uniqueSuffix + ext);
  }
});

// File filter function to allow only image and GIF files
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (ext && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png) and GIF files are allowed'));
  }
};

// Create multer instances for each type of upload
const uploadProfilePic = multer({
  storage: profilePicStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB size limit
  fileFilter: fileFilter
}).single('profilePic');

const uploadTrophyGif = multer({
  storage: trophyGifStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB size limit
  fileFilter: fileFilter
}).single('trophyGif');

module.exports = {
  uploadProfilePic,
  uploadTrophyGif
};