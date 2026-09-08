const express = require("express");
const routes = require("./routes");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use("/api", routes);
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Malformed JSON" });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res
    .status(status)
    .json({ error: status >= 500 ? "Internal server error" : error.message });
});

module.exports = app;
