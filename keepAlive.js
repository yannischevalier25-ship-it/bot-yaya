const http = require('http');

function startKeepAlive() {
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK');
  });

  server.listen(process.env.PORT || 3000, () => {
    console.log(`[KEEPALIVE] Serveur HTTP actif sur le port ${process.env.PORT || 3000}`);
  });
}

module.exports = { startKeepAlive };
