const { Elysia } = require('elysia');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const addonInterface = require('./addon');

const router = getRouter(addonInterface);

// Middleware to add CORS headers
const addCorsHeaders = (res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');
};

router.get('/', (_, res) => {
  const landingHTML = landingTemplate(addonInterface.manifest);
  res.setHeader('content-type', 'text/html');
  addCorsHeaders(res);
  res.end(landingHTML);
});

// Create middleware function that wraps the router with CORS
const middleware = (req, res) => {
  addCorsHeaders(res);
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  router(req, res, () => {
    res.statusCode = 404;
    res.end();
  });
};

const app = new Elysia();

// Convert Node.js middleware to Elysia
app.all('/*', ({ request, set }) => {
  return new Promise((resolve) => {
    const req = {
      method: request.method,
      url: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers)
    };

    let responded = false;

    const res = {
      statusCode: 200,
      headers: {},
      setHeader: (key, value) => {
        res.headers[key] = value;
        return res;
      },
      end: (data = '') => {
        if (responded) return;
        responded = true;
        resolve(new Response(data, {
          status: res.statusCode,
          headers: res.headers
        }));
      }
    };

    middleware(req, res);
  });
});

app.listen(process.env.PORT || 7000, () => {
  console.log(`Started addon at: http://localhost:${process.env.PORT || 7000}`);
});
