var expect = require('chai').expect;
var request = require('supertest');
var Statbot = require('../');

describe('Statbot', function() {
  describe('.constructor', function() {
    it('should throw an exception when given no options', function() {
      var statbot = new Statbot();
    });

    it('should throw an exception when given invalid options', function() {
      var statbot = new Statbot({});
    });

    it('should construct the bot', function() {
      var statbot = new Statbot({
        channel: 'orgachem',
        username: 'test',
        incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA'
      });
    });
  });
});
