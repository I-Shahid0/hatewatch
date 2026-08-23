import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import EvidenceVerify from "./evidence-verify";

export default async function EvidenceVerifyPage({
	params,
}: {
	params: Promise<{ id: string; evidenceId: string }>;
}) {
	const session = await authClient.getSession({
		fetchOptions: {
			headers: await headers(),
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	const { id, evidenceId } = await params;

	return <EvidenceVerify incidentId={id} evidenceId={evidenceId} />;
}
