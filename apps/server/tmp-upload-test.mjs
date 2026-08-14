import fs from 'fs';
import path from 'path';
const tempFile = path.join(process.cwd(), 'tmp-upload-test.txt');
fs.writeFileSync(tempFile, 'hello upload test');
const loginRes = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@demoschool.edu', password: 'password123' }),
});
const loginJson = await loginRes.json();
console.log('login status', loginRes.status, loginJson);
if (!loginJson.data?.accessToken) process.exit(1);
const token = loginJson.data.accessToken;
const form = new FormData();
form.append('file', fs.createReadStream(tempFile));
form.append('category', 'RESOURCE');
const uploadRes = await fetch('http://127.0.0.1:5000/api/v1/files/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const uploadText = await uploadRes.text();
console.log('upload status', uploadRes.status);
console.log(uploadText);
