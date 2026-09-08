const crypto = require("node:crypto");
const express = require("express");
const { db } = require("./db");
const {
  hashPassword,
  verifyPassword,
  createSession,
  parseCookies,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
  requireAuth,
} = require("./auth");
const {
  validateGraphDocument,
  validationError,
  isObject,
} = require("./validation");

const router = express.Router();
const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  createdAt: user.created_at,
});
const readBody = (body) => {
  if (!isObject(body))
    throw validationError("Request body must be a JSON object");
  return body;
};

router.post("/auth/register", async (req, res, next) => {
  try {
    const body = readBody(req.body);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw validationError("A valid email is required");
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 200
    )
      throw validationError("Password must be between 8 and 200 characters");
    const user = {
      id: crypto.randomUUID(),
      email,
      created_at: new Date().toISOString(),
    };
    const passwordHash = await hashPassword(body.password);
    try {
      db.prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      ).run(user.id, user.email, passwordHash, user.created_at);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
        return res.status(409).json({ error: "Email is already registered" });
      throw error;
    }
    const session = createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const body = readBody(req.body);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userRow = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);
    const valid =
      userRow && typeof body.password === "string"
        ? await verifyPassword(body.password, userRow.password_hash)
        : false;
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });
    const session = createSession(userRow.id);
    setSessionCookie(res, session.token, session.expiresAt);
    return res.json({ user: publicUser(userRow) });
  } catch (error) {
    return next(error);
  }
});
router.post("/auth/logout", (req, res) => {
  revokeSession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  clearSessionCookie(res);
  res.status(204).end();
});
router.get("/auth/me", requireAuth, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);
router.use(requireAuth);

const graphFromRow = (row) => {
  let document;
  try {
    document = JSON.parse(row.document_json);
  } catch {
    document = { nodes: [], edges: [] };
  }
  return {
    ...document,
    id: row.id,
    name: row.name,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
const getOwnedGraph = (id, userId) =>
  db
    .prepare("SELECT * FROM graphs WHERE id = ? AND user_id = ?")
    .get(id, userId);
const expectedVersion = (req, body) => {
  const header = req.get("If-Match");
  if (header) return Number(header.replace(/^W\//, "").replace(/^\"|\"$/g, ""));
  return body.version;
};

router.get("/graphs", (req, res) => {
  const graphs = db
    .prepare("SELECT * FROM graphs WHERE user_id = ? ORDER BY updated_at DESC")
    .all(req.user.id);
  res.json({ graphs: graphs.map(graphFromRow) });
});
router.post("/graphs", (req, res, next) => {
  try {
    const body = readBody(req.body);
    const source = isObject(body.document)
      ? { ...body.document, name: body.name ?? body.document.name }
      : body;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const document = validateGraphDocument(source, { id, version: 0 });
    db.prepare(
      "INSERT INTO graphs (id, user_id, name, document_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      req.user.id,
      document.name,
      JSON.stringify(document),
      0,
      now,
      now,
    );
    return res
      .status(201)
      .json(
        graphFromRow({
          id,
          name: document.name,
          document_json: JSON.stringify(document),
          version: 0,
          created_at: now,
          updated_at: now,
        }),
      );
  } catch (error) {
    return next(error);
  }
});
router.get("/graphs/:id", (req, res) => {
  const row = getOwnedGraph(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Graph not found" });
  return res.json(graphFromRow(row));
});
router.patch("/graphs/:id", (req, res, next) => {
  try {
    const body = readBody(req.body);
    const row = getOwnedGraph(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Graph not found" });
    const expected = expectedVersion(req, body);
    if (!Number.isInteger(expected) || expected < 0)
      throw validationError("A graph version is required");
    if (expected !== row.version)
      return res
        .status(409)
        .json({ error: "Graph has changed", current: graphFromRow(row) });
    const current = JSON.parse(row.document_json);
    const source = isObject(body.document)
      ? { ...current, ...body.document }
      : { ...current, ...body };
    const nextVersion = row.version + 1;
    const document = validateGraphDocument(source, {
      id: row.id,
      version: nextVersion,
    });
    const updatedAt = new Date().toISOString();
    const result = db
      .prepare(
        "UPDATE graphs SET name = ?, document_json = ?, version = ?, updated_at = ? WHERE id = ? AND user_id = ? AND version = ?",
      )
      .run(
        document.name,
        JSON.stringify(document),
        nextVersion,
        updatedAt,
        row.id,
        req.user.id,
        expected,
      );
    if (result.changes !== 1)
      return res.status(409).json({ error: "Graph has changed" });
    return res.json(
      graphFromRow({
        ...row,
        name: document.name,
        document_json: JSON.stringify(document),
        version: nextVersion,
        updated_at: updatedAt,
      }),
    );
  } catch (error) {
    return next(error);
  }
});
router.delete("/graphs/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM graphs WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (!result.changes)
    return res.status(404).json({ error: "Graph not found" });
  return res.status(204).end();
});

module.exports = router;
