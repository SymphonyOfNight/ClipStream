import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const iconSvg = path.join(publicDir, 'icon.svg');
const iconPng = path.join(publicDir, 'icon.png');

async function generateIcons() {
  try {
    if (!fs.existsSync(iconSvg)) {
      console.error('icon.svg not found in public directory');
      process.exit(1);
    }

    console.log('Generating icon.png from icon.svg...');
    await sharp(iconSvg)
      .resize(512, 512)
      .png()
      .toFile(iconPng);
    
    console.log('Successfully generated icon.png');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();
