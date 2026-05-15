import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.8", "192.168.1.0/24", "172.16.17.22", "172.16.0.0/12"],
};

export default nextConfig;
