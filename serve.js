// Minimal dependency-free static file server for local preview.
var http = require('http'), fs = require('fs'), path = require('path');
var ROOT = __dirname;
var PORT = process.env.PORT || 8123;
var TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
http.createServer(function (req, res) {
  var url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  var file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, function () { console.log('serving ' + ROOT + ' on http://localhost:' + PORT); });
