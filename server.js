import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`BagCartel store running on http://localhost:${port}`);
});
