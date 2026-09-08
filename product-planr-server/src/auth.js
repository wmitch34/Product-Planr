const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { db } = require("./db");

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = "product_planr_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
};
const verifyPassword = async (password, encoded) => {
  const [algorithm, n, r, p, encodedSalt, encodedKey] =
    String(encoded).split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey) return false;
  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedKey, "base64url");
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return (
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
};
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const createSession = (userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, expiresAt.toISOString(), now.toISOString());
  return { token, expiresAt };
};
const getUserForToken = (token) =>
  token
    ? db
        .prepare(
          "SELECT users.id, users.email, users.created_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
        )
        .get(hashToken(token), new Date().toISOString()) || null
    : null;
const revokeSession = (token) => {
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
};
const parseCookies = (header = "") =>
  Object.fromEntries(
    header.split(";").flatMap((part) => {
      const index = part.indexOf("=");
      return index < 0
        ? []
        : [
            [
              part.slice(0, index).trim(),
              decodeURIComponent(part.slice(index + 1).trim()),
            ],
          ];
    }),
  );
const setSessionCookie = (res, token, expiresAt) =>
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
const clearSessionCookie = (res) =>
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
  );
const requireAuth = (req, res, next) => {
  const user = getUserForToken(
    parseCookies(req.headers.cookie)[SESSION_COOKIE],
  );
  if (!user) return res.status(401).json({ error: "Authentication required" });
  req.user = user;
  return next();
};

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
};
