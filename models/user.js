import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  plan: { type: String, enum: ["free", "pro", "ultimate"], default: "free" },
});

export default mongoose.model("User", UserSchema);
