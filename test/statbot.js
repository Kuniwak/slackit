var chai = require('chai');
var sinon = require('sinon');
var supertest = require('supertest');
var expect = chai.expect;
var stub = sinon.stub;


var SlackHelper = require('node-slack');

var Statbot = require('../');

describe('Statbot', function() {
  var VALID_OPTIONS = {
    teamname: 'example',
    channel: 'general',
    username: 'testbot',
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

    it('should construct the bot', function() {
      expect(function() {
        new Statbot(VALID_OPTIONS);
      }).to.not.throw(Error);
    });
  });

  describe('get a slack helper', function() {
    it('should return a slack helper', function() {
      var statbot = new Statbot(VALID_OPTIONS);
      var helper = statbot.getSlackHelper();
      expect(helper).to.instanceof(SlackHelper);
    });
  });

  describe('say a message', function() {
    it('should return a slack helper', function() {
      var statbot = new Statbot(VALID_OPTIONS);

      // Replace the slack helper to the stub.
      stub(statbot, 'getSlackHelper');

      var testMsg = 'test message';
      statbot.say(testMsg);

      expect(statbot.getSlackHelper.getCall(0)).to.deep.equal({
        text: testMsg,
        channel: '#' + VALID_OPTIONS.channel,
        username: VALID_OPTIONS.username
      });
    });
  });
});
