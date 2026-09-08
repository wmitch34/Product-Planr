const app = require("./app");
require("./db");

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Product Planr API listening on http://localhost:${port}`);
});
