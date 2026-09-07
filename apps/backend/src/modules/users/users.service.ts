import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { USERS_COLLECTION } from "../../database/collections";
import { getMongoDb } from "../../database/mongo";
import { getPostgresPool } from "../../database/postgres";
import type {
  CreateUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserRole,
  RequestPasswordChangeInput,
  ReviewPasswordChangeInput
} from "./users.validation";
import { verifyPassword } from "../auth/auth.service";

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
  const pool = getPostgresPool();
  try {
    const isNum = !isNaN(Number(id));
    const pgRes = await pool.query(
      isNum
        ? `SELECT id, username, name, email, role, avatar_url, status FROM users WHERE id = $1 LIMIT 1`
        : `SELECT id, username, name, email, role, avatar_url, status FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
      [isNum ? Number(id) : id]
    );
    if (pgRes.rows.length > 0) {
      const u = pgRes.rows[0];
      let hasBiometrics = false;
      const db = getMongoDb();
      if (db) {
        try {
          const users = db.collection<UserDoc>(USERS_COLLECTION);
          const mUser = await users.findOne({ $or: [{ username: u.username }, { email: u.email }] });
          if (mUser) {
            hasBiometrics = !!(mUser.biometricDescriptors && mUser.biometricDescriptors.length > 0) || !!mUser.biometricDescriptor || !!(mUser.biometricImages && mUser.biometricImages.length > 0);
          }
        } catch {}
      }
      return {
        id: String(u.id),
        username: u.username,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatar_url,
        status: u.status,
        hasBiometrics
      };
    }
  } catch {}

  const db = getMongoDb();
  if (db && ObjectId.isValid(id)) {
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
  }

  return null;
};

export const updateUserProfile = async (id: string, input: UpdateProfileInput) => {
  const pool = getPostgresPool();
  let updatedPg: any = null;
  try {
    const isNum = !isNaN(Number(id));
    if (input.name && input.avatarUrl !== undefined) {
      const res = await pool.query(
        isNum 
          ? `UPDATE users SET name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id, username, name, email, role, avatar_url, status`
          : `UPDATE users SET name = $1, avatar_url = $2, updated_at = NOW() WHERE username = $3 OR email = $3 RETURNING id, username, name, email, role, avatar_url, status`,
        [input.name, input.avatarUrl, isNum ? Number(id) : id]
      );
      if (res.rows.length > 0) updatedPg = res.rows[0];
    } else if (input.name) {
      const res = await pool.query(
        isNum 
          ? `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, name, email, role, avatar_url, status`
          : `UPDATE users SET name = $1, updated_at = NOW() WHERE username = $2 OR email = $2 RETURNING id, username, name, email, role, avatar_url, status`,
        [input.name, isNum ? Number(id) : id]
      );
      if (res.rows.length > 0) updatedPg = res.rows[0];
    } else if (input.avatarUrl !== undefined) {
      const res = await pool.query(
        isNum 
          ? `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, name, email, role, avatar_url, status`
          : `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE username = $2 OR email = $2 RETURNING id, username, name, email, role, avatar_url, status`,
        [input.avatarUrl, isNum ? Number(id) : id]
      );
      if (res.rows.length > 0) updatedPg = res.rows[0];
    }
  } catch {}

  const db = getMongoDb();
  if (db && ObjectId.isValid(id)) {
    const users = db.collection<UserDoc>(USERS_COLLECTION);
    const update: Partial<UserDoc> = { updatedAt: new Date() };
    if (input.name) update.name = input.name;
    if (input.avatarUrl !== undefined) update.avatarUrl = input.avatarUrl ?? null;
    await users.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: update });
  }

  if (updatedPg) {
    return {
      id: String(updatedPg.id),
      username: updatedPg.username,
      name: updatedPg.name,
      email: updatedPg.email,
      role: updatedPg.role,
      avatarUrl: updatedPg.avatar_url,
      status: updatedPg.status,
      hasBiometrics: false
    };
  }

  return getUserById(id);
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
            "unit_head_utility",
            "unit_head_hvac",
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

// ==========================================
// PASSWORD CHANGE REQUEST & APPROVAL WORKFLOW
// ==========================================

export const requestPasswordChange = async (userId: string, input: RequestPasswordChangeInput) => {
  // 1. Verify current password
  const isValid = await verifyPassword(userId, input.currentPassword);
  if (!isValid) {
    throw createError("Password saat ini salah", 400);
  }

  // 2. Fetch user information
  const user = await getUserById(userId);
  if (!user) {
    throw createError("User tidak ditemukan", 404);
  }

  // 3. Hash new password with bcrypt
  const newPasswordHash = await bcrypt.hash(input.newPassword, 10);
  const pool = getPostgresPool();
  const numericId = !isNaN(Number(user.id)) ? Number(user.id) : null;

  // Jika user adalah admin/developer, password langsung aktif tanpa perlu persetujuan (approve)
  const userRole = (user.role || "").toLowerCase().trim();
  const isAdmin =
    userRole === "admin" ||
    userRole === "superadmin" ||
    userRole === "developer" ||
    userRole === "dev";

  if (isAdmin) {
    // 1. Langsung update password di PostgreSQL
    if (numericId) {
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, numericId]
      );
    } else {
      await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2`,
        [newPasswordHash, user.username]
      );
    }

    // 2. Sinkronkan ke MongoDB jika ada
    const db = getMongoDb();
    if (db) {
      try {
        const usersCol = db.collection<UserDoc>(USERS_COLLECTION);
        await usersCol.updateOne(
          { username: user.username },
          { $set: { passwordHash: newPasswordHash, updatedAt: new Date() } }
        );
      } catch {}
    }

    // 3. Bersihkan permintaan pending jika ada
    try {
      await pool.query(
        `DELETE FROM password_change_requests WHERE user_id = $1 OR username = $2`,
        [numericId || -1, user.username]
      );
    } catch {}

    return {
      id: 0,
      status: "approved",
      directUpdate: true,
      message: "Password Administrator berhasil diperbarui dan langsung aktif."
    };
  }

  // 4. Check if pending request exists
  const existingPending = await pool.query(
    numericId
      ? `SELECT id FROM password_change_requests WHERE (user_id = $1 OR username = $2) AND status = 'pending' LIMIT 1`
      : `SELECT id FROM password_change_requests WHERE username = $1 AND status = 'pending' LIMIT 1`,
    numericId ? [numericId, user.username] : [user.username]
  );

  let requestId: number;
  if (existingPending.rows.length > 0) {
    requestId = existingPending.rows[0].id;
    await pool.query(
      `UPDATE password_change_requests 
       SET new_password_hash = $1, requested_at = NOW(), notes = NULL
       WHERE id = $2`,
      [newPasswordHash, requestId]
    );
  } else {
    let finalUserId = numericId;
    if (!finalUserId) {
      const uRes = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [user.username]);
      if (uRes.rows.length > 0) {
        finalUserId = uRes.rows[0].id;
      } else {
        const insU = await pool.query(
          `INSERT INTO users (username, name, email, role, password_hash, status)
           VALUES ($1, $2, $3, $4, '', 'active') RETURNING id`,
          [user.username, user.name, user.email || `${user.username}@widatra.co`, user.role]
        );
        finalUserId = insU.rows[0].id;
      }
    }

    const insRes = await pool.query(
      `INSERT INTO password_change_requests (user_id, username, user_name, user_role, new_password_hash, status, requested_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING id`,
      [finalUserId, user.username, user.name, user.role, newPasswordHash]
    );
    requestId = insRes.rows[0].id;
  }

  return {
    id: requestId,
    status: "pending",
    message: "Permintaan ganti password berhasil diajukan ke Administrator dan menunggu persetujuan."
  };
};

export const getMyPasswordRequest = async (userId: string) => {
  const pool = getPostgresPool();
  const user = await getUserById(userId);
  const username = user?.username || userId;
  const isNum = !isNaN(Number(userId));

  const res = await pool.query(
    `SELECT id, user_id, username, user_name, user_role, status, requested_at, reviewed_by, reviewed_at, notes
     FROM password_change_requests
     WHERE (user_id = $1 OR username = $2)
     ORDER BY requested_at DESC
     LIMIT 1`,
    [isNum ? Number(userId) : -1, username]
  );

  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    userId: String(r.user_id),
    username: r.username,
    userName: r.user_name,
    userRole: r.user_role,
    status: r.status,
    requestedAt: r.requested_at,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    notes: r.notes
  };
};

export const cancelMyPasswordRequest = async (userId: string, requestId?: number) => {
  const pool = getPostgresPool();
  const user = await getUserById(userId);
  const username = user?.username || userId;
  const isNum = !isNaN(Number(userId));

  const res = await pool.query(
    `UPDATE password_change_requests
     SET status = 'cancelled', reviewed_at = NOW(), notes = 'Dibatalkan oleh pemohon'
     WHERE status = 'pending' AND (user_id = $1 OR username = $2) ${requestId ? "AND id = $3" : ""}
     RETURNING id`,
    requestId ? [isNum ? Number(userId) : -1, username, requestId] : [isNum ? Number(userId) : -1, username]
  );

  return { success: res.rows.length > 0 };
};

export const listPasswordChangeRequests = async (status?: string, limit: number = 50) => {
  const pool = getPostgresPool();
  let query = `
    SELECT id, user_id, username, user_name, user_role, status, requested_at, reviewed_by, reviewed_at, notes
    FROM password_change_requests
  `;
  const params: any[] = [];
  if (status && status !== "all") {
    query += ` WHERE status = $1`;
    params.push(status);
  }
  query += ` ORDER BY requested_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await pool.query(query, params);
  return res.rows.map((r: any) => ({
    id: r.id,
    userId: String(r.user_id),
    username: r.username,
    userName: r.user_name,
    userRole: r.user_role,
    status: r.status,
    requestedAt: r.requested_at,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    notes: r.notes
  }));
};

export const reviewPasswordChangeRequest = async (
  requestId: number,
  input: ReviewPasswordChangeInput,
  reviewer: { id: string; username?: string; name?: string }
) => {
  const pool = getPostgresPool();
  const reqRes = await pool.query(
    `SELECT id, user_id, username, new_password_hash, status FROM password_change_requests WHERE id = $1 LIMIT 1`,
    [requestId]
  );

  if (reqRes.rows.length === 0) {
    throw createError("Permintaan ganti password tidak ditemukan", 404);
  }

  const request = reqRes.rows[0];
  if (request.status !== "pending") {
    throw createError(`Permintaan ini sudah diproses dengan status '${request.status}'`, 400);
  }

  const reviewerName = reviewer.username || reviewer.name || reviewer.id;

  if (input.action === "approve") {
    // 1. Mark request as approved
    await pool.query(
      `UPDATE password_change_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), notes = $2
       WHERE id = $3`,
      [reviewerName, input.notes || "Disetujui oleh Administrator", requestId]
    );

    // 2. Update user's password in PostgreSQL
    await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [request.new_password_hash, request.user_id]
    );

    // 3. Sync to MongoDB if user exists in mongo
    const db = getMongoDb();
    if (db) {
      try {
        const usersCol = db.collection<UserDoc>(USERS_COLLECTION);
        await usersCol.updateOne(
          { username: request.username },
          { $set: { passwordHash: request.new_password_hash, updatedAt: new Date() } }
        );
      } catch {}
    }

    return {
      success: true,
      status: "approved",
      message: `Password pengguna @${request.username} berhasil disetujui dan diperbarui.`
    };
  } else {
    // Reject
    await pool.query(
      `UPDATE password_change_requests
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), notes = $2
       WHERE id = $3`,
      [reviewerName, input.notes || "Ditolak oleh Administrator", requestId]
    );

    return {
      success: true,
      status: "rejected",
      message: `Permintaan ganti password pengguna @${request.username} ditolak.`
    };
  }
};

