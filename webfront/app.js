var googleapis = require("googleapis");
var http = require("http");
var irc = require("irc");
var querystring = require("querystring");
var io = require("socket.io");
var ioclient = require("socket.io-client");
var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    path = require('path');

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
socket.on('connection', function(client){
    console.log("Client connected");
});

var irc = ioclient.connect('http://localhost:2999');
irc.on("connect", function(){
    console.log("Connected to IRC");
    irc.on("message", function(data){
        console.log(data);
        socket.sockets.emit("irc_msg", data);
    });
});