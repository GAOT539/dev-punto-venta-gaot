const https = require('https');
const http = require('http');
const fs = require('fs');

const options = {
  pfx: fs.readFileSync('/app/certs/local.pfx'),
  passphrase: 'local'
};

const proxy = https.createServer(options, (req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxyReq);
  
  proxyReq.on('error', (err) => {
    console.error('Proxy Error:', err);
    res.statusCode = 502;
    res.end('Bad Gateway');
  });
});

proxy.listen(4040, '0.0.0.0', () => {
  console.log('> HTTPS Proxy listening on https://0.0.0.0:4040');
});
