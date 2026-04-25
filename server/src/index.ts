import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./auth/auth.routes";
import authE2ERouter from "./auth/e2e.routes";
import supportRouter from "./support/support.routes";
import { requireAuth } from "./auth/auth.middleware";

async function main() {
  dotenv.config();

  const app = express();

  const allowedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / server-to-server / curl
        if (!origin) return cb(null, true);

        if (allowedOrigins.includes(origin)) return cb(null, true);

        return cb(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());

  app.get("/status", (req, res) => {
    res.json({
      ok: true,
      status: "UP",
    });
  });

  app.use("/auth", authRouter);
  app.use("/auth", authE2ERouter);

  //protect
  app.use("/api", requireAuth);
  app.use("/api/support", supportRouter);

  const port = Number(process.env.PORT || 5000);

  app.listen(port, () => {
    console.log("Server is running on port 5000");
  });
}

main().catch((err) => {
  console.error("Server error occured");
  process.exit(1);
});
