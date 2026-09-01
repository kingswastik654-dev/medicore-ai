const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export for Cloudflare Pages/Workers — no Node server needed.
  // All routes in this app are client-rendered and talk to the FastAPI backend
  // over HTTP (NEXT_PUBLIC_API_URL), so a static bundle is the right model.
  output: "export",
  // No next/image in use; but unoptimized prevents any server/image-optimizer dep
  images: { unoptimized: true },
  // NOTE: security headers are applied at the edge via public/_headers
  // (the `async headers()` config is NOT supported with output: "export").
};

export default nextConfig;

