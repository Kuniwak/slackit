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

  describe('say a message', function() {
    it('should send a message by using http.request()', function() {
      var testMsg = '0123456789abcdABCD @+-_!?/:"\'';
      var statbot = new Statbot(VALID_OPTIONS);
      statbot.say(testMsg);
    });
  });

  describe('should returns a slack url', function() {

  });
});
