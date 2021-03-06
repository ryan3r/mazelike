/* global PIXI io  */
/* eslint-disable complexity */

import "./logger.mjs"; // MUST BE THE FIRST IMPORT
import Floor from "./browser/floor.mjs";
import FpsCounter from "./fps-counter.js";
import PlayerList from "./browser/player-list.js";
import DisconnectMessage from "./browser/disconnect-msg.js";
import MobileControls from "./browser/mobile-controls.mjs";

let msgEl = document.querySelector(".msg");
let msgParentEl = document.querySelector(".msg-parent");
let msgHeader = document.querySelector(".msg-header");
let fullscreenEl = document.querySelector(".fullscreen");

let gameIdMatch = location.pathname.match(/\/game\/(.+?)(?:\?|\/|$)/);
let gameId = gameIdMatch && gameIdMatch[1];

let app = new PIXI.Application({
  antialias: true
});

let disconnected = new DisconnectMessage("Disconnected from server!");
let playerList = new PlayerList();

document.body.appendChild(app.view);

// make the game fill the window
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";
app.renderer.autoResize = true;

window.onresize = () => {
  app.renderer.resize(innerWidth, innerHeight);
  disconnected.resize();
};

window.onresize();

// disable context menu
addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// This should be removed once player controls the viewport
const addArrowKeyListener = (controls, username) => {
  let handleKey = (type, e) => {
    let player = getPlayer(window.ml.floor, username);
    if(player) {
      player.handleKeyPress(type, e);
    }
  };

  controls.bind(handleKey.bind(null, "down"), handleKey.bind(null, "up"));
  window.addEventListener("keydown", handleKey.bind(null, "down"));
  window.addEventListener('keyup', handleKey.bind(null, "up"));

  window.addEventListener("mousemove", (e) => {
    let player = getPlayer(window.ml.floor, username);
    if(player) {
      player.handleMouse(false, e.clientX + player.floor._viewportX, e.clientY + player.floor._viewportY);
    }
  });

  window.addEventListener("pointerdown", (e) => {
    let player = getPlayer(window.ml.floor, username);
    if(player) {
      player.handleMouse(true, e.clientX + player.floor._viewportX, e.clientY + player.floor._viewportY);
    }
  });
};

/**
 * Handle key presses for spectators
 * @private
 */
function spectatorHandler(floor, e) {
  if(floor.players.length === 0) {
    return;
  }

  let index = floor.players.findIndex((player) => {
    return player.name === floor.followingUser;
  });

  // Handle the arrow keys
  if(e.keyCode === 38 /* up */ || e.keyCode === 87 /* w */) {
    --index;
  }

  if(e.keyCode === 40 /* down */ || e.keyCode === 83 /* s */) {
    ++index;
  }

  // Wrap at the ends
  if(index < 0) {
    index = floor.players.length - 1;
  }

  if(index >= floor.players.length) {
    index = 0;
  }

  floor.followingUser = floor.players[index].name;
}

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

let readyToPlay = new Promise((resolve) => {
  document.querySelector(".ready").addEventListener("click", () => {
    document.querySelector(".pregame").remove();
    document.querySelector(".ingame").style.display = "";

    // Enter fullscreen
    if(fullscreenEl.checked) {
      if(document.body.webkitRequestFullScreen) {
        document.body.webkitRequestFullScreen();
      } else if(document.body.requestFullScreen) {
        document.body.requestFullScreen();
      }
    }

    localStorage.fullscreen = fullscreenEl.checked;

    resolve();
  });
});

document.querySelector("#save-game").addEventListener("click", () => {
  if(window.ml.floor) {
    window.ml.floor.save();
  }
});

// eslint-disable-next-line
window.localStorage || (window.localStorage = {});
fullscreenEl.checked = localStorage.fullscreen !== "false";

function setup() {
  let sock, username;
  let isNewFloor = false;
  let playerWon = false;

  readyToPlay.then(() => {
    msgEl.innerText = "Connecting to the game server";

    return fetch(`/game/addr/${gameId}`);
  }).then((res) => {
    return res.text();
  }).then((gameServerAddr) => {
    if(gameServerAddr === "__current__") {
      gameServerAddr = location.host; // eslint-disable-line
    }

    sock = io(`${location.protocol}//${gameServerAddr}/game/${gameId}`);

    // Show the user which game server is serving them
    sock.on("game-server-name", (name) => {
      document.title = `Mazelike - ${name}`;
    });

    sock.on("game-saved", (blame) => {
      alert(`Game saved by ${blame}`);
      location.href = `/game/lobby/${gameId}`;
    });

    return getUsername(sock);
  }).then(({ name, floorIdx }) => {
    username = name;
    msgEl.innerText = "Loading game";

    return Floor.load(gameId, floorIdx, sock, username);
  }).then((floor) => {
    app.stage.addChild(floor.sprite);
    floor.update();

    // Show the fps counter on dev machines
    let fps;
    if(location.hostname === "localhost") {
      fps = new FpsCounter();
      app.stage.addChild(fps.sprite);
    }

    let controls = new MobileControls();
    app.stage.addChild(controls.sprite);

    window.ml.floor = floor;
    addArrowKeyListener(controls, username);

    let resolveGameRunning;
    let gameRunning = new Promise((resolve) => {
      resolveGameRunning = resolve;
    });

    sock.on("state", (state) => {
      floor.handleState(state, username);

      if(state.isGameRunning) {
        resolveGameRunning();
      }

      if(isNewFloor) {
        playerList.floor = floor;
        playerList.listOfPlayers = floor.players;
      }
      isNewFloor = false;
    });

    // display the countdown when it starts
    sock.on("countdown", (count) => {
      msgEl.innerText = `The game will start in ${count}`;
    });

    // wait for the game to start
    msgEl.innerText = "Waiting for all players to join";

    return Promise.race([
      new Promise((resolve) => {
        sock.once("start-game", resolve);
      }),
      gameRunning
    ]).then(() => {
      document.body.classList.add("crosshair");
      msgParentEl.style.display = "none";

      // don't run monster logic multiplayer game (for now)
      if(!gameId) {
        window.setInterval(function() {
          for(let i = 0; i < floor.monsters.length; i++) {
            floor.monsters[i].figureOutWhereToGo();
          }
        }, 500);
      }

      sock.on("disconnect", () => {
        app.stage.addChild(disconnected.render());
      });

      sock.on("update-playerlist", (player) => {
        playerList.disconnectPlayer(player); //Update player list
      });

      sock.on("win", () => {
        playerWon = true;
        document.body.classList.remove("crosshair");
        document.body.classList.add("win");
        msgHeader.innerText = "You win";
        msgEl.innerHTML = "";
        msgParentEl.style.display = "";

        let a = document.createElement("a");
        a.href = "/account/dashboard";
        a.innerText = "Dashboard";
        msgEl.appendChild(a);

        // Exit fullscreen
        if(localStorage.fullscreen) {
          if(document.documentElement.webkitExitFullScreen) {
            document.documentElement.webkitExitFullScreen();
          } else if(document.documentElement.exitFullScreen) {
            document.documentElement.exitFullScreen();
          }
        }
      });

      // switch floors
      sock.on("new-floor", (id) => {
        let floorId = id.split("-")[1];
        app.stage.removeChild(floor.sprite);
        app.stage.removeChild(controls.sprite);
        app.stage.removeChild(playerList.graphics);

        // load the new map
        Floor.load(gameId, floorId, sock, username)
          .then((_floor) => {
            isNewFloor = true;
            window.ml.floor = floor = _floor; // eslint-disable-line

            app.stage.addChild(floor.sprite);
            app.stage.addChild(controls.sprite);
            app.stage.addChild(playerList.graphics); //Draw the player list
          });
      });

      playerList.floor = floor;
      playerList.listOfPlayers = floor.players;
      app.stage.addChild(playerList.render()); //Draw the player list

      let isSpectator = false;
      let isFirstTick = true;
      app.ticker.add(() => {
        // spectator mode
        if(!isSpectator && !getPlayer(floor, username) && !isNewFloor && !playerWon) {
          let saveBtn = document.querySelector("#save-game");
          if(saveBtn) {
            saveBtn.remove();
          }

          document.body.classList.add("dead");
          document.body.classList.remove("crosshair");
          controls.becomeSpectator();
          isSpectator = true;
          floor.followingUser = floor.players[0] && floor.players[0].name;
          // switch following users by pressing up and down
          controls.bind(spectatorHandler.bind(null, floor), () => {});
          window.addEventListener("keydown", spectatorHandler.bind(null, floor));

          if(!isFirstTick) {
            // show you died
            msgHeader.innerText = "You died";
            msgEl.innerHTML = "";
            msgParentEl.style.display = "";

            let a = document.createElement("a");
            a.href = "#";
            a.innerText = "Spectate";
            msgEl.appendChild(a);
            a.addEventListener("click", (e) => {
              e.preventDefault();
              msgParentEl.style.display = "none";
            });
          }
        }

        if(floor.players.length > 0) {
          isFirstTick = false;
        }

        // follow a specific player in spectator mode
        if(isSpectator) {
          let following = getPlayer(floor, floor.followingUser);
          if(following) {
            floor.setViewport(following.x, following.y);
          } else if(floor.players.length) {
            floor.followingUser = floor.players[0].name;
          }
        }

        // show game over
        if(floor.players.length === 0 && msgHeader.innerText !== "Game over" && !isNewFloor && !playerWon) {
          let saveBtn = document.querySelector("#save-game");
          if(saveBtn) {
            saveBtn.remove();
          }

          document.body.classList.remove("crosshair");
          document.body.classList.add("dead");
          msgHeader.innerText = "Game over";
          msgEl.innerHTML = "";
          msgParentEl.style.display = "";

          let a = document.createElement("a");
          a.href = "/account/dashboard";
          a.innerText = "Dashboard";
          msgEl.appendChild(a);

          // Exit fullscreen
          if(localStorage.fullscreen) {
            if(document.documentElement.webkitExitFullScreen) {
              document.documentElement.webkitExitFullScreen();
            } else if(document.documentElement.exitFullScreen) {
              document.documentElement.exitFullScreen();
            }
          }
        }

        let player = getPlayer(floor, username);
        if(player) {
          player.sendFrame();
          player.dropConfirmed();
          player.move();
          floor.setViewport(player.x, player.y);
        }

        floor.update();
        controls.update();
        playerList.update();

        if(fps) {
          fps.update();
        }
      });
    });
  });
}

// load the textures
let itemsDir = 'DawnLike/Items';
let charactersDir = 'DawnLike/Characters';
PIXI.loader
  .add("floor", "DawnLike/Objects/Floor.json")
  .add("dog", `${charactersDir}/dog.json`)
  .add("demon", `${charactersDir}/demon.json`)
  .add("player", `${charactersDir}/player.json`)
  .add('boot', `${itemsDir}/boot.json`)
  .add('hat', `${itemsDir}/hat.json`)
  .add('shield', `${itemsDir}/shield.json`)
  .add('shortWep', `${itemsDir}/shortWep.json`)
  .add('key', `${itemsDir}/key.json`)
  .load(setup);
