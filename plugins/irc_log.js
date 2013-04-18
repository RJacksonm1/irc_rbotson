var config = global.config.plugins.irc_log,
    util = require("util"),
    Q = require("q"),
    nano,
    db,
    authCookie = "";


var reloadConfig = function reloadConfig(oldConfig) {
        config = global.config.plugins.irc_log;

        if (oldConfig.db_server !== config.db_server) {
            initDatabase();
        }
        else {
            if (oldConfig.db_name !== config.db_name ||
                oldConfig.db_pass !== config.db_pass) {
                authDatabase();
            }
        }
    },

    initDatabase = function initDatabase(cb) {
        nano =  require("nano")(config.db_server);
        db = nano.use(config.db_name);
        authDatabase(cb);
    },

    authDatabase = function authDatabase(cb){
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

        // Cookie expires every 10 minutes; we'll grab a new one every 9.
        setInterval(authDatabase, 9 * 60 * 1000);

        if (cb) cb();
    },

    onRaw = function onRaw(message) {
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
    },

    onNick = function onNick(oldNick, newNick, channels, message) {
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
    },

    onKill = function onKill(nick, reason, channels, message) {
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
    },

    onQuit = function onQuit(nick, reason, channels, message) {
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
    },

    onSelfMessage = function (target, message) {
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
    };

    insert = function insert(data) {
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
    },

    insertMultiChannels = function insertMultiChannels(data, channels) {
        for (var i = 0; i < channels.length; i++) {
            data.channel = channels[i];
            insert(data);
        }
    };

exports.reloadConfig = reloadConfig;
exports.start = function (cb) {
    initDatabase();

    // Catch all messages from server, and database those we're interested in.
    global.irc
        .on("raw", onRaw)
        .on("nick", onNick)
        .on("kill", onKill)
        .on("quit", onQuit)
        .on("selfMessage", onSelfMessage);  // Capture messages RBotson sends to the IRC server.

    if (cb) cb();
};
