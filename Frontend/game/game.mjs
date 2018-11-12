/* global PIXI io  */
/* eslint-disable complexity */

import Floor from "./browser/floor.mjs";
import FpsCounter from "./fps-counter.js";
import PlayerList from "./browser/player-list.js";
import DisconnectMessage from "./browser/disconnect-msg.js";
import MobileControls from "./browser/mobile-controls.mjs";


let msgEl = document.querySelector(".msg");
let msgParentEl = document.querySelector(".msg-parent");

let gameIdMatch = location.pathname.match(/\/game\/(.+?)(?:\?|\/|$)/);
let gameId = gameIdMatch && gameIdMatch[1];

let app = new PIXI.Application({
  antialias: true
});

document.body.appendChild(app.view);

// make the game fill the window
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";
app.renderer.autoResize = true;

window.onresize = () => {
  app.renderer.resize(innerWidth, innerHeight);
};

window.onresize();

// disable context menu
addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// This should be removed once player controls the viewport
const addArrowKeyListener = (floor, controls, username, sock) => {
  let handleKey = (e) => {
    let player = getPlayer(floor, username);
    player.keyPress(e);

    sock.emit('player-movement', player.x, player.y, username);
    floor.setViewport(player.x, player.y);
  };

  controls.bind(handleKey);
  window.addEventListener("keydown", handleKey);
};

function getUsername(sock) {
  return new Promise((resolve) => {
    sock.once("set-username", resolve);
  });
}

function getPlayer(floor, username) {
  return floor.players.find((player) => {
    return player.name === username;
  });
}

async function setup() {
  msgEl.innerText = "Connecting to the game server";
  let sock = io(`http://${await (await fetch(`/game/addr/${gameId}`)).text()}`);
  let username = await getUsername(sock);
  msgEl.innerText = "Loading game";
  let floor;

  let masterSock = io(location.origin); //Transition this to the game server
  masterSock.emit("ready", gameId);


  console.log(`User: ${username}`); // eslint-disable-line

  if(gameId) {
    floor = await Floor.load(gameId, 0, sock);
  } else {
    floor = Floor.generate({
      gameId,
      floorIdx: 0,
      sock
    });
  }

  app.stage.addChild(floor.sprite);
  floor.update();

  // Show the fps counter on dev machines
  let fps;
  if(location.hostname === "localhost") {
    fps = new FpsCounter();
    app.stage.addChild(fps.sprite);
  }

  masterSock.on("player-list", (players) => {
    app.stage.addChild(new PlayerList(players).render());
  });

  let controls = new MobileControls();
  app.stage.addChild(controls.sprite);

  window.ml.floor = floor;
  addArrowKeyListener(floor, controls, username, sock);

  sock.on("state", (state) => {
    floor.handleState(state, username);
  });

  // display the countdown when it starts
  sock.on("countdown", (count) => {
    msgEl.innerText = `The game will start in ${count}`;
  });

  // wait for the game to start
  msgEl.innerText = "Waiting for all players to join";

  await new Promise((resolve) => {
    sock.once("start-game", resolve);
  });

  msgParentEl.remove();

  // don't run monster logic multiplayer game (for now)
  if(!gameId) {
    window.setInterval(function() {
      for(let i = 0; i < floor.monsters.length; i++) {
        floor.monsters[i].figureOutWhereToGo();
      }
    }, 500);
  }

  if(!gameId) {
    window.setInterval(function() {
      for(let i = 0; i < floor.monsters.length; i++) {
        if(floor.monsters[i].type === "blue") { // is a blue monster
          floor.monsters[i].figureOutWhereToGo();
        }
      }
    }, 1000);
  }
  window.setInterval(function() {
    for(let i = 0; i < floor.monsters.length; i++) {
      if(floor.monsters[i].type === "blue") { // is a blue monster
        floor.monsters[i].move();
      }
    }
  }, 20);

  sock.on("disconnect", () => {
    new DisconnectMessage("Disconnected!");
    app.stage.addChild(new DisconnectMessage("Disconnected from server!").render());
  });

  app.ticker.add(() => {
    floor.update();
    controls.update();

    if(fps) {
      fps.update();
    }
  });
}

// load the textures
PIXI.loader
  .add("floor", "DawnLike/Objects/Floor.json")
  .add("dog", "DawnLike/Characters/dog.json")
  .add("demon", "DawnLike/Characters/demon.json")
  .add("player", "DawnLike/Characters/player.json")
  .load(setup);
