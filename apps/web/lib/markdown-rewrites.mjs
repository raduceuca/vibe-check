/** @type {{ type: 'header', key: string, value: string }[]} */
const markdownAccept = [{
  type: 'header',
  key: 'accept',
  value: '(?:^|.*,\\s*)text/markdown(?![^,]*;\\s*q\\s*=\\s*0(?:\\.0*)?\\s*(?:;|,|$))[^,]*(?:,.*)?',
}]

export const markdownRewrites = async () => ({
  beforeFiles: [
    { source: '/index\\.md', destination: '/md/home' },
    { source: '/docs\\.md', destination: '/md/docs' },
    { source: '/fix\\.md', destination: '/md/fix' },
    { source: '/docs/:path*\\.md', destination: '/md/docs/:path*' },
    { source: '/fix/:path*\\.md', destination: '/md/fix/:path*' },
    { source: '/', destination: '/md/home', has: markdownAccept },
    { source: '/docs', destination: '/md/docs', has: markdownAccept },
    { source: '/fix', destination: '/md/fix', has: markdownAccept },
    { source: '/docs/:path*', destination: '/md/docs/:path*', has: markdownAccept },
    { source: '/fix/:path*', destination: '/md/fix/:path*', has: markdownAccept },
  ],
  afterFiles: [],
  fallback: [],
})
