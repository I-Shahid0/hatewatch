import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage for the hackathon. Keys are relative paths under this root
 * so they can later be swapped for an S3/R2 object key without schema changes.
 */
export const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export function resolveStoragePath(storageKey: string): string {
	const resolved = path.resolve(STORAGE_ROOT, storageKey);
	if (
		resolved !== STORAGE_ROOT &&
		!resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)
	) {
		throw new Error("Invalid storage key.");
	}
	return resolved;
}

function sanitizeFileName(name: string): string {
	const base = path.basename(name).replace(/[^\w.\-()+ ]+/g, "_");
	return base.length > 0 ? base.slice(0, 180) : "upload.bin";
}

export async function storeEvidenceFile(input: {
	incidentId: string;
	evidenceId: string;
	file: File;
}): Promise<{
	storageKey: string;
	fileName: string;
	mimeType: string | null;
	byteSize: number;
	sha256: string;
}> {
	const fileName = sanitizeFileName(input.file.name || "upload.bin");
	const storageKey = path.posix.join(
		input.incidentId,
		input.evidenceId,
		fileName,
	);
	const absolute = resolveStoragePath(storageKey);
	await mkdir(path.dirname(absolute), { recursive: true });

	const buffer = Buffer.from(await input.file.arrayBuffer());
	const sha256 = createHash("sha256").update(buffer).digest("hex");
	await writeFile(absolute, buffer);

	return {
		storageKey,
		fileName,
		mimeType: input.file.type || null,
		byteSize: buffer.byteLength,
		sha256,
	};
}

export async function removeStoredFile(storageKey: string): Promise<void> {
	try {
		await unlink(resolveStoragePath(storageKey));
	} catch {
		/* best-effort cleanup after a failed transaction */
	}
}
