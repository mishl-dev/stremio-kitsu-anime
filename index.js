const { Elysia } = require('elysia');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const addonInterface = require('./addon');

const router = getRouter(addonInterface);
const app = new Elysia();

// Landing page route
app.get('/', () => {
  const landingHTML = landingTemplate(addonInterface.manifest);
  return new Response(landingHTML, {
    headers: { 'content-type': 'text/html' }
  });
});

// Proxy router requests through Elysia
app.all('/*', ({ request }) => {
  return new Promise((resolve) => {
    const req = {
      method: request.method,
      url: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers)
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader: (key, value) => { res.headers[key] = value; },
      end: (data) => {
        resolve(new Response(data, {
          status: res.statusCode,
          headers: res.headers
        }));
      }
    };

    router(req, res, () => {
      resolve(new Response('Not Found', { status: 404 }));
    });
  });
});

app.listen(process.env.PORT || 7000, () => {
  console.log(`Started addon at: http://localhost:${process.env.PORT || 7000}`);
});
