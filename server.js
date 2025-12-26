const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "20mb" }));

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TPL_FILE = path.join(DATA_DIR, "templates.json");
const FIELD_FILE = path.join(DATA_DIR, "fields.json");

// ===== Admin Auth =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const tokenStore = new Map();

function issueToken(ttlMs = 1000 * 60 * 60 * 12) {
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
  const token = m ? m[1] : "";
  if (!token) return res.status(401).json({ error: "Missing token" });

  const rec = tokenStore.get(token);
  if (!rec) return res.status(401).json({ error: "Invalid token" });

  if (rec.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ error: "Token expired" });
  }
  next();
}

// ===== utils =====
function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== seed =====
if (!fs.existsSync(FIELD_FILE)) {
  writeJSON(FIELD_FILE, [
    { key: "name", label: "이름", type: "text", required: true, placeholder: "" },
    { key: "title", label: "직함", type: "text", required: false, placeholder: "" },
    { key: "company", label: "회사", type: "text", required: true, placeholder: "" },
    { key: "mobile", label: "휴대폰", type: "tel", required: false, placeholder: "+82 10-0000-0000" },
    { key: "office_phone", label: "사무실 전화", type: "tel", required: false, placeholder: "02-000-0000" },
    { key: "fax", label: "FAX", type: "tel", required: false, placeholder: "02-000-0000" },
    { key: "email", label: "이메일", type: "email", required: false, placeholder: "hello@example.com" },
    { key: "address", label: "주소", type: "text", required: false, placeholder: "" }
  ]);
}
if (!fs.existsSync(TPL_FILE)) writeJSON(TPL_FILE, []);

app.use(express.static(PUBLIC_DIR, { etag: false }));

// ===== public APIs =====
app.get("/api/fields", (req, res) => res.json(readJSON(FIELD_FILE, [])));
app.get("/api/templates", (req, res) => res.json(readJSON(TPL_FILE, [])));

// ===== admin auth =====
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== "string") return res.status(400).json({ error: "password is required" });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid credentials" });
  res.json(issueToken());
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  tokenStore.delete(token);
  res.json({ ok: true });
});

// ===== admin: field catalog =====
app.post("/api/admin/fields", requireAdmin, (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [];
  // 최소 검증
  const keys = new Set();
  for (const f of list) {
    const k = String(f.key || "").trim();
    if (!k) return res.status(400).json({ error: "Field key required" });
    if (keys.has(k)) return res.status(400).json({ error: "Duplicate key: " + k });
    keys.add(k);
  }
  writeJSON(FIELD_FILE, list);
  res.json({ ok: true });
});

// ===== admin: templates =====
app.post("/api/admin/templates", requireAdmin, (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = {
    id: crypto.randomUUID(),
    name: req.body?.name || "New Template",
    size: { w: 720, h: 400 },
    backgroundUrl: "",
    enabledFields: [], // ✅ 템플릿별 입력 필드 선택
    fields: {}         // ✅ 위치/스타일
  };
  list.push(tpl);
  writeJSON(TPL_FILE, list);
  res.json(tpl);
});

app.post("/api/admin/templates/:id", requireAdmin, (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = list.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ error: "Template not found" });

  const patch = req.body || {};
  if (typeof patch.name === "string") tpl.name = patch.name;
  if (typeof patch.backgroundUrl === "string") tpl.backgroundUrl = patch.backgroundUrl;
  if (patch.size && typeof patch.size === "object") tpl.size = patch.size;

  if (Array.isArray(patch.enabledFields)) tpl.enabledFields = patch.enabledFields;
  if (patch.fields && typeof patch.fields === "object") tpl.fields = patch.fields;

  writeJSON(TPL_FILE, list);
  res.json({ ok: true });
});

app.post("/api/admin/templates/:id/upload", requireAdmin, (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== "string") return res.status(400).json({ error: "dataUrl is required" });

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

// ===== preview upload for email =====
app.post("/api/upload-preview", (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") return res.status(400).json({ error: "dataUrl is required" });

    const m = dataUrl.match(/^data:(image\/jpeg|image\/png);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: "Invalid dataUrl format" });

    const ext = m[1] === "image/png" ? "png" : "jpg";
    const fileName = `card_${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const buf = Buffer.from(m[2], "base64");
    if (buf.length < 2000) return res.status(400).json({ error: "Image too small" });

    fs.writeFileSync(filePath, buf);
    res.json({ url: `/uploads/${fileName}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
