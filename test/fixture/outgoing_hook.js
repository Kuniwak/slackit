var request = require('request');

// Send the request if the parent process request it.
process.on('message', function(data) {
  request.post({
    url: data.url,
    form: data.form,
  });
});

// Send a ready event to parent process.
if ('send' in process) {
  process.send({ ready: true });
}
