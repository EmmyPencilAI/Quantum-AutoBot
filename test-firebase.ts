import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

async function test() {
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  try {
    const q = query(collection(db, "users"), limit(1));
    const snap = await getDocs(q);
    console.log("Client connection successful. Found users:", snap.size);
  } catch (e: any) {
    console.error("Client connection failed:", e.message);
  }
}
test();
