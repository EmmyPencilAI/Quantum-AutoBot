// Added to server.ts manually in context
import crypto from 'crypto';
const SIGNAL_PRIVATE_KEY = process.env.SIGNAL_PRIVATE_KEY || '...';

function signAction(action: string, amount: number, timestamp: number) {
  // Sign the intent so the frontend can rigorously verify its authenticity
  const sign = crypto.createSign('SHA256');
  sign.update(\-\-\);
  sign.end();
  return sign.sign(SIGNAL_PRIVATE_KEY, 'hex');
}

// Write the intent to firestore with the generated "signature" payload
