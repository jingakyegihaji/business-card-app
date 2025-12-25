const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// public 폴더의 index.html을 자동으로 제공
app.use(express.static(path.join(__dirname, "public")));

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
