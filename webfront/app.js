var googleapis = require("googleapis");
var http = require("http");
var irc = require("irc");
var querystring = require("querystring");
var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    path = require('path');

var config = require("../config").plugins.irc_log;
var io = require('socket.io');
var io_client = require('socket.io-client');

var dataParse = require('./irc_tools.js').dataParse;

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('I am literally a walrus.')); // Your secret here
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/home', routes.home);

var httpServer = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var socket = io.listen(httpServer);

var irc = io_client.connect("http://localhost:" + config.live_socket_port);
irc.on('connect', function(data){
  console.log("Connected to rbotson");
  // io.sockets.emit("irc_message", dataParse(data));
  irc.on('irc_message', function(data){
    console.log("RECEIVED AN MESSIDGE");
    socket.sockets.emit("irc_message", dataParse(data));
  });
});