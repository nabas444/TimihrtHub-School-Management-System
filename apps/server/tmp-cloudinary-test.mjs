import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
const CLOUDINARY_URL = 'cloudinary://724498182674865:DCfpD2VEwjdVyKChbc7z_LQAzvc@fzyducjo';
const url = new URL(CLOUDINARY_URL);
cloudinary.config({ secure: true, api_key: url.username, api_secret: url.password, cloud_name: url.hostname });
const filePath = './tmp-cloudinary-test.txt';
fs.writeFileSync(filePath, 'test');
try {
  const res = await cloudinary.uploader.upload(filePath, { folder: 'timhirthub-test' });
  console.log('upload ok', res.secure_url);
} catch (err) {
  console.error('upload err', err && err.message ? err.message : err);
}
