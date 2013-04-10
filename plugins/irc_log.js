var config = global.config.plugins.irc_log,
    util = require("util"),
    Q = require("q"),
    io = require("socket.io"),
    nano = require("nano")(config.db_server),
    db = nano.use(config.db_name),
    authCookie = "",
    socket;

var nanoAuth = function(){
    nano.auth(config.db_user, config.db_pass, function (err, body, headers) {
        if (err) {
            util.log("irc_log.js - nano auth error: " + err);
        } else {
            if (headers && headers["set-cookie"]) {
                util.log("irc_log.js - nano auth received cookie from couchdb");
                authCookie = headers["set-cookie"];
            }
        }
    });
};

module.exports = function (cb) {
    if (config.live_socket_enable) {
        socket = io.listen(config.live_socket_port);
        socket.sockets.on('connection', function(_socket){
                util.log("irc_log.js - Client connected to IRC log socket");
            });
    }

    // Cookies last for 10 minutes; auth every 9 bcuz 10 is 2 and 2 is 2 soon.
    nanoAuth();
    setInterval(nanoAuth, 9 * 60 * 1000);
    // Catch all messages from server, and database those we're interested in.
    global.irc
        .on("raw", function(message){
            if (["PRIVMSG", "JOIN", "PART",
                 "TOPIC", "MODE", "KICK"].indexOf(message.command) > -1)
            {
                var data = {
                    timestamp: parseInt(new Date().getTime()/1000, 10),
                    command: message.command,
                    actor: {
                        name: message.nick,
                        user: message.user,
                        host: message.host
                    },
                    args: []
                };

                var promise;

                switch (message.command) {
                    case "PRIVMSG":
                        data.channel = message.args[0];

                        // Text
                        data.args.push(message.args[1]);
                        break;

                    case "JOIN":
                        data.channel = message.args[0];
                        break;

                    case "PART":
                        data.channel = message.args[0];
                        break;

                    case "TOPIC":
                        data.channel = message.args[0];

                        // New topic
                        data.args.push(message.args[1]);
                        break;

                    case "MODE":
                        data.channel = message.args[0];

                        // Mode
                        data.args.push(message.args[1]);

                        // This triggers if the mode action applies to a user.
                        if (message.args[2]) {
                            promise = (function(){
                                var defer = Q.defer();
                                global.irc.whois(message.args[2], function(info){
                                    data.actedUpon = {
                                        name: info.nick,
                                        user: info.user,
                                        host: info.host
                                    };
                                    defer.resolve();
                                });
                                return defer.promise;
                            }());
                        }
                        break;

                    case "KICK":
                        data.channel = message.args[0];

                        // Kick reason
                        data.args.push(message.args[2]);

                        // Kicked user
                        promise = (function(){
                            var defer = Q.defer();
                            global.irc.whois(message.args[1], function(info){
                                data.actedUpon = {
                                    name: info.nick,
                                    user: info.user,
                                    host: info.host
                                };
                                defer.resolve();
                            });
                            return defer.promise;
                        }());
                        break;
                }
                if (promise) {
                    promise.done(function(){
                        insert(data);
                    });
                }
                else {
                    insert(data);
                }
            }
        })
        .on("NICK", function(oldNick, newNick, channels, message){
            insertMultiChannels({
                timestamp: parseInt(new Date().getTime()/1000, 10),
                command: message.command,
                actor: {
                    name: message.nick,
                    user: message.user,
                    host: message.host
                },
                args: [newNick]
            }, channels);
        })
        .on("KILL QUIT", function(nick, reason, channels, message){
            global.irc.whois(nick, function(info){
                insertMultiChannels({
                    timestamp: parseInt(new Date().getTime()/1000, 10),
                    command: message.command,
                    actor: {
                        name: info.nick,
                        user: info.user,
                        host: info.host
                    },
                    args: [reason]
                }, channels);
            });
        })

        // Capture messages RBotson sends to the IRC server.
        .on("selfMessage", function(target, message){
            insert({
                timestamp: parseInt(new Date().getTime()/1000, 10),
                channel: target,
                command: "PRIVMSG",
                actor: {
                    name: global.irc.nick,
                    user: global.irc.user,
                    host: global.irc.host
                },
                args:[message]
            });
        });

    util.log("Loaded " + config.name);
    if (cb) cb();
};

function insert(data) {
    if (config.channels.indexOf(data.channel) > -1) {
        db.insert(data, function(err, body, headers) {
            if(err) {
                util.log("irc_log.js error inserting data into db: " + error);
            }
            else if (headers && headers["set-cookie"]) {
                authCookie = headers["set-cookie"];
            }
        });
    }
    if (socket) socket.sockets.emit("irc_message", data);
}

function insertMultiChannels(data, channels) {
    for (var i = 0; i < channels.length; i++) {
        data.channel = channels[i];
        insert(data);
    }
}