var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');

var SERVER_PORT = Number(process.argv[2]);

// This fixture server accepts ANY path and echos a given request as JSON.
// The response should have 4 fields (`url`, `method`, `headers`, `body`).
var app = express();
app.use(bodyParser());
app.post(/.*/, function(req, res) {
  var json = JSON.stringify({
    body: req.body,
    url: req.url,
    method: req.method,
    headers: req.headers,
  });

  res.send(json);
});


// This fixture server listen on the first argument.
app.listen(SERVER_PORT);


// Send an event message for listening started.
if ('send' in process) {
  process.send({ type: 'listened' });
}
