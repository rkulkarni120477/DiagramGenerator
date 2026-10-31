/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the output in ./out is uploaded to S3 and served through CloudFront.
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
