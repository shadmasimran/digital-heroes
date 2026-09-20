/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Winner proof screenshots are uploaded through a server action.
    serverActions: { bodySizeLimit: '6mb' },
  },
};
export default nextConfig;
