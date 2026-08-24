import "@hate_evidence_copilot/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	output: "standalone",
	allowedDevOrigins: ["192.168.68.70"],
};

export default nextConfig;
