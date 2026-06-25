import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const _allowedOrigins: string[] = [
  ...(process.env["REPLIT_DOMAINS"] ?? "").split(",").flatMap(d => {
    const t = d.trim();
    return t ? [`https://${t}`] : [];
  }),
  ...(process.env["REPLIT_DEV_DOMAIN"] ? [`https://${process.env["REPLIT_DEV_DOMAIN"]}`] : []),
  "http://localhost:25867",
  "http://localhost:80",
];

app.use(
  cors({
    origin(requestOrigin, callback) {
      if (!requestOrigin || _allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
