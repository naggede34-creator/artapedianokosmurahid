import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let clientPromise;

if (!uri) {
  console.warn("[db] MONGODB_URI belum diset di environment variables.");
}

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri || "mongodb://localhost:27017/artapedia");
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db();
}

export async function usersCol() {
  return (await getDb()).collection("users");
}

export async function depositsCol() {
  return (await getDb()).collection("deposits");
}

export async function otpOrdersCol() {
  return (await getDb()).collection("otp_orders");
}
