import { createContext } from "@hate_evidence_copilot/api/context";
import { renderPacketPdf } from "@hate_evidence_copilot/api/packet-pdf";
import {
	buildIncidentPacket,
	loadIncidentDetail,
} from "@hate_evidence_copilot/api/routers/incident";
import { appRouter } from "@hate_evidence_copilot/api/routers/index";
import { visibleIncidents } from "@hate_evidence_copilot/api/routers/visibility";
import { resolveStoragePath } from "@hate_evidence_copilot/api/storage";
import { auth } from "@hate_evidence_copilot/auth";
import {
	db,
	evidence,
	evidenceAsset,
	incident,
} from "@hate_evidence_copilot/db";
import { and, eq } from "@hate_evidence_copilot/db/sql";
import { env } from "@hate_evidence_copilot/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * Serves uploaded evidence from local disk. Auth + incident visibility are
 * checked before the path is resolved so storage keys are not guessable URLs.
 */
app.get("/files/*", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.text("Unauthorized", 401);
	}

	const storageKey = decodeURIComponent(c.req.path.replace(/^\/files\//, ""));
	if (!storageKey || storageKey.includes("..")) {
		return c.text("Not found", 404);
	}

	const [asset] = await db
		.select({
			storageKey: evidenceAsset.storageKey,
			mimeType: evidenceAsset.mimeType,
			fileName: evidenceAsset.fileName,
		})
		.from(evidenceAsset)
		.innerJoin(evidence, eq(evidence.id, evidenceAsset.evidenceId))
		.innerJoin(incident, eq(incident.id, evidence.incidentId))
		.where(
			and(
				eq(evidenceAsset.storageKey, storageKey),
				visibleIncidents(session.user.id),
			),
		)
		.limit(1);

	if (!asset) {
		return c.text("Not found", 404);
	}

	const absolute = resolveStoragePath(asset.storageKey);
	const file = Bun.file(absolute);
	if (!(await file.exists())) {
		return c.text("Not found", 404);
	}

	return new Response(file, {
		headers: {
			"Content-Type": asset.mimeType ?? "application/octet-stream",
			"Content-Disposition": `inline; filename="${asset.fileName ?? "evidence"}"`,
			"Cache-Control": "private, max-age=3600",
		},
	});
});

/**
 * The Evidence Packet as a PDF. Same snapshot as `incident.packet` (JSON), just
 * rendered — a plain GET so the browser downloads a real file. Visibility is
 * enforced by `loadIncidentDetail`, which scopes the read to the session user.
 */
app.get("/packets/:id", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.text("Unauthorized", 401);
	}

	/** The `.pdf` suffix is cosmetic: Hono keeps it in the param, so strip it. */
	const incidentId = c.req.param("id").replace(/\.pdf$/, "");

	try {
		const row = await loadIncidentDetail(db, session.user.id, incidentId);
		const pdf = await renderPacketPdf(buildIncidentPacket(row));

		return new Response(pdf, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${row.referenceCode}-evidence-packet.pdf"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error(error);
		return c.text("Not found", 404);
	}
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

export default app;
