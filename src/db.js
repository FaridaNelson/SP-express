import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  const { name, host } = mongoose.connection;
  console.log(`Mongo connected → db: ${name} @ ${host}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log("Mongo disconnected");
}
