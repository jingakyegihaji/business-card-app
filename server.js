const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "15mb" }));

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TPL_FILE = path.join(DATA_DIR, "templates.json");
const FIELD_FILE = path.join(DATA_DIR, "fields.json");

// ====== Admin Auth ======
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
// 토큰 저장소 (MVP용: 메모리)
// Render 재시작 시 토큰 만료되는 건 의도된 동작(보안상 오히려 좋음)
const tokenStore = new Map(); // token -> { expiresAt:number }

function issueToken(ttlMs = 1000 * 60 * 60 * 12) { // 12시간
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + ttlMs;
  tokenStore.set(token, { expiresAt });
  return { token, expiresAt };
}

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [t, v] of tokenStore.entries()) {
    if (!v || v.expiresAt <= now) tokenStore.delete(t);
  }
}

function requireAdmin(req, res, next) {
  cleanExpiredTokens();

  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;

  if (!token) return res.status(401).json({ error: "Missing token" });

  const rec = tokenStore.get(token);
  if (!rec) return res.status(401).json({ error: "Invalid token" });
  if (rec.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ error: "Token expired" });
  }

  next();
}

// ====== utils ======
function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ====== seed data ======
if (!fs.existsSync(FIELD_FILE)) {
  writeJSON(FIELD_FILE, [
    { key: "name", label: "이름", required: true },
    { key: "title", label: "직함", required: false },
    { key: "company", label: "회사", required: true },
    { key: "phone", label: "전화", required: true },
    { key: "email", label: "이메일", required: false }
  ]);
}
if (!fs.existsSync(TPL_FILE)) {
  writeJSON(TPL_FILE, []);
}

// ====== static ======
app.use(express.static(PUBLIC_DIR, { etag: false }));

// ====== public APIs ======
app.get("/api/fields", (req, res) => {
  res.json(readJSON(FIELD_FILE, []));
});

app.get("/api/templates", (req, res) => {
  res.json(readJSON(TPL_FILE, []));
});

// ====== admin auth APIs ======
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "password is required" });
  }
  if (password !== ADMIN_PASSWORD) {
    // 보안상 자세한 정보 X
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const { token, expiresAt } = issueToken();
  return res.json({ token, expiresAt });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  tokenStore.delete(token);
  res.json({ ok: true });
});

// ====== admin APIs (보호됨) ======
app.post("/api/admin/fields", requireAdmin, (req, res) => {
  writeJSON(FIELD_FILE, req.body);
  res.json({ ok: true });
});

app.post("/api/admin/templates", requireAdmin, (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = {
    id: crypto.randomUUID(),
    name: req.body?.name || "New Template",
    backgroundUrl: "",
    fields: {}
  };
  list.push(tpl);
  writeJSON(TPL_FILE, list);
  res.json(tpl);
});

app.post("/api/admin/templates/:id", requireAdmin, (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = list.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "Template not found" });

  Object.assign(tpl, req.body);
  writeJSON(TPL_FILE, list);
  res.json({ ok: true });
});

app.post("/api/admin/templates/:id/upload", requireAdmin, (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== "string") {
    return res.status(400).json({ error: "dataUrl is required" });
  }

  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: "Invalid dataUrl format" });

  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 2000) return res.status(400).json({ error: "Image too small" });

  const file = `tpl_${Date.now()}_${crypto.randomUUID()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);

  const list = readJSON(TPL_FILE, []);
  const tpl = list.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "Template not found" });

  tpl.backgroundUrl = `/uploads/${file}`;
  writeJSON(TPL_FILE, list);

  res.json({ url: tpl.backgroundUrl });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
