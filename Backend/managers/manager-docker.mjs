import dockerApi from "node-docker-api";
import poll from "./manager-connect";

const IMAGE_NAME = process.env.IMAGE_NAME || "mazelike/backend:devel";
const ADDRESS = process.env.EXTERN_ADDRESS;
const STARTING_PORT = +process.env.STARTING_PORT || 5900;
const ENDING_PORT = +process.env.ENDING_PORT || 5999;
const PREFIX = process.env.CONTAINER_PREFIX || "";
const PUBLIC_DIR = process.env.PUBLIC_DIR;

let docker = new dockerApi.Docker({ socketPath: "/var/run/docker.sock" });
let inUsePorts = new Set();
let portMap = new Map();

export async function spawnGame(gameEnv = {}) {
  // prefix all mazelike env vars
  let envArray = [];
  for(let key of Object.keys(gameEnv)) {
    envArray.push(`MAZELIKE_${key}=${gameEnv[key]}`);
  }

  let hostname = `mazelike-${PREFIX}${gameEnv.gameId}`;
  let port = pickPort();

  inUsePorts.add(port);
  portMap.set(gameEnv.gameId, port);

  let container = await docker.container.create({
    name: hostname,
    Hostname: hostname,
    Image: IMAGE_NAME,
    Cmd: ["node", "--experimental-modules", "Backend/game.mjs", `${port}`],
    Env: envArray,
    ExposedPorts: {
      [`${port}/tcp`]: {}
    },
    HostConfig: {
      PortBindings: {
        [`${port}/tcp`]: [{
          HostPort: `${port}`
        }]
      },
      Binds: [
        `${PUBLIC_DIR}:/app/Frontend/public`
      ]
    },
    Labels: {
      "edu.iastate.ryanr": `mazelike-${PREFIX}`
    }
  });

  let addr = await startContainer(container, gameEnv.gameId, gameEnv);
  if(addr) {
    return addr;
  }

  let ip = (await container.status()).data.NetworkSettings.IPAddress;

  // wait for the server to start
  try {
    await poll(`${ip}:${port}`);
  } catch(err) {
    try {
      await container.kill();
    } catch(err2) {
      // pass
    }

    inUsePorts.delete(port);
    portMap.delete(gameEnv.gameId);

    throw err;
  }

  waitForClose(container, port, gameEnv.gameId); // DO NOT AWAIT THIS

  return `${ADDRESS}:${port}`;
}

function pickPort() {
  let port = STARTING_PORT;
  while(inUsePorts.has(port)) {
    ++port;

    if(port > ENDING_PORT) {
      throw new Error(`All ports in use`);
    }
  }

  return port;
}

async function waitForClose(container, port, gameId) {
  await container.wait();
  await container.delete({ force: true });
  inUsePorts.delete(port);
  portMap.delete(gameId);
}

export function getGameAddr(gameId) {
  return `${ADDRESS}:${portMap.get(gameId)}`;
}

async function startContainer(container, gameId, gameEnv) {
  try {
    await container.start();
  } catch(err) {
    // check if the port is already being used
    if(err.message.indexOf("address already in use") !== -1) {
      portMap.delete(gameId);
      await container.delete();

      return spawnGame(gameEnv);
    }

    throw err;
  }

  return undefined;
}