import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const multerConfig: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      // Use temp directory for Vercel, local uploads for development
      const uploadDir = process.env.VERCEL ? tmpdir() : join(process.cwd(), 'uploads');
      
      // Ensure directory exists (only for local development)
      if (!process.env.VERCEL && !existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const safeFilename = file.originalname.replace(/\s+/g, '_');
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${extname(safeFilename)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed!'), false);
    }
  },
};