// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');

// const app = express();
// // Set up the proxy middleware
// app.use(
//   '/api',(req,res,next)=>{
//     console.log("proxy server called")
// next()
//   },
//   createProxyMiddleware({
//     target: 'http://obl-new.orientbell.com/graphql',
//     changeOrigin: true,
//     // pathRewrite: {
//     //   '^/api': '',
//     // },
//   })
// );

// // Start the proxy server
// app.listen(5000, () => {
//   console.log('Proxy server is running on port 3000');
// })

const http = require('http');

const proxyServer = http.createServer((req, res) => {
  
  const options = {
    hostname: 'obl-new.orientbell.com', // Replace with your Magento 2 Graph API hostname
    port: 80, // Replace with the appropriate port
    path: `/graphql/`, // Replace with the specific Graph API endpoint path
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  console.log(proxyReq)

  req.pipe(proxyReq);
});
proxyServer.listen(3001, () => {
  console.log('Proxy server is running on port 3001');
});