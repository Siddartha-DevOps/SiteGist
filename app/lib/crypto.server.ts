/**
 * At-rest encryption for sensitive secrets (currently Integration OAuth tokens).
 *
 * AES-256-GCM with a key derived from ENCRYPTION_KEY. Values are stored as
 * `enc:v1:<iv>:<tag>:<ciphertext>` (all base64). Both functions are
 * backward-compatible and gated on ENCRYPTION_KEY:
 *   - If ENCRYPTION_KEY is unset, encrypt is a no-op (stores plaintext) and
 *     decrypt returns input unchanged — i.e. exactly the current behaviour.
 *   - When set, new writes are encrypted; reads transparently decrypt both new
 *     ciphertext and any legacy plaintext rows, so it's a safe rolling migration.
 *
 * The `integrationCryptoExtension` wires this into Prisma so every read/write of
 * Integration.accessToken / refreshToken is handled centrally — no call site
 * needs to change, and none can be accidentally missed.
 */
import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  // Accept any string/hex/base64 and derive a stable 32-byte key.
  return crypto.createHash("sha256").update(raw).digest();
}

let warnedNoEncryptionKey = false;

export function encryptSecret<T extends string | null | undefined>(plain: T): T {
  if (typeof plain !== "string" || plain === "") return plain;
  if (plain.startsWith(PREFIX)) return plain; // already encrypted
  const key = getKey();
  if (!key) {
    // Surface (once) that we're persisting a real secret unencrypted in production.
    if (!warnedNoEncryptionKey && process.env.NODE_ENV === "production") {
      warnedNoEncryptionKey = true;
      console.warn(
        "[crypto] SECURITY: ENCRYPTION_KEY is not set — integration OAuth tokens are " +
        "being stored in PLAINTEXT. Set ENCRYPTION_KEY to encrypt secrets at rest."
      );
    }
    return plain; // encryption disabled → store as-is
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (PREFIX + [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":")) as T;
}

export function decryptSecret<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return value; // no key to decrypt with → return as-is
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
    return out.toString("utf8") as T;
  } catch (e: any) {
    console.error("[crypto] decrypt failed:", e?.message);
    return value;
  }
}

const SECRET_FIELDS = ["accessToken", "refreshToken"] as const;

function encData(data: any): any {
  if (!data || typeof data !== "object") return data;
  for (const f of SECRET_FIELDS) {
    if (typeof data[f] === "string") data[f] = encryptSecret(data[f]);
  }
  return data;
}

function decRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  for (const f of SECRET_FIELDS) {
    if (typeof row[f] === "string") row[f] = decryptSecret(row[f]);
  }
  return row;
}

function decResult(res: any): any {
  return Array.isArray(res) ? res.map(decRow) : decRow(res);
}

/**
 * Prisma client extension: encrypt Integration secrets on write, decrypt on read.
 * Pass to `.$extends(...)` on the Prisma client.
 */
export const integrationCryptoExtension = {
  name: "integration-crypto",
  query: {
    integration: {
      async create({ args, query }: any) { encData(args.data); return decResult(await query(args)); },
      async update({ args, query }: any) { encData(args.data); return decResult(await query(args)); },
      async updateMany({ args, query }: any) { encData(args.data); return query(args); },
      async upsert({ args, query }: any) { encData(args.create); encData(args.update); return decResult(await query(args)); },
      async findUnique({ args, query }: any) { return decResult(await query(args)); },
      async findFirst({ args, query }: any) { return decResult(await query(args)); },
      async findMany({ args, query }: any) { return decResult(await query(args)); },
    },
  },
};
