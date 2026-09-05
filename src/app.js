// src/app.js

import express from "express";
import router from "./routes/index.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

const app = express();

const normalizeOrigin = (origin) =>
  origin?.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");

const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS || "http://localhost:5173"
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
console.log("FRONTEND_ORIGINS =", JSON.stringify(FRONTEND_ORIGINS));

app.use(
  cors({
    origin: (origin, cb) => {
      console.log("REQUEST ORIGIN =", JSON.stringify(origin));
      const normalizedOrigin = normalizeOrigin(origin);
      console.log(
        "ORIGIN ALLOWED =",
        FRONTEND_ORIGINS.includes(normalizedOrigin),
      );

      if (!origin) return cb(null, true);

      if (FRONTEND_ORIGINS.includes(normalizedOrigin)) {
        return cb(null, true);
      }

      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
  }),
);

// Security headers
app.use(helmet());

// trust Render / one proxy
app.set("trust proxy", 1);

// Basic rate limiting for all requests (adjust in production)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());
app.use("/api", router);

export default app;
