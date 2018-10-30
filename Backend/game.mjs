import socketIO from "socket.io";
import http from "http";
import Floor from "./game/floor";
import saveHandler from "./handlers/save";
import initAuth from "./game-auth.mjs";

async function main() {
  // Parse the env vars
  const PORT = +process.argv[2];
  const MAZELIKE_ENV = /^MAZELIKE_(.+)/;
  let gameEnv = {};

  for(let key of Object.keys(process.env)) {
    let match = key.match(MAZELIKE_ENV);
    if(match) {
      gameEnv[match[1]] = process.env[key];
    }
  }

  // Load/generate the ground floor
  let floor = await Floor.load(gameEnv.gameId, 0);

  // Create the socket.io server
  let httpd = http.createServer((req, res) => {
    res.end("Game server");
  }).listen(PORT, () => {
    process.stdout.write(`Game server listening on ${PORT}\n`);
  });

  // tell the manager this port is in use
  httpd.on("error", (err) => {
    if(err.errno === "EADDRINUSE") {
      process.exit(198);
    }
  });

  let io = socketIO(httpd);

  initAuth(io);

  io.on("connection", (sock) => {
    sock.emit("set-username", sock.user.username);

    saveHandler(sock, floor);
  });

  // In the future we should wait for all players to join
  await new Promise((resolve) => {
    setTimeout(resolve, 3000);
  });

  // start the game
  triggerTick(floor, io, Date.now());
}

let coolDown = 10;

async function triggerTick(floor, io, lastUpdate) {
  let now = Date.now();

  // save and quit if we loose all the clients
  if(io.engine.clientsCount === 0) {
    if(--coolDown === 0) {
      await floor.save();
      process.exit(0);
    }
  } else {
    coolDown = 10;

    // move monsters and check for collisions
    try {
      await floor.tick(now - lastUpdate);
      await floor.sendState(io);
    } catch(err) {
      process.stderr.write(`${err.stack}\n`);
    }
  }

  setTimeout(triggerTick.bind(undefined, floor, io, now), 500);
}

main();
