/* global describe itAsync SERVER_URL requestAsync */
const chai = require("chai");

let lobbyId, joinUrl;

describe("Lobby", function() {
  itAsync("redirects non-users to login", async() => {
    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/new`,
      followRedirect: false
    });

    chai.should().equal(res.statusCode, 302);
    chai.should().equal(res.headers.location, "/account/login?returnUrl=%2Fgame%2Fnew");
  });

  itAsync("can create a new game", async() => {
    await requestAsync({
      method: "post",
      url: `${SERVER_URL}/account/create`,
      followRedirect: false,
      form: {
        username: "foo",
        email: "foo@test.com",
        password: "foo"
      }
    });

    await requestAsync({
      method: "post",
      url: `${SERVER_URL}/account/login?returnUrl=%2Fgame%2Fnew`,
      followRedirect: false,
      jar: true,
      form: {
        username: "foo",
        password: "foo"
      }
    });

    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/new`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res.statusCode, 302);
    let match = res.headers.location.match(/^\/game\/lobby\/(.+)$/);
    chai.assert(match, `Got ${res.headers.location}`);

    lobbyId = match[1];
  });

  itAsync("can view a lobby", async() => {
    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false
    });

    chai.should().equal(res.statusCode, 200);
  });

  itAsync("can view a lobby as user", async() => {
    let {res, body} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res.statusCode, 200);
    joinUrl = body.match(/data-secret="([A-Za-z0-9]+)"/);
	if(joinUrl) {
		joinUrl = [`${SERVER_URL}/j/${joinUrl[1]}`, joinUrl[1]];
	}
    chai.assert(joinUrl, "Join url not found");
  });

  itAsync("can join a lobby", async() => {
    await requestAsync({
      method: "post",
      url: `${SERVER_URL}/account/create`,
      followRedirect: false,
      form: {
        username: "bar",
        email: "bar@test.com",
        password: "bar"
      }
    });

    await requestAsync({
      method: "post",
      url: `${SERVER_URL}/account/login`,
      followRedirect: false,
      jar: true,
      form: {
        username: "bar",
        password: "bar"
      }
    });

    if(!joinUrl) {
      throw new Error("can view a lobby needs to pass the join code");
    }

    let {res} = await requestAsync({
      url: `${SERVER_URL}${joinUrl[0]}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res.statusCode, 302);
    chai.should().equal(res.headers.location, `/game/lobby/${lobbyId}`);

    let {res: res2, body} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res2.statusCode, 200);
    chai.assert(body.indexOf("bar") !== -1, "bar not found in lobby");
  });

  itAsync("can drop a player", async() => {
    await requestAsync({
      method: "post",
      url: `${SERVER_URL}/account/login`,
      followRedirect: false,
      jar: true,
      form: {
        username: "foo",
        password: "foo"
      }
    });

    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}/drop/bar`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res.statusCode, 200);

    let {res: res2, body} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res2.statusCode, 200);
    chai.assert(body.indexOf("bar") !== -1, "bar not found in lobby");
  });

  itAsync("can delete a lobby", async() => {
    await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}/delete`,
      followRedirect: false,
      jar: true
    });

    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res.statusCode, 404);
  });

  itAsync("can start a game", async() => {
    let {res} = await requestAsync({
      url: `${SERVER_URL}/game/new`,
      followRedirect: false,
      jar: true
    });

    let match = res.headers.location.match(/^\/game\/lobby\/(.+)$/);
    chai.assert(match, `New got ${res.headers.location}`);

    lobbyId = match[1];

    await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}/start`,
      followRedirect: false,
      jar: true
    });

    let {res: res2} = await requestAsync({
      url: `${SERVER_URL}/game/lobby/${lobbyId}`,
      followRedirect: false,
      jar: true
    });

    chai.should().equal(res2.statusCode, 200);
  });
});
