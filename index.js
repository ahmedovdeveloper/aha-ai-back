// index.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === MongoDB ===
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("ERROR: MONGO_URI missing in .env");
      process.exit(1);
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("MongoDB Error:", err.message);
    process.exit(1);
  }
};
connectDB();

// === User Model ===
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  plan: { type: String, enum: ["free", "pro", "ultimate"], default: "free" },
  freeRequestsUsed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

// === Swagger ===
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AHA AI API",
      version: "1.0.0",
      description: "Регистрация, вход, генерация. Лимит только для free.",
    },
    servers: [{ url: "http://localhost:9000" }],
  },
  apis: ["./index.js"],
};
const specs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// === Create User ===
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, plan } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "all fields required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "email already exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash,
      plan: plan || "free",
    });

    res.status(201).json({ message: "user created", id: user._id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === Login ===
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email и пароль обязательны" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ error: "Неверный email или пароль" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Неверный email или пароль" });

    const token = jwt.sign(
      { id: user._id, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        freeRequestsUsed: user.freeRequestsUsed,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// === Get All Users ===
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === Generate (с проверкой лимита) ===
const OPENROUTER_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_URL = process.env.LLM_API_URL;

if (!OPENROUTER_KEY || !OPENROUTER_API_URL) {
  console.error("ERROR: OPENAI_API_KEY or LLM_API_URL missing");
  process.exit(1);
}

app.post("/api/generate", async (req, res) => {
  try {
    const { systemPrompt, userPrompt, model = "gpt-4o-mini" } = req.body;
    if (!userPrompt) return res.status(400).json({ error: "userPrompt required" });

    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (e) {}
    }

    // ЛИМИТ ТОЛЬКО ДЛЯ FREE
    if (user && user.plan === "free") {
      if (user.freeRequestsUsed >= 3) {
        return res.status(403).json({ error: "Лимит бесплатных запросов исчерпан" });
      }
      user.freeRequestsUsed += 1;
      await user.save();
    }

    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    msgs.push({ role: "user", content: userPrompt });

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "AHA AI",
      },
      body: JSON.stringify({ model, messages: msgs, max_tokens: 2000 }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || "LLM Error" });

    const text = data.choices?.[0]?.message?.content || "No response";
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === 404 ===
app.use((req, res) => res.status(404).json({ error: "not found" }));

// === Start ===
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});