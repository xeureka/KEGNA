import { OpenAPIHono } from "@hono/zod-openapi";
import v1 from "./v1";

const routes = new OpenAPIHono();
routes.route("/api/v1", v1);
export default routes;
