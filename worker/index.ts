import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
