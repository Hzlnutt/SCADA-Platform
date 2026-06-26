import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { USERS_COLLECTION } from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import type {
  CreateUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserRole
} from "./users.validation";

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
  biometricDescriptors?: number[][];
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

  const result = await users.insertOne({
    _id,
    email,
    name: input.name,
    role: input.role,
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
    role: input.role,
    status: "active",
    createdAt: now
  };
};

export const listUsers = async (limit: number) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  return users
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const getUserById = async (id: string) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const user = await users.findOne({ _id: new ObjectId(id) }, { projection: { passwordHash: 0 } });
  if (!user) return null;

  const { biometricDescriptor, biometricDescriptors, ...rest } = user;
  return {
    ...rest,
    id: user._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor
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

  const { biometricDescriptor, biometricDescriptors, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor
  };
};

export const updateUserRole = async (id: string, input: UpdateUserInput) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);

  const result = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { role: input.role, updatedAt: new Date() } },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );

  if (!result) {
    throw createError("User not found", 404);
  }

  const { biometricDescriptor, biometricDescriptors, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor
  };
};

export const deleteUser = async (id: string) => {
  const db = getMongoDb();
  const users = db.collection<UserDoc>(USERS_COLLECTION);
  const result = await users.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    throw createError("User not found", 404);
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
      $unset: { biometricDescriptor: "" }
    },
    { returnDocument: "after", projection: { passwordHash: 0 } }
  );

  if (!result) {
    throw createError("User not found", 404);
  }

  const { biometricDescriptor, biometricDescriptors, ...rest } = result;
  return {
    ...rest,
    id: result._id.toString(),
    hasBiometrics: !!(biometricDescriptors && biometricDescriptors.length > 0) || !!biometricDescriptor
  };
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

