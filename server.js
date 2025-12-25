const express = require("express");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/save", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "pdf missing" });

    const required = ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","MAIL_FROM","ADMIN_EMAIL"];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
      return res.status(500).json({ ok: false, error: "Missing env: " + missing.join(", ") });
    }

    const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,          // ✅ 587은 무조건 false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  requireTLS: true,       // ✅ STARTTLS 강제
  tls: {
    servername: "smtp.gmail.com"
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000
});


    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: "명함 저장 요청 (PDF)",
      text: "브라우저에서 생성된 명함 PDF입니다.",
      attachments: [{
        filename: req.file.originalname || "business_card.pdf",
        content: req.file.buffer,
        contentType: "application/pdf"
      }]
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("SEND FAIL:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
