/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fawaterak sends the webhook body as JSON only when the URL contains
  // "_json" (see their Web Hook docs) — so the public webhook URL is
  // /api/fatorak-webhook_json, rewritten here to the single handler.
  async rewrites() {
    return [
      { source: "/api/fatorak-webhook_json", destination: "/api/fatorak-webhook" }
    ];
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  }
};

module.exports = nextConfig;
