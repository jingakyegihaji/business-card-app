const express = require("express");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/save", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: "명함 저장 요청 (PDF)",
      text: "브라우저에서 생성된 명함 PDF입니다.",
      attachments: [
        {
          filename: req.file.originalname || "business_card.pdf",
          content: req.file.buffer,
          contentType: "application/pdf"
        }
      ]
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
