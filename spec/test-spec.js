/* global describe it SERVER_URL */
var request = require('request');
var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;

var login_url = `http://localhost:3000/account/login`;
var create_url = `http://localhost:3000/account/create`;
var edit_url = `http://localhost:3000/account/edit`;


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

describe('Edit route tests', () => {
  it('Can visit edit route', (done) => {
    request.get(edit_url, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 200);
      } catch (e) {
        done(e);
      }
      done();
    });
  });

  it('Can not post to edit route if the user is not logged in', (done) => {
    request.post({
      url: edit_url,
      form: { username: 'test', password: 'password' }
    }, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 302);
      } catch (e) {
        done(e);
      }
      done();
    });
  });

  it('Can post to edit, provided that the user is logged in', (done) => {
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
    request.post({
      url: edit_url,
      form: { username: 'test', password: 'password_edited' }
    }, function(err, response, body) {
      try {
        assert.equal(response.statusCode, 302);
      } catch (e) {
        done(e);
      }
      done();
    });
  });
});
