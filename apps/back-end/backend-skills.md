# Backend Skills and Architecture Guide

This document is the default implementation contract for backend work in this repository. Agents must first inspect existing code, then extend the nearest established pattern. Keep the system single-tenant: do not add tenants, memberships, tenant headers, tenant resolution, or tenant-scoped database filters unless the product requirements explicitly change.

## Stack and boundaries

- TypeScript with strict types.
- Hono for HTTP APIs.
- `@hono/zod-openapi` for typed routes and OpenAPI documentation.
- Zod for runtime validation.
- Drizzle ORM with PostgreSQL.
- Better Auth, or the authentication provider already configured in the repository.
- Pino for structured logging.
- Services for business workflows; repositories for database access.

Use this dependency direction:

```text
route -> service -> repository -> database
  |         |          |
  |         |          +-- persistence only
  |         +------------- business rules and workflows
  +----------------------- HTTP, validation, authorization context
```

Routes must not contain large queries or business workflows. Repositories must not know about HTTP. Services must not format HTTP responses.

## Recommended project structure

```text
src/
├── app.ts
├── index.ts
├── routes/
│   ├── index.ts
│   └── v1/
├── services/
├── repositories/
├── db/
│   ├── index.ts
│   ├── schema/
│   └── migrations/
├── middlewares/
├── lib/
│   ├── auth.ts
│   ├── env.ts
│   ├── errors/
│   └── logger/
├── utils/
└── types/
```

## Authentication and authorization

Authentication answers “who is the caller?” Authorization answers “what may they do?”. Keep them separate.

Use a session middleware to load the authenticated user and session into the Hono context:

```ts
const result = await auth.api.getSession({ headers: c.req.raw.headers });
c.set("user", result?.user ?? null);
c.set("session", result?.session ?? null);
await next();
```

Protected routes must use a shared middleware such as `requireAuth`. Do not read identity from request bodies, query parameters, or client-provided role fields.

Use a permission-aware middleware for protected operations:

```ts
requirePermission("patients.read");
requirePermission("patients.create");
requirePermission("patients.update");
requirePermission("patients.delete");
```

Authorization rules:

- Resolve roles and permissions from the authenticated user and server-side data.
- Never trust client-provided roles or permissions.
- Return `401` when there is no authenticated user.
- Return `403` when the user is authenticated but lacks permission.
- Apply record-level ownership or assignment checks in the service layer.
- Return `404` for records the caller is not allowed to discover when appropriate.
- Keep super-admin or platform-level access in a separate explicit middleware if the product needs it.

Example context shape:

```ts
type AppVariables = {
	user: AuthUser | null;
	session: AuthSession | null;
	role: string | null;
	permissions: string[] | null;
};
```

## Route and API documentation style

Every endpoint should be an OpenAPI route with validated input and documented responses:

```ts
const listRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List patients",
	middleware: [requirePermission("patients.read")],
	request: {
		query: z.object({
			search: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			pageSize: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	responses: {
		200: {
			description: "Paginated patients",
			content: { "application/json": { schema: listResponseSchema } },
		},
	},
});

router.openapi(listRoute, async (c) => {
	const query = c.req.valid("query");
	const result = await patientService.list(query);
	return successResponse(c, result);
});
```

Use API versioning such as `/api/v1`. Register each resource router from the version router. Keep authentication routes, webhooks, and platform routes separate from ordinary protected resource routes.

Document:

- Summary and description.
- Path parameters.
- Query parameters.
- Request body schema.
- Success response schema for every status code.
- Common `400`, `401`, `403`, `404`, and `409` responses where relevant.

## Structured response format

All successful application responses use:

```json
{
	"success": true,
	"data": {}
}
```

Use the shared helper:

```ts
return successResponse(c, data);
return successResponse(c, created, 201);
```

All expected errors use:

```json
{
	"success": false,
	"error": {
		"code": "NOT_FOUND",
		"message": "Patient not found",
		"details": {}
	}
}
```

Use `AppError` and the global error handler:

```ts
throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
```

Do not return ad-hoc shapes such as `{ error: "Unauthorized" }` from individual routes when the shared response contract is available.

## Error handling

Use stable error codes such as:

```ts
BAD_REQUEST;
VALIDATION_ERROR;
UNAUTHORIZED;
FORBIDDEN;
NOT_FOUND;
CONFLICT;
INTERNAL_SERVER_ERROR;
```

Expected domain failures must use `AppError`. Unexpected errors are handled centrally, logged with context, and exposed as a generic `500` response in production. Never expose stack traces, SQL, credentials, tokens, or internal implementation details to clients.

Use status codes consistently:

- `400`: malformed or invalid business input.
- `401`: missing or invalid authentication.
- `403`: insufficient permissions.
- `404`: missing or inaccessible resource.
- `409`: duplicate or conflicting state.
- `422`: semantically invalid input when the API uses this distinction.
- `500`: unexpected server failure.

## Services

Services contain business rules and coordinate repositories.

```ts
export class AppointmentService {
	async create(userId: string, input: CreateAppointmentInput) {
		const startAt = new Date(input.startAt);
		const endAt = new Date(input.endAt);

		if (Number.isNaN(startAt.getTime()) || endAt <= startAt) {
			throw new AppError(
				"Invalid appointment time",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const patient = await patientRepository.findById(input.patientId);
		if (!patient) {
			throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
		}

		// Validate conflicts and related records before writing.
		// Use a transaction when several writes must succeed together.
		return appointmentRepository.create({ ...input, startAt, endAt, userId });
	}
}
```

Services should:

- Validate cross-record relationships.
- Enforce state transitions and conflict rules.
- Coordinate multiple repositories.
- Use transactions for atomic workflows.
- Throw typed `AppError` instances.
- Accept explicit typed inputs and return domain/database objects.

Avoid putting business logic in route handlers or repositories.

## Repositories

Repositories contain Drizzle queries and persistence concerns only:

```ts
export class PatientRepository {
	async findById(id: string): Promise<Patient | null> {
		const [row] = await db
			.select()
			.from(patients)
			.where(and(eq(patients.id, id), isNull(patients.deletedAt)))
			.limit(1);

		return row ?? null;
	}

	async list(params: ListPatientsParams): Promise<Patient[]> {
		return db
			.select()
			.from(patients)
			.where(/* typed filters */)
			.orderBy(desc(patients.createdAt))
			.limit(params.limit)
			.offset(params.offset);
	}
}
```

Repository rules:

- Scope queries by the relevant record owner or relationship.
- Exclude `deletedAt` rows from normal reads.
- Keep filtering, sorting, pagination, and persistence here.
- Provide matching `list` and `count` filters.
- Return `null` for a missing single record and arrays for collections.
- Do not throw HTTP errors or return Hono responses.
- Use transactions when passed a transaction database instance or when coordinated by a service.

## Database design principles

Use Drizzle schema definitions as the source of truth for application tables.

Every table should consider:

- A stable primary key.
- Explicit foreign keys with appropriate delete behavior.
- `createdAt` and `updatedAt` timestamps.
- `deletedAt` for recoverable entities where appropriate.
- Unique constraints for business identifiers.
- Indexes for foreign keys and frequent filters.
- Explicit enums for stable finite states.
- Nullable columns only when `null` has real domain meaning.
- Database constraints for invariants that must never be violated.

Prefer normalized relational data. Store JSON only for genuinely flexible metadata, not for fields that need querying, validation, or relationships.

For status-based entities, define valid transitions in the service and keep terminal states immutable unless a restore operation is explicitly supported.

When changing the schema:

1. Update the appropriate schema file.
2. Add or generate the migration using the repository’s existing command.
3. Update inferred types and relations.
4. Update repositories and OpenAPI schemas.
5. Verify indexes and constraints.

Never silently change production data or delete columns without an explicit migration plan.

## Mapping and pagination

Do not expose raw database rows by default. Map them to API objects:

```ts
const mapPatient = (row: Patient) => ({
	id: row.id,
	firstName: row.firstName,
	lastName: row.lastName,
	createdAt: row.createdAt.toISOString(),
});
```

Paginated endpoints return:

```json
{
	"items": [],
	"total": 0,
	"page": 1,
	"pageSize": 20
}
```

Default `page` to `1`, default `pageSize` to a reasonable value, and cap it at `100` unless the domain requires another limit. Apply identical filters to both list and count queries.

## Logging and observability

Use the configured structured logger rather than scattered `console.log` calls.

Log useful structured fields:

- Request ID.
- Route and HTTP method.
- Status code and duration.
- Authenticated user ID when available.
- Event/action name.
- Resource type and resource ID.
- Error code and stack for server-side logs.

Never log passwords, OTPs, access tokens, refresh tokens, cookies, authorization headers, or unnecessary personal data. Use the existing redaction configuration.

Use appropriate levels:

- `debug`: development diagnostics.
- `info`: normal lifecycle events.
- `warn`: expected application errors or suspicious requests.
- `error`: unexpected failures and infrastructure problems.

## Auditing

Audit important mutations and security events:

- Create, update, delete, restore.
- Status transitions.
- Login, logout, password, and permission changes.
- Sensitive record access when required by the domain.

Audit entries should include the actor, action, resource type, resource ID, timestamp, and safe before/after values. Never include credentials or tokens.

## Implementation workflow for agents

For every feature:

1. Inspect the closest existing route, service, repository, schema, middleware, and test.
2. Identify the required API contract and authorization rules.
3. Design schema changes and migrations first when persistence is involved.
4. Implement repository methods.
5. Implement service business rules and transactions.
6. Implement OpenAPI route schemas and handlers.
7. Add response mapping, audit events, and logs.
8. Register the router in the correct API version.
9. Run formatting, linting, type checking, and relevant tests.
10. Review the diff for missing authorization, inconsistent responses, unsafe logs, and incomplete migrations.

Before finishing, confirm:

- Authentication is applied to every protected route.
- Authorization is enforced server-side.
- No client-provided role or user identity is trusted.
- All input is validated with Zod.
- All responses follow the standard envelope.
- Expected failures use `AppError`.
- Database queries are typed and correctly constrained.
- Soft-deleted records are excluded where required.
- List and count filters match.
- Mutations are audited when appropriate.
- OpenAPI documentation matches runtime behavior.
- `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` pass, plus relevant tests.

If an existing repository convention conflicts with this guide, preserve the repository convention and document the deviation in the implementation summary.
