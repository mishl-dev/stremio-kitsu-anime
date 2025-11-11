const { Elysia } = require('elysia');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const addonInterface = require('./addon');

const router = getRouter(addonInterface);
const app = new Elysia();

// CORS middleware
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type'
};

// Handle OPTIONS requests for CORS preflight
app.options('/*', () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
});

// Manifest route
app.get('/manifest.json', () => {
  return new Response(JSON.stringify(addonInterface.manifest), {
    headers: { 
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
});

// Landing page route
app.get('/', () => {
  const landingHTML = landingTemplate(addonInterface.manifest);
  return new Response(landingHTML, {
    headers: { 
      'content-type': 'text/html',
      ...corsHeaders
    }
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

    let responded = false;
    let body = '';

    const res = {
      statusCode: 200,
      headers: { ...corsHeaders },
      setHeader: (key, value) => { 
        res.headers[key] = value; 
        return res;
      },
      writeHead: (statusCode, headers) => {
        res.statusCode = statusCode;
        if (headers) {
          Object.assign(res.headers, headers);
        }
        return res;
      },
      write: (chunk) => {
        if (typeof chunk === 'string') {
          body += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          body += chunk.toString();
        }
        return res;
      },
      redirect: (statusCode, location) => {
        if (typeof statusCode === 'string') {
          location = statusCode;
          statusCode = 302;
        }
        res.statusCode = statusCode;
        res.setHeader('location', location);
        res.setHeader('content-length', '0');
        if (!responded) {
          responded = true;
          resolve(new Response(null, {
            status: statusCode,
            headers: res.headers
          }));
        }
      },
      end: (data) => {
        if (responded) return;
        responded = true;
        
        if (data) {
          body += typeof data === 'string' ? data : data.toString();
        }
        
        // Ensure content-type is set for JSON responses if not already set
        if (!res.headers['content-type'] && body) {
          try {
            JSON.parse(body);
            res.headers['content-type'] = 'application/json';
          } catch (e) {
            // Not JSON, leave as is
          }
        }
        resolve(new Response(body, {
          status: res.statusCode,
          headers: res.headers
        }));
      }
    };

    router(req, res, () => {
      if (responded) return;
      resolve(new Response('Not Found', { status: 404, headers: corsHeaders }));
    });
  });
});

app.listen(process.env.PORT || 7000, () => {
  console.log(`Started addon at: http://localhost:${process.env.PORT || 7000}`);
});
