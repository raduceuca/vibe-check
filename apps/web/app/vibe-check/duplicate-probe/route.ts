export const GET = (): Response =>
  new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  })

export const POST = GET
