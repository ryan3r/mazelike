/* global io */
import sequelize from "./sequelize";
import express from "express";
import http from "http";
import socketio from "socket.io";
import {gameRouter, joinRoute} from "./routes/game.mjs";
import accountRouter from "./routes/accounts.mjs";
import exphbs from "express-handlebars";
import bodyParser from 'body-parser';
import session from 'express-session';
import userMiddleware from "./middleware/accounts";
import sessionStore from "./session-store";
import winston from 'winston';
import expressWinston from 'express-winston';

let app = express();
let server = http.Server(app);
global.io = socketio(server);

app.use(express.static("Frontend"));
app.use("/shared", express.static("shared"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

//Note if we add https: cookie: { secure: true }
app.use(session({
  secret: 'mazelike',
  resave: true,
  saveUninitialized: false,
  store: sessionStore
}));

//Handlebars
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.set('views', 'Frontend/views');

// Middleware
app.use(userMiddleware);
// Winston request logging
app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: true
    })
  ],
  msg: '{{req.method}} {{req.url}}, res.statusCode: {{res.statusCode}} res.responseTime: {{res.responseTime}}ms',
  expressFormat: false,
  meta: false
}));


//Routes
app.use("/game", gameRouter);
app.get("/j/:id", joinRoute);
app.use('/account', accountRouter);

app.get('/', function(req, res) {
  if(req.session.authenticated) {
    res.redirect('/account/dashboard');
  } else {
    res.render('index', { version: process.env.npm_package_version });
  }
});

// Winston error logger. Must be placed after routes
app.use(expressWinston.errorLogger({
  transports: [
    new winston.transports.Console({
      colorize: true
    })
  ]
}));

let nextId = 0;

io.on("connection", (client) => {
  const id = ++nextId;
  let gameId;

  client.once("ready", (_gameId) => {
    gameId = _gameId;
    client.emit("id", id);
  });

  client.on("position", (pos) => {
    io.emit("set", pos);
  });

  client.on("disconnect", () => {
    if(gameId) {
      io.emit("remove", {id, gameId});
    }
  });
});

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const MAX_RETRIES = 50;
const start = async() => {
  // make several attempts to connect to mysql
  for(let i = 0;; ++i) {
    try {
      await sequelize.authenticate();
      break;
    } catch(err) {
      process.stderr.write(`[${i + 1}/${MAX_RETRIES}] MySql connection failed ${err.message} (retrying in 5s)\n`);
      await sleep(5000);

      if(i === MAX_RETRIES) {
        process.stderr.write(err.stack);
        process.exit(1);
      }
    }
  }

  process.stdout.write("------------------ Ignore previous mysql connection erors ------------------\n");

  await sequelize.sync();

  server.listen(3000, () => {
    process.stdout.write("Server started on port 3000\n");
  });
};

start();
