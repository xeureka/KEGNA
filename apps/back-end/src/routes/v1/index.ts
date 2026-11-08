import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { helloRoute } from "./hello";
import authRouter from "../auth";
import patientsRouter from "./patients";
import doctorsRouter from "./doctors";
import appointmentsRouter from "./appointments";
import proceduresRouter from "./procedures";
import dentalChartRouter from "./dental-chart";
import schedulesRouter from "./schedules";
import medicalRecordsRouter from "./medical-records";
import billingRouter from "./bills";
import reportsRouter from "./reports";
import membersRouter from "./members";
import auditLogsRouter from "./audit-logs";
import dashboardRouter from "./dashboard";
import superAdminRouter from "./super-admin";
import paymentWebhookRouter from "./payment-webhook";
import paymentsRouter from "./payments";
import cardsRouter from "./cards";
import mobileRouter from "./mobile";
import tipsRouter from "./tips";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";

const v1 = new OpenAPIHono<AppEnv>();
const tenantApi = new OpenAPIHono<AppEnv>();
tenantApi.use("*", requireTenantAuth());

v1.openapi(helloRoute, (c) => {
	return c.json({
		success: true as const,
		data: {
			message: "Hello from Nexa CRM API!",
			timestamp: new Date().toISOString(),
		},
	});
});

v1.route("/auth", authRouter);
// Register the platform-scoped routes before the catch-all tenant router.
// Otherwise tenantApi's global requireTenantAuth middleware also intercepts
// /super-admin/* and incorrectly demands an active tenant binding.
v1.route("/super-admin", superAdminRouter);
// The Chapa webhook must also precede the tenant catch-all: Chapa posts without
// a session, and `tenantApi.use("*", requireTenantAuth())` would 401 it before
// the signature could ever be checked.
v1.route("/payments/webhook", paymentWebhookRouter);
v1.route("/payments/chapa", paymentWebhookRouter);
tenantApi.route("/patients", patientsRouter);
tenantApi.route("/doctors", doctorsRouter);
tenantApi.route("/appointments", appointmentsRouter);
tenantApi.route("/procedures", proceduresRouter);
tenantApi.route("/dental-chart", dentalChartRouter);
tenantApi.route("/schedules", schedulesRouter);
tenantApi.route("/medical-records", medicalRecordsRouter);
tenantApi.route("/bills", billingRouter);
tenantApi.route("/reports", reportsRouter);
tenantApi.route("/members", membersRouter);
tenantApi.route("/audit-logs", auditLogsRouter);
tenantApi.route("/dashboard", dashboardRouter);
tenantApi.route("/mobile", mobileRouter);
tenantApi.route("/tips", tipsRouter);
tenantApi.route("/payments", paymentsRouter);
// Alias for the membership card catalog; also reachable under /payments/cards.
tenantApi.route("/cards", cardsRouter);
v1.route("/", tenantApi);

export default v1;
