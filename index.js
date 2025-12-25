const express = require("express");
const app = express();

// Render가 지정해주는 포트를 사용해야 함
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Business Card App is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
