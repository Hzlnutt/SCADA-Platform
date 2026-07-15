import { MongoClient } from "mongodb";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/scada";
const USERS_COLLECTION = "users";

async function main() {
  console.log("Connecting to MongoDB at:", MONGODB_URI);
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const users = db.collection(USERS_COLLECTION);

    const email = "operator@widatra.co";
    const existing = await users.findOne({ email });
    if (existing) {
      console.log("User already exists. Deleting it to re-create with password 'operator123'...");
      await users.deleteOne({ email });
    }

    const passwordHash = await bcrypt.hash("operator123", 10);
    const now = new Date();
    const user = {
      email,
      name: "Operator Widatra",
      role: "admin",
      passwordHash,
      provider: "local",
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    await users.insertOne(user);
    console.log("Operator user successfully created!");
    console.log("Email: operator@widatra.co");
    console.log("Password: operator123");
  } catch (err) {
    console.error("Error creating operator user:", err);
  } finally {
    await client.close();
  }
}

main();
