const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

// dataURL 업로드 대비 (필요하면 20mb까지 올려도 됨)
app.use(express.json({ limit: "15mb" }));

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

// uploads 폴더 없으면 생성
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 정적 파일 서빙 (public/index.html, public/uploads/* 포함)
app.use(express.static(PUBLIC_DIR, { etag: false }));

/**
 * POST /api/upload-preview
 * body: { dataUrl: "data:image/jpeg;base64,...." }
 * return: { url: "/uploads/xxx.jpg" }
 */
app.post("/api/upload-preview", (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "dataUrl is required" });
    }

    // jpeg/png만 허용
    const match = dataUrl.match(/^data:(image\/jpeg|image\/png);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid dataUrl format (jpeg/png base64 only)" });
    }

    const mime = match[1];
    const b64 = match[2];
    const ext = mime === "image/png" ? "png" : "jpg";

    const fileName = `card_${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const buf = Buffer.from(b64, "base64");

    // 캡쳐가 실패하면 아주 작은 버퍼가 나올 수 있음
    if (buf.length < 2000) {
      return res.status(400).json({ error: "Image buffer too small (capture failed?)" });
    }

    fs.writeFileSync(filePath, buf);

    // public/uploads 아래로 노출됨
    return res.json({ url: `/uploads/${fileName}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// SPA fallback (필요 없으면 지워도 되지만, 안전하게 둠)
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
