// src/app.js

import express from "express";
import router from "./routes/index.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // frontend
  credentials: true
}));

// Security headers
app.use(helmet());

// Basic rate limiting for all requests (adjust in production)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());
app.use("/api", router);

export default app;
