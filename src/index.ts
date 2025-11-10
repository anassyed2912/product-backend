import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import productRouter from "./routes/products";
import questionRouter from "./routes/questions";
import authRouter from "./routes/auth";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user?: string | JwtPayload;
    }
  }
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET as string);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

async function start() {
  const app = express();

  // ✅ Updated CORS setup for Render + Vercel
  const allowedOrigins = [
    "http://localhost:5173", // local dev
    "https://product-frontend-anassyed2912.vercel.app" // deployed frontend
  ];

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    })
  );

  app.use(bodyParser.json());

  const mongoURI = process.env.MONGO_URI || "";
  if (!mongoURI) {
    console.error("❌ MONGO_URI not found in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }

  app.use("/api/auth", authRouter);
  app.use("/api/products", authenticate, productRouter);
  app.use("/api", questionRouter);

  // Optional: test endpoint
  app.get("/", (req: Request, res: Response) => {
    res.send("✅ Backend running successfully!");
  });

  const port = process.env.PORT || 4000;
  app.listen(port, () =>
    console.log(`🚀 Backend listening on http://localhost:${port}`)
  );
}

start().catch((err) => {
  console.error("❌ Fatal error starting server:", err);
  process.exit(1);
});
