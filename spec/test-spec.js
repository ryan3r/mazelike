/* global describe it */
var request = require('request');
var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;

var base_url = 'http://localhost:3000/';
var login_url = 'http://localhost:3000/account/login';
var create_url = 'http://localhost:3000/account/create';

var view_url = 'http://localhost:3000/account/view';
var dashboard_url = 'http://localhost:3000/account/dashboard';

describe('Create route tests', () => {
  it('Can visit /create', (done) => {
    request.get(create_url, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
      } catch(e) {
        done(e);
      }
      done();
    });
  });

  it('Can create an account', (done) => {
    request.post({
      url: create_url,
      form: { username: 'test', password: 'test', email: 'test@test.com' }
    }, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 302);
      } catch(e) {
        done(e);
      }
      done();
    });
  });
});


describe('Login route tests', () => {
  it('Can visit login', (done) => {
    request.get(login_url, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
      } catch(e) {
        done(e);
      }
      done();
    });
  });

  it('Can login ', (done) => {
    request.post({
      url: create_url,
      form: { username: 'test', password: 'test', email: 'test@test.com' }
    }, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
      } catch(e) {
        done(e);
      }
    });
    request.post({
      url: login_url,
      form: { username: 'test', password: 'password' }
    }, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
      } catch(e) {
        done(e);
      }
      done();
    });
  });
});

describe('Visit route test', () => {
  it('Can visit the view route', (done) => {
    request.get(view_url, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
        done();
      } catch(e) {
        done(e);
      }
    });
  });
});