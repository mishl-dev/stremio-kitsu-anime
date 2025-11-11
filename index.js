const { Elysia } = require('elysia');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const addonInterface = require('./addon');

const router = getRouter(addonInterface);
const app = new Elysia();

// CORS headers
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type'
};

router.get('/', (_, res) => {
  const landingHTML = landingTemplate(addonInterface.manifest);
  res.setHeader('content-type', 'text/html');
  res.end(landingHTML);
});

// Create a proper Node.js-like request/response adapter
const handleRequest = (method, pathname, headers, body) => {
  return new Promise((resolve) => {
    let resolved = false;
    
    const req = {
      method,
      url: pathname,
      headers,
      on: () => {} // Stub for stream methods
    };

    let statusCode = 200;
    let responseHeaders = { ...corsHeaders };
    let responseBody = '';

    const res = {
      statusCode,
      statusMessage: 'OK',
      headersSent: false,
      headers: responseHeaders,
      
      setHeader: (name, value) => {
        responseHeaders[name.toLowerCase()] = value;
        return res;
      },
      
      getHeader: (name) => responseHeaders[name.toLowerCase()],
      
      removeHeader: (name) => {
        delete responseHeaders[name.toLowerCase()];
        return res;
      },
      
      writeHead: (code, headersObj) => {
        statusCode = code;
        if (headersObj) {
          Object.entries(headersObj).forEach(([k, v]) => {
            responseHeaders[k.toLowerCase()] = v;
          });
        }
        res.statusCode = code;
        res.headersSent = true;
        return res;
      },
      
      write: (chunk) => {
        if (chunk) {
          responseBody += typeof chunk === 'string' ? chunk : chunk.toString();
        }
        return res;
      },
      
      end: (chunk) => {
        if (resolved) return;
        resolved = true;
        
        if (chunk) {
          responseBody += typeof chunk === 'string' ? chunk : chunk.toString();
        }
        
        resolve({
          status: statusCode,
          headers: responseHeaders,
          body: responseBody
        });
      }
    };

    // Call the router with Node.js-like req/res objects
    router(req, res, () => {
      if (!resolved) {
        resolved = true;
        resolve({
          status: 404,
          headers: corsHeaders,
          body: 'Not Found'
        });
      }
    });
  });
};

// Elysia route handler
app.all('/*', async ({ request }) => {
  const url = new URL(request.url);
  const pathname = url.pathname + url.search;
  const method = request.method;
  const headers = Object.fromEntries(request.headers);
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const { status, headers: resHeaders, body } = await handleRequest(method, pathname, headers);

  return new Response(body || null, {
    status,
    headers: resHeaders
  });
});

app.listen(process.env.PORT || 7000, () => {
  console.log(`Started addon at: http://localhost:${process.env.PORT || 7000}`);
});
