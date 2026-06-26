import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { env } from "../../config/env.config";
import {
  AUTH_TOKENS_COLLECTION,
  USERS_COLLECTION
} from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import type {
  BootstrapInput,
  GoogleLoginInput,
  LoginInput,
  LogoutInput,
  RegisterInput,
  RefreshInput
} from "./auth.validation";

export type UserRole = "admin" | "leader" | "operator" | "team_head" | "user";

type UserDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string;
  provider?: "local" | "google";
  providerId?: string;
  avatarUrl?: string | null;
  biometricDescriptor?: number[];
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
};

type AuthTokenDoc = {
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

type AuthPayload = {
  sub: string;
  role: UserRole;
  name: string;
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const signAccessToken = (payload: AuthPayload) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  } as jwt.SignOptions);
};

const signRefreshToken = (userId: string) => {
  return jwt.sign({ sub: userId, type: "refresh" }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn
  } as jwt.SignOptions);
};

const buildAuthResponse = async (user: UserDoc) => {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    name: user.name
  });

  const refreshToken = signRefreshToken(user._id.toString());
  const tokenHash = hashToken(refreshToken);
  const db = getMongoDb();
  const authTokens = db.collection<AuthTokenDoc>(AUTH_TOKENS_COLLECTION);

  await authTokens.insertOne({
    userId: user._id,
    tokenHash,
    createdAt: new Date(),
    expiresAt: getTokenExpiry(refreshToken, 7)
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      hasBiometrics: !!user.biometricDescriptor
    }
  };
};

const getTokenExpiry = (token: string, fallbackDays: number) => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000);
  }

  return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
};

export const login = async (input: LoginInput) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    throw createError("Invalid credentials", 401);
  }

  if (user.status === "disabled") {
    throw createError("User disabled", 403);
  }

  if (!user.passwordHash) {
    throw createError("Use Google login for this account", 401);
  }

  const match = await bcrypt.compare(input.password, user.passwordHash);
  if (!match) {
    throw createError("Invalid credentials", 401);
  }

  return buildAuthResponse(user);
};

export const register = async (input: RegisterInput) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const email = input.email.toLowerCase();
  const existing = await users.findOne({ email });
  if (existing) {
    throw createError("Email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();
  const _id = new ObjectId();

  const user: UserDoc = {
    _id,
    email,
    name: input.name,
    role: "user",
    passwordHash,
    provider: "local",
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  await users.insertOne(user);
  return buildAuthResponse(user);
};

type GoogleTokenInfo = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  aud?: string;
};

const fetchGoogleProfile = async (credential: string) => {
  if (!env.googleClientId) {
    throw createError("Google OAuth not configured", 500);
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
  );

  if (!response.ok) {
    throw createError("Invalid Google token", 401);
  }

  const data = (await response.json()) as GoogleTokenInfo;
  if (!data.sub || !data.email || data.aud !== env.googleClientId) {
    throw createError("Invalid Google token", 401);
  }

  return data;
};

export const loginWithGoogle = async (input: GoogleLoginInput) => {
  const profile = await fetchGoogleProfile(input.credential);
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const email = profile.email!.toLowerCase();
  let user = await users.findOne({
    $or: [
      { provider: "google", providerId: profile.sub },
      { email }
    ]
  });

  const now = new Date();

  if (!user) {
    const _id = new ObjectId();
    user = {
      _id,
      email,
      name: profile.name ?? email.split("@")[0],
      role: "user",
      provider: "google",
      providerId: profile.sub,
      avatarUrl: profile.picture ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    await users.insertOne(user);
  } else {
    if (user.status === "disabled") {
      throw createError("User disabled", 403);
    }
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          provider: "google",
          providerId: profile.sub,
          avatarUrl: profile.picture ?? user.avatarUrl ?? null,
          updatedAt: now
        }
      }
    );
    user = {
      ...user,
      provider: "google",
      providerId: profile.sub,
      avatarUrl: profile.picture ?? user.avatarUrl ?? null,
      updatedAt: now
    };
  }

  return buildAuthResponse(user);
};

export const refreshAccessToken = async (input: RefreshInput) => {
  const db = getMongoDb();
  const authTokens = db.collection<AuthTokenDoc>(AUTH_TOKENS_COLLECTION);
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  let payload: jwt.JwtPayload & { type?: string };
  try {
    payload = jwt.verify(input.refreshToken, env.jwtRefreshSecret) as jwt.JwtPayload & {
      type?: string;
    };
  } catch {
    throw createError("Invalid refresh token", 401);
  }

  if (payload.type !== "refresh" || !payload.sub) {
    throw createError("Invalid refresh token", 401);
  }

  const tokenHash = hashToken(input.refreshToken);
  const tokenDoc = await authTokens.findOne({ tokenHash });
  if (!tokenDoc) {
    throw createError("Refresh token revoked", 401);
  }

  if (tokenDoc.expiresAt < new Date()) {
    await authTokens.deleteOne({ tokenHash });
    throw createError("Refresh token expired", 401);
  }

  const userId = new ObjectId(payload.sub);
  const user = await users.findOne({ _id: userId });
  if (!user) {
    throw createError("User not found", 404);
  }

  if (user.status === "disabled") {
    throw createError("User disabled", 403);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    name: user.name
  });

  return { accessToken };
};

export const logout = async (input: LogoutInput) => {
  const db = getMongoDb();
  const authTokens = db.collection<AuthTokenDoc>(AUTH_TOKENS_COLLECTION);
  const tokenHash = hashToken(input.refreshToken);

  const result = await authTokens.deleteOne({ tokenHash });
  return { revoked: result.deletedCount > 0 };
};

export const bootstrapAdmin = async (input: BootstrapInput) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const existing = await users.estimatedDocumentCount();
  if (existing > 0) {
    throw createError("Bootstrap already completed", 409);
  }

  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();
  const _id = new ObjectId();

  const result = await users.insertOne({
    _id,
    email,
    name: input.name,
    role: "admin",
    passwordHash,
    provider: "local",
    status: "active",
    createdAt: now,
    updatedAt: now
  });

  return {
    id: result.insertedId.toString(),
    email,
    name: input.name,
    role: "admin"
  };
};

// ===== TAMBAHAN: VERIFY PASSWORD =====
export const verifyPassword = async (userId: string, password: string): Promise<boolean> => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user || !user.passwordHash) {
    return false;
  }

  return bcrypt.compare(password, user.passwordHash);
};