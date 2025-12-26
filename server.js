const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TPL_FILE = path.join(DATA_DIR, "templates.json");
const FIELD_FILE = path.join(DATA_DIR, "fields.json");

// ---------- utils ----------
function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- 초기 데이터 ----------
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

// ---------- static ----------
app.use(express.static(PUBLIC_DIR));

// ---------- public APIs ----------
app.get("/api/fields", (req, res) => {
  res.json(readJSON(FIELD_FILE, []));
});

app.get("/api/templates", (req, res) => {
  res.json(readJSON(TPL_FILE, []));
});

// ---------- admin APIs ----------
app.post("/api/admin/fields", (req, res) => {
  writeJSON(FIELD_FILE, req.body);
  res.json({ ok: true });
});

app.post("/api/admin/templates", (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = {
    id: crypto.randomUUID(),
    name: req.body.name || "New Template",
    backgroundUrl: "",
    fields: {}
  };
  list.push(tpl);
  writeJSON(TPL_FILE, list);
  res.json(tpl);
});

app.post("/api/admin/templates/:id", (req, res) => {
  const list = readJSON(TPL_FILE, []);
  const tpl = list.find(t => t.id === req.params.id);
  Object.assign(tpl, req.body);
  writeJSON(TPL_FILE, list);
  res.json({ ok: true });
});

app.post("/api/admin/templates/:id/upload", (req, res) => {
  const { dataUrl } = req.body;
  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  const buf = Buffer.from(m[2], "base64");
  const file = `tpl_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);

  const list = readJSON(TPL_FILE, []);
  const tpl = list.find(t => t.id === req.params.id);
  tpl.backgroundUrl = `/uploads/${file}`;
  writeJSON(TPL_FILE, list);

  res.json({ url: tpl.backgroundUrl });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
