var config;
var nano;
var db;
var io;

exports.initialise = function (irc_client, _config, _nano, wisp, cb) {
    config = _config;
    nano = _nano(config.db_server);
    db = nano.use(config.db_name);
    if (config.live_socket_enable) {
        io = wisp.listen(config.live_socket_port);
        io.sockets.on('connection', function(socket){
            console.log("Client connected to IRC log socket");
        });
    }

    // Catch all messages from server, and database those we're interested in.
    irc_client.on("raw", function(message){
        if (["PRIVMSG", "JOIN", "PART",
             "TOPIC", "MODE", "KICK"].indexOf(message.command) > -1)
        {
            var data = { // DB Data structure
                timestamp:null,
                channel:null,
                command: null,
                actor:{name: null, user:null, host: null}
                //actedUpon:{name:null, user:null, host:null}
                //args:[]
            };
            data.timestamp = parseInt(new Date().getTime()/1000, 10);
            data.command = message.command;
            data.actor.name = message.nick;
            data.actor.user = message.user;
            data.actor.host = message.host;

            switch (message.command) {
                case "PRIVMSG":
                    data.channel = message.args[0];
                    data.args = [];
                    data.args.push(message.args[1]); // Text
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;

                case "JOIN":
                    data.channel = message.args[0];
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;

                case "PART":
                    data.channel = message.args[0];
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;

                case "TOPIC":
                    data.channel = message.args[0];
                    data.args = [];
                    data.args.push(message.args[1]); // New topic
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;

                case "MODE":
                    data.channel = message.args[0];
                    data.args = [];
                    data.args.push(message.args[1]); // Mode
                    if (message.args[2]) { // This triggers if the mode action applies to a user.
                        irc_client.whois(message.args[2], function(info){
                            data.actedUpon = {
                                name: info.name,
                                user: info.user,
                                host: info.host
                            };
                        });
                    }
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;

                case "KICK":
                    data.channel = message.args[0];
                    data.args = [];
                    data.args.push(message.args[2]); // Kick reason
                    if (message.args[1]) { // Kicked user
                        irc_client.whois(message.args[1], function(info){
                            data.actedUpon = {
                                name: info.name,
                                user: info.user,
                                host: info.host
                            };
                        });
                    }
                    if (config.channels.indexOf(data.channel > -1)) insert(data);
                    break;
            }
        }
    });

    irc_client.on("NICK", function(oldNick, newNick, channels, message){
        for (var i = 0; i < channels.length; i++) {
            if (config.channels.indexOf(channels[i] > -1)) insert({
                timestamp: parseInt(new Date().getTime()/1000, 10),
                channel: channels[i],
                command: message.command,
                actor:{name: message.nick, user:message.user, host: message.host},
                args:[newNick]
            });
        }
    });

    irc_client.on("KILL", function(nick, reason, channels, message){
        irc_client.whois(nick, function(info){
            for (var i = 0; i < channels.length; i++) {
                if (config.channels.indexOf(channels[i] > -1)) {
                        insert({
                            timestamp: parseInt(new Date().getTime()/1000, 10),
                            channel: channels[i],
                            command: message.command,
                            actor:{name: info.nick, user:info.user, host: info.host},
                            args:[reason]
                        });
                }
            }
        });
    });

    // Capture messages RBotson sends to the IRC server.
    irc_client.on("selfMessage", function(target, message){
        irc_client.whois(irc_client.nick, function(info){
            if (config.channels.indexOf(target > -1)) insert({
                timestamp: parseInt(new Date().getTime()/1000, 10),
                channel: target,
                command: "PRIVMSG",
                actor:{name: info.nick, user:info.user, host: info.host},
                args:[message]
            });
        });
    });

    console.log("Loaded " + config.name);
    if (cb) cb();
};

function insert(data) {
    db.insert(data, function(error, http_body, http_headers) {
        if(error) {
            console.error(error);
        }
    });

    if (io) io.sockets.emit("irc_message", data);
}