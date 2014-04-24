var expect = require('chai').expect;
var testServer = require('supertest');

var SlackHelper = require('node-slack');

var Statbot = require('../');

describe('Statbot', function() {
  var VALID_OPTIONS = {
    teamname: 'orgachem',
    channel: 'general',
    username: 'test',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA'
  };

  var INVALID_OPTIONS = {};

  describe('construct', function() {
    it('should throw an exception when given no options', function() {
      expect(function() {
        new Statbot();
      }).to.throw(Error);
    });

    it('should throw an exception when given invalid options', function() {
      expect(function() {
        new Statbot(INVALID_OPTIONS);
      }).to.throw(Error);
    });

    it('should construct the bot with no mechanisms', function() {
      new Statbot(VALID_OPTIONS);
    });
  });

  describe('get a slack helper', function() {
    it('should return a slack helper', function() {
      var statbot = new Statbot(VALID_OPTIONS);
      var helper = statbot.getSlackHelper();
      expect(helper).to.instanceof(SlackHelper);
    });
  });
})
