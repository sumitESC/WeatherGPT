import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve static files in production
const publicPath = path.resolve(__dirname, "public");
app.use(express.static(publicPath));

// Catch-all route for SPA
app.get("/{*path}", (_req, res, next) => {
  if (_req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.resolve(publicPath, "index.html"));
});

export default app;
