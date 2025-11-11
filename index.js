import { Elysia } from 'elysia'
import { getRouter } from 'stremio-addon-sdk'
import landingTemplate from 'stremio-addon-sdk/src/landingTemplate.js'
import addonInterface from './addon.js'

const router = getRouter(addonInterface)

const app = new Elysia()

// Landing page for browser access
app.get('/', () => {
  return new Response(landingTemplate(addonInterface.manifest), {
    headers: { 'content-type': 'text/html' }
  })
})

// Use Elysia's `all` route handler to pass all other requests to Stremio router
app.all('/*', async ({ request }) => {
  const { url, method, headers } = request
  const [path] = url.split('?')

  return await new Promise((resolve) => {
    const fakeRes = {
      statusCode: 200,
      headers: {},
      setHeader: (k, v) => (fakeRes.headers[k] = v),
      end: (body) => {
        resolve(new Response(body, { status: fakeRes.statusCode, headers: fakeRes.headers }))
      }
    }

    const fakeReq = Object.assign(request, {
      url: path,
      method,
      headers: Object.fromEntries(headers.entries())
    })

    router(fakeReq, fakeRes, () => {
      fakeRes.statusCode = 404
      fakeRes.end('Not found')
    })
  })
})

app.listen(process.env.PORT || 7000)
console.log(`Started addon at: http://localhost:${process.env.PORT || 7000}`)
