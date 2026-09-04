import { buildApp } from "./app.js";
import { validateSchemaOnStartup } from "./utils/schema-validation.js";

const start = async () => {
  // Validate database schema before starting server
  await validateSchemaOnStartup();
  
  const app = await buildApp();
  
  try {
    const port = parseInt(process.env.API_PORT || "4000", 10);
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 API server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
