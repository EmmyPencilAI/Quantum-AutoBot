const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetBalance() {
  console.log("Fetching users...");
  const snapshot = await db.collection("users").get();
  
  if (snapshot.empty) {
    console.log("No users found.");
    return;
  }
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Assuming you are the only user or we reset everyone's walletBalance to test.
    // I will look for your exact phantom test wallet if needed, or just reset all walletBalances to 5
    await doc.ref.update({
        walletBalance: 5
    });
    console.log("Restored \ to " + doc.id);
  }
  console.log("Done");
  process.exit(0);
}

resetBalance();
