#!/usr/bin/env node
/**
 * Admin Role Setup Script
 *
 * Sets the `role: 'admin'` custom claim on a Firebase user so they can access
 * protected admin endpoints (e.g. /api/admin/status) in the Quantum Finance backend.
 *
 * Usage:
 *   node scripts/set-admin.mjs <userUID>
 *
 * Prerequisites:
 *   - firebase-applet-config.json must exist in the project root
 *   - Run with Node.js 18+ (ESM support)
 *
 * After running:
 *   - The user must sign out and sign back in for the new claim to take effect
 *   - The Firestore user document's `role` field is also updated for UI display
 *
 * To revoke admin:
 *   node scripts/set-admin.mjs <userUID> --revoke
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = process.argv[2];
const revoke = process.argv.includes("--revoke");

// ─── Validate input ───────────────────────────────────────────────────────────
if (!uid) {
  console.error("❌  Usage: node scripts/set-admin.mjs <userUID> [--revoke]");
  console.error("   Example: node scripts/set-admin.mjs abc123def456");
  process.exit(1);
}

if (!/^[a-zA-Z0-9]{20,128}$/.test(uid)) {
  console.error("❌  Invalid Firebase UID format.");
  process.exit(1);
}

// ─── Initialize Firebase Admin ────────────────────────────────────────────────
const configPath = path.join(__dirname, "..", "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌  firebase-applet-config.json not found in project root.");
  console.error("   This file is needed to initialize Firebase Admin SDK.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({ projectId: config.projectId });
}

const db = admin.firestore();
const auth = admin.auth();

// ─── Set / Revoke Admin Claims ────────────────────────────────────────────────
try {
  const existingUser = await auth.getUser(uid);

  if (revoke) {
    await auth.setCustomUserClaims(uid, { role: "user" });
    await db.collection("users").doc(uid).update({ role: "user" });
    console.log(`✅  Admin role REVOKED for: ${existingUser.email || uid}`);
  } else {
    await auth.setCustomUserClaims(uid, { role: "admin" });
    await db.collection("users").doc(uid).update({ role: "admin" });
    console.log(`✅  Admin role GRANTED to: ${existingUser.email || uid}`);
    console.log("");
    console.log("⚠️   IMPORTANT: The user must sign out and sign back in for");
    console.log("    the custom claim to be included in their ID token.");
    console.log("");
    console.log("📋  This user can now:");
    console.log("    - Access GET /api/admin/status");
    console.log("    - Access other users' resources via server endpoints");
  }
} catch (e) {
  console.error("❌  Failed:", e.message);
  if (e.code === "auth/user-not-found") {
    console.error(`   No Firebase user found with UID: ${uid}`);
    console.error("   You can find the UID in the Firebase console under Authentication.");
  }
  process.exit(1);
}
