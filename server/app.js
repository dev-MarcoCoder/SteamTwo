import express from "express";
import path from "node:path";

export function createApp({ apiRouter, staticDir } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  if (apiRouter) app.use("/api", apiRouter);

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(path.resolve(staticDir, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    const isValidationError = error?.name === "ZodError";
    const status = Number(error.status ?? (isValidationError ? 400 : 500));
    response.status(status).json({
      error: status >= 500 ? "Erro interno do servidor" : error.message,
      ...(isValidationError ? { details: error.issues } : {}),
    });
  });

  return app;
}
