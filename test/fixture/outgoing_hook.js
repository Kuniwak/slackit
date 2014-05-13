var request = require('request');
var http = require('http');

// Send the request if the parent process request it.
process.on('message', function(data) {
  request.post({
    url: data.url,
    form: data.form,
    rejectUnauthorized: false,
  });
});

// Send a ready event to parent process.
if ('send' in process) {
  process.send({ ready: true });
}
