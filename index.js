const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// public 폴더 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// 헬스 체크 유지
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
