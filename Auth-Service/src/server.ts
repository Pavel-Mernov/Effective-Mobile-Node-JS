import app from "./app";
import { PORT } from "./env";

app.listen(PORT, () => {
  console.log(`Auth service running on ${PORT}`);
});