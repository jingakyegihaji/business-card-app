const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

// dataURL 크기 대비 넉넉히
app.use(express.json({ limit: "15mb" }));

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 정적 파일 서빙 (public/index.html 포함)
app.use(express.static(PUBLIC_DIR, { etag: false }));

// 업로드 API: dataURL 받아서 /public/uploads에 저장 후 URL 반환
app.post("/api/upload-preview", (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "dataUrl is required" });
    }

    const m = dataUrl.match(/^data:(image\/jpeg|image\/png);base64,(.+)$/);
    if (!m) {
      return res.status(400).json({ error: "Invalid dataUrl format" });
    }

    const mime = m[1];
    const b64 = m[2];
    const ext = mime === "image/png" ? "png" : "jpg";

    const fileName = `card_${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const buf = Buffer.from(b64, "base64");
    if (buf.length < 2000) {
      return res.status(400).json({ error: "Image buffer too small (capture failed?)" });
    }

    fs.writeFileSync(filePath, buf);

    // 브라우저/메일에서 접근할 경로
    res.json({ url: `/uploads/${fileName}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// SPA라면 라우팅 fallback (필요 없으면 지워도 됨)
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
