import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z
    .string()
    .default("mongodb://scada:scada@localhost:27017/scada?authSource=admin"),
  MONGODB_DB: z.string().default("scada"),
  TELEMETRY_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  HISTORIAN_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  HISTORIAN_HOURLY_RETENTION_DAYS: z.coerce.number().int().positive().default(1095),
  ROLLUP_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  ROLLUP_LAG_SECONDS: z.coerce.number().int().min(0).default(10),
  ROLLUP_HOURLY_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  ROLLUP_HOURLY_LAG_MINUTES: z.coerce.number().int().min(0).default(5),
  JWT_SECRET: z
    .string()
    .min(16)
    .default("change-me-super-secret"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default("change-me-refresh-secret"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  DUMMY_MODE: z.coerce.boolean().default(false),
  DUMMY_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PYTHON_BIOMETRICS_URL: z.string().default("http://localhost:5001"),
  GEMINI_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("")
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB: process.env.MONGODB_DB,
  TELEMETRY_RETENTION_DAYS: process.env.TELEMETRY_RETENTION_DAYS,
  HISTORIAN_RETENTION_DAYS: process.env.HISTORIAN_RETENTION_DAYS,
  HISTORIAN_HOURLY_RETENTION_DAYS: process.env.HISTORIAN_HOURLY_RETENTION_DAYS,
  ROLLUP_INTERVAL_MS: process.env.ROLLUP_INTERVAL_MS,
  ROLLUP_LAG_SECONDS: process.env.ROLLUP_LAG_SECONDS,
  ROLLUP_HOURLY_INTERVAL_MS: process.env.ROLLUP_HOURLY_INTERVAL_MS,
  ROLLUP_HOURLY_LAG_MINUTES: process.env.ROLLUP_HOURLY_LAG_MINUTES,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  DUMMY_MODE: process.env.DUMMY_MODE,
  DUMMY_INTERVAL_MS: process.env.DUMMY_INTERVAL_MS,
  REDIS_URL: process.env.REDIS_URL,
  PYTHON_BIOMETRICS_URL: process.env.PYTHON_BIOMETRICS_URL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM
});

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  corsOrigin: parsed.CORS_ORIGIN,
  mongoUri: parsed.MONGODB_URI,
  mongoDb: parsed.MONGODB_DB,
  telemetryRetentionDays: parsed.TELEMETRY_RETENTION_DAYS,
  historianRetentionDays: parsed.HISTORIAN_RETENTION_DAYS,
  historianHourlyRetentionDays: parsed.HISTORIAN_HOURLY_RETENTION_DAYS,
  rollupIntervalMs: parsed.ROLLUP_INTERVAL_MS,
  rollupLagSeconds: parsed.ROLLUP_LAG_SECONDS,
  rollupHourlyIntervalMs: parsed.ROLLUP_HOURLY_INTERVAL_MS,
  rollupHourlyLagMinutes: parsed.ROLLUP_HOURLY_LAG_MINUTES,
  jwtSecret: parsed.JWT_SECRET,
  jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
  jwtExpiresIn: parsed.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN,
  googleClientId: parsed.GOOGLE_CLIENT_ID,
  dummyMode: parsed.DUMMY_MODE,
  dummyIntervalMs: parsed.DUMMY_INTERVAL_MS,
  redisUrl: parsed.REDIS_URL,
  pythonBiometricsUrl: parsed.PYTHON_BIOMETRICS_URL,
  geminiApiKey: parsed.GEMINI_API_KEY,
  smtpHost: parsed.SMTP_HOST,
  smtpPort: parsed.SMTP_PORT,
  smtpUser: parsed.SMTP_USER,
  smtpPass: parsed.SMTP_PASS,
  smtpFrom: parsed.SMTP_FROM
};
