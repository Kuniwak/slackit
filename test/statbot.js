var expect = require('chai').expect;
var Statbot = require('../');

describe('Statbot', function() {
  describe('#start', function() {
    it('should start the http server.', function() {
      var statbot = new Statbot();
      statbot.start();
    });
  });

  describe('#stop', function() {
    it('should stop the http server.', function() {
      var statbot = new Statbot();
      statbot.stop();
    });
  });
});
