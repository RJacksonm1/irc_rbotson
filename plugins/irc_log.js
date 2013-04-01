var config = global.config.plugins.irc_log,
    io = require("socket.io"),
    db = require("nano")(config.db_server).use(config.db_name),
    socket;

exports.initialise = function (cb) {
    if (config.live_socket_enable) {
        socket = io.listen(config.live_socket_port);
        socket.sockets.on('connection', function(_socket){
                console.log("Client connected to IRC log socket");
            });
    }

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
                            global.irc.whois(message.args[2], function(info){
                                data.actedUpon = {
                                    name: info.name,
                                    user: info.user,
                                    host: info.host
                                };
                            });
                        }
                        break;

                    case "KICK":
                        data.channel = message.args[0];

                        // Kick reason
                        data.args.push(message.args[2]);

                        // Kicked user
                        if (message.args[1]) {
                            global.irc.whois(message.args[1], function(info){
                                data.actedUpon = {
                                    name: info.name,
                                    user: info.user,
                                    host: info.host
                                };
                            });
                        }
                        break;
                }
                insert(data);
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
        .on("KILL", function(nick, reason, channels, message){
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

    console.log("Loaded " + config.name);
    if (cb) cb();
};

function insert(data) {
    if (config.channels.indexOf(data.channel > -1)) {
        db.insert(data, function(error, http_body, http_headers) {
            if(error) {
                console.error(error);
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