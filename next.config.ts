import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Reference images reach the server through a direct Server Action call
      // rather than a native multipart submit, so they are subject to this
      // limit -- the 1MB default is well under a typical phone photo.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
