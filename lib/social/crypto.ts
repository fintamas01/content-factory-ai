import crypto from "crypto";

type Encrypted = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function getKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");
  }
  // Accept either base64(32 bytes) or hex(32 bytes).
  let buf: Buffer | null = null;
  try {
    buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) buf = null;
  } catch {
    /* ignore */
  }
  if (!buf) {
    try {
      buf = Buffer.from(raw, "hex");
      if (buf.length !== 32) buf = null;
    } catch {
      /* ignore */
    }
  }
  if (!buf) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or hex).");
  }
  return buf;
}

export function encryptToken(plain: string): Encrypted {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM standard nonce size
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptToken(enc: Encrypted): string {
  const key = getKey();
  const iv = Buffer.from(enc.iv, "base64");
  const tag = Buffer.from(enc.tag, "base64");
  const ciphertext = Buffer.from(enc.ciphertext, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

