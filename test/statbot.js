var expect = require('chai').expect;
var Statbot = require('../');

describe('Statbot', function() {
  describe('#start', function() {
    it('should be start the http server.', function() {
      var statbot = new Statbot();
      statbot.start();
    });
  });
});
