import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { USERS_COLLECTION } from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import type {
  CreateUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserRole
} from "./users.validation";

type UserDoc = {
  _id: ObjectId;
  username?: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string;
  provider?: "local" | "google";
  providerId?: string;
  avatarUrl?: string | null;
  biometricDescriptor?: number[];
  biometricDescriptors?: number[][];
  biometricImages?: string[];
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
};

const createError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

export const createUser = async (input: CreateUserInput) => {
  const username = (input.username || (input.email ? input.email.split("@")[0] : input.name.toLowerCase().replace(/\s+/g, ""))).trim().toLowerCase();
  const email = (input.email || `${username}@widatra.co`).toLowerCase();

  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();
  const _id = new ObjectId();

  // 1. Insert into PostgreSQL users table with bcrypt encrypted password
  const pool = getPostgresPool();
  try {
    const existingPg = await pool.query(`SELECT id FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1`, [username, email]);
    if (existingPg.rows.length > 0) {
      throw createError("User already exists", 409);
    }

    await pool.query(`
      INSERT INTO users (username, name, email, role, password_hash, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = NOW()
    `, [username, input.name, email, input.role, passwordHash, now]);
  } catch (err: any) {
    if (err.statusCode) throw err;
  }

  // 2. Insert into MongoDB
  const db = getMongoDb();
  if (db) {
    const users = db.collection<UserDoc>(USERS_COLLECTION);
    const existing = await users.findOne({ $or: [{ email }, { username }] });
    if (!existing) {
      await users.insertOne({
        _id,
        username,
        email,
        name: input.name,
        role: input.role,
        passwordHash,
        provider: "local",
        status: "active",
        createdAt: now,
        updatedAt: now
      });
    }
  }

  return {
    id: _id.toString(),
    username,
    email,
    name: input.name,
    role: input.role,
    status: "active",
    createdAt: now
  };
};

export const listUsers = async (limit: number) => {
  const pool = getPostgresPool();
  try {
    const pgRes = await pool.query(`
      SELECT id, username, name, email, role, avatar_url, status, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    if (pgRes.rows.length > 0) {
      return pgRes.rows.map((r: any) => ({
        _id: String(r.id),
        id: String(r.id),
        username: r.username,
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    }
  } catch {}

  const db = getMongoDb();
  if (db) {
    const users = db.collection<UserDoc>(USERS_COLLECTION);
    const list = await users
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return list.map((u) => ({
      ...u,
      username: u.username || u.email.split("@")[0]
    }));
  }

  return [];
};

export const getUserById = async (id: string) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne({ _id: new ObjectId(id) }, { projection: { passwordHash: 0 } });
  if (!user) return null;

  const { biometricDescriptor, biometricDescriptors, biometricImages, ...rest } = user;
  return {
    ...rest,
    id: user._id.toString(),
    username: user.username || user.email.split("@")[0],
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor || !!(biometricImages && biometricImages.length > 0)
  };
};

export const updateUserProfile = async (id: string, input: UpdateProfileInput) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const update: Partial<UserDoc> = { updatedAt: new Date() };
  if (input.name) {
    update.name = input.name;
  }
  if (input.avatarUrl !== undefined) {
    update.avatarUrl = input.avatarUrl ?? null;
  }

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );

  if (!result) {
    throw createError("User not found", 404);
  }

  const { biometricDescriptor, biometricDescriptors, biometricImages, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor || !!(biometricImages && biometricImages.length > 0)
  };
};

export const updateUserRole = async (id: string, input: UpdateUserInput) => {
  const pool = getPostgresPool();
  try {
    await pool.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id::text = $2 OR username = $2`, [input.role, id]);
  } catch {}

  const db = getMongoDb();
  if (db && ObjectId.isValid(id)) {
    const users = db.collection<UserDoc>(USERS_COLLECTION);
    await users.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { role: input.role, updatedAt: new Date() } }
    );
  }

  return { id, role: input.role };
};

export const deleteUser = async (id: string) => {
  const pool = getPostgresPool();
  try {
    await pool.query(`DELETE FROM users WHERE id::text = $1 OR username = $1 OR email = $1`, [id]);
  } catch {}

  const db = getMongoDb();
  if (db && ObjectId.isValid(id)) {
    const users = db.collection<UserDoc>(USERS_COLLECTION);
    await users.deleteOne({ _id: new ObjectId(id) });
  }

  return { success: true };
};

export const listOperators = async () => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  return users
    .find(
      {
        role: {
          $in: [
            "operator",
            "kashift_utility_hvac",
            "kashift_utility",
            "kashift_hvac",
            "leader",
            "admin",
            "senior_unit_head",
            "unit_head"
          ]
        },
        status: "active"
      },
      { projection: { passwordHash: 0 } }
    )
    .sort({ name: 1 })
    .toArray();
};

export const updateUserBiometrics = async (id: string, descriptors: number[][]) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { 
      $set: { biometricDescriptors: descriptors, updatedAt: new Date() },
      $unset: { biometricDescriptor: "", biometricImages: "" }
    },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );

  if (!result) {
    throw createError("User not found", 404);
  }

  const { biometricDescriptor, biometricDescriptors, biometricImages, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor || !!(biometricImages && biometricImages.length > 0)
  };
};

export const updateUserBiometricsCloud = async (id: string, images: string[]) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { 
      $set: { biometricImages: images, updatedAt: new Date() },
      $unset: { biometricDescriptor: "", biometricDescriptors: "" }
    },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );

  if (!result) {
    throw createError("User not found", 404);
  }

  const { biometricDescriptor, biometricDescriptors, biometricImages, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor || !!(biometricImages && biometricImages.length > 0)
  };
};

export const getBiometricImages = async (id: string): Promise<string[] | null> => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne(
    { _id: new ObjectId(id) },
    { projection: { biometricImages: 1 } }
  );

  if (!user) return null;
  return user.biometricImages || null;
};

export const getBiometricDescriptors = async (id: string): Promise<number[][] | null> => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne(
    { _id: new ObjectId(id) },
    { projection: { biometricDescriptors: 1, biometricDescriptor: 1 } }
  );

  if (!user) return null;
  if (user.biometricDescriptors && user.biometricDescriptors.length > 0) {
    return user.biometricDescriptors;
  }
  if (user.biometricDescriptor) {
    return [user.biometricDescriptor]; // backward compatibility
  }
  return null;
};

