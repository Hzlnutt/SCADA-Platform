import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/scada';
  console.log('Connecting to:', uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('scada');
    const users = db.collection('users');
    const user = await users.findOne({ name: 'Timothy' });
    console.log('User Document in local DB:', JSON.stringify(user, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
