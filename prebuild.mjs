/**
 * Prebuild script for pxxl.app / cloud deployment.
 * 
 * Writes firebase-applet-config.json from the FIREBASE_CONFIG env var
 * so that the Vite build can import it (since the file is gitignored).
 * 
 * This runs BEFORE `vite build` via the "build" script in package.json.
 */
import fs from 'fs';

const configPath = 'firebase-applet-config.json';

if (process.env.FIREBASE_CONFIG && !fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, process.env.FIREBASE_CONFIG);
  console.log('✅ [prebuild] firebase-applet-config.json written from FIREBASE_CONFIG env var');
} else if (fs.existsSync(configPath)) {
  console.log('✅ [prebuild] firebase-applet-config.json already exists');
} else {
  console.error('❌ [prebuild] WARNING: No FIREBASE_CONFIG env var and no firebase-applet-config.json file!');
  console.error('   The build may fail. Set FIREBASE_CONFIG in your deployment environment.');
}

// Also write credentials file if provided
if (process.env.GOOGLE_CREDENTIALS_JSON && !fs.existsSync('.gcp-credentials.json')) {
  fs.writeFileSync('.gcp-credentials.json', process.env.GOOGLE_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '.gcp-credentials.json';
  console.log('✅ [prebuild] .gcp-credentials.json written from GOOGLE_CREDENTIALS_JSON env var');
}
