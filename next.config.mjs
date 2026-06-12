const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        basePath,
        assetPrefix: basePath || undefined,
      }
    : {}),
};

export default nextConfig;
