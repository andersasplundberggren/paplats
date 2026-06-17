'use strict';

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'];
const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
];
const ALLOWED_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES, ...ALLOWED_AUDIO_MIMES];

const ALLOWED_EXTENSIONS = {
  'image/jpeg':     '.jpg',
  'image/png':      '.png',
  'image/webp':     '.webp',
  'image/gif':      '.gif',
  'video/mp4':      '.mp4',
  'video/quicktime':'.mov',
  'video/webm':     '.webm',
  'video/mpeg':     '.mp4',
  'audio/mpeg':     '.mp3',
  'audio/mp3':      '.mp3',
  'audio/mp4':      '.m4a',
  'audio/x-m4a':    '.m4a',
  'audio/m4a':      '.m4a',
  'audio/wav':      '.wav',
  'audio/wave':     '.wav',
  'audio/x-wav':    '.wav',
  'audio/aac':      '.aac',
  'audio/ogg':      '.ogg',
  'audio/flac':     '.flac',
  'audio/x-flac':   '.flac',
};

const MAX_IMAGE_BYTES = (parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) || 20)  * 1024 * 1024;
const MAX_VIDEO_BYTES = (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 500) * 1024 * 1024;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

function getMediaType(mimeType) {
  if (ALLOWED_IMAGE_MIMES.includes(mimeType)) return 'image';
  if (ALLOWED_AUDIO_MIMES.includes(mimeType)) return 'audio';
  return 'video';
}

function getDestDir(mimeType) {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = String(now.getMonth() + 1).padStart(2, '0');
  const subtype = getMediaType(mimeType) === 'image' ? 'images'
                : getMediaType(mimeType) === 'audio' ? 'audio'
                : 'videos';
  const dir = path.join(process.env.UPLOADS_DIR, subtype, String(year), month);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getDestDir(file.mimetype));
  },
  filename(req, file, cb) {
    const ext  = ALLOWED_EXTENSIONS[file.mimetype] || path.extname(file.originalname) || '';
    const name = crypto.randomUUID() + ext;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  // Accept if mime matches OR if extension suggests audio/video/image
  const ext = path.extname(file.originalname).toLowerCase();
  const audioExts = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'];
  const videoExts = ['.mp4', '.mov', '.webm'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  if (ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(null, true);
  }
  if (audioExts.includes(ext) || videoExts.includes(ext) || imageExts.includes(ext)) {
    return cb(null, true);
  }
  cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_AUDIO_BYTES),
    files: 1,
  },
});

function validateFileSize(req, res, next) {
  if (!req.file) return next();
  const type  = getMediaType(req.file.mimetype);
  const limit = type === 'image' ? MAX_IMAGE_BYTES
              : type === 'audio' ? MAX_AUDIO_BYTES
              : MAX_VIDEO_BYTES;

  if (req.file.size > limit) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: `File too large. Max for this type is ${limit / 1024 / 1024} MB.`,
    });
  }
  next();
}

function relativeStoredPath(absolutePath) {
  return path.relative(process.env.UPLOADS_DIR, absolutePath);
}

function publicUrl(storedPath) {
  return `${process.env.MEDIA_BASE_URL}/${storedPath.replace(/\\/g, '/')}`;
}

module.exports = { upload, validateFileSize, relativeStoredPath, publicUrl, getMediaType };