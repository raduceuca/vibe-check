/** @type {{ type: 'header', key: string, value: string }[]} */
const markdownAccept = [{
  type: 'header',
  key: 'accept',
  value: '(?:^|.*,\\s*)text/markdown(?![^,]*;\\s*q\\s*=\\s*0(?:\\.0*)?\\s*(?:;|,|$))[^,]*(?:,.*)?',
}]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/md', has: markdownAccept },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
