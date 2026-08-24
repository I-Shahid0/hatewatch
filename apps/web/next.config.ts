import "@hate_evidence_copilot/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	/**
	 * Standalone is required for the Docker image. On Vercel (Next 16.3+),
	 * `output: "standalone"` + the platform adapter skip emitting
	 * `.next/next-server.js.nft.json`, then onBuildComplete crashes with ENOENT.
	 * Vercel sets `VERCEL=1` during its builds.
	 */
	...(process.env.VERCEL ? {} : { output: "standalone" as const }),
	allowedDevOrigins: ["192.168.68.70"],
};

export default nextConfig;
