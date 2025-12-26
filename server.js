console.log("BOOT MARKER 2025-12-26 A");
console.log("BOOT: server.js is running");
console.log("BOOT: routes include /api/test-email");
const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/api/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(",").toUpperCase();
      routes.push(`${methods} ${m.route.path}`);
    }
  });
  res.json({ ok: true, routes });
});

/**
 * ✅ Resend 연결 테스트 (첨부 없이 메일만)
 * 브라우저에서: https://<너서비스주소>/api/test-email
 */
app.get("/api/test-email", async (req, res) => {
  try {
    const required = ["RESEND_API_KEY", "MAIL_FROM", "ADMIN_EMAIL"];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
      return res.status(500).json({ ok: false, error: "Missing env: " + missing.join(", ") });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [process.env.ADMIN_EMAIL],
        subject: "Resend 테스트 메일",
        text: "이 메일이 오면 Resend API 연동은 정상입니다."
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(500).json({
        ok: false,
        error: data?.message || data?.error || JSON.stringify(data)
      });
    }

    return res.json({ ok: true, data });
  } catch (e) {
    console.error("TEST EMAIL FAIL:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/**
 * ✅ 실제 전송: 브라우저에서 PDF 업로드 받아서 고정 이메일로 전송
 */
app.post("/api/save", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "pdf missing" });

    const required = ["RESEND_API_KEY", "MAIL_FROM", "ADMIN_EMAIL"];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
      return res.status(500).json({ ok: false, error: "Missing env: " + missing.join(", ") });
    }

    const base64 = req.file.buffer.toString("base64");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [process.env.ADMIN_EMAIL],
        subject: "명함 저장 요청 (PDF)",
        text: "브라우저에서 생성된 명함 PDF입니다.",
        attachments: [
          {
            filename: req.file.originalname || "business_card.pdf",
            content: base64
          }
        ]
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(500).json({
        ok: false,
        error: data?.message || data?.error || JSON.stringify(data) || "Resend API failed"
      });
    }

    return res.json({ ok: true, data });
  } catch (e) {
    console.error("SAVE FAIL:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BOOT MARKER 2025-12-26 B - Server running on", PORT));

