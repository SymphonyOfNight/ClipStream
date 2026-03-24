import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const iconSvg = path.join(publicDir, 'icon.svg');
const iconPng = path.join(publicDir, 'icon.png');
const traySvg = path.join(publicDir, 'tray.svg');
const trayTemplatePng = path.join(publicDir, 'trayTemplate.png');
const trayTemplate2xPng = path.join(publicDir, 'trayTemplate@2x.png');

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

    if (fs.existsSync(traySvg)) {
      console.log('Generating trayTemplate.png from tray.svg...');
      await sharp(traySvg)
        .resize(22, 22)
        .png()
        .toFile(trayTemplatePng);
      
      console.log('Generating trayTemplate@2x.png from tray.svg...');
      await sharp(traySvg)
        .resize(44, 44)
        .png()
        .toFile(trayTemplate2xPng);
        
      console.log('Successfully generated tray icons');
    }
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();
