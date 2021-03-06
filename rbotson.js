var fs = require("fs"),
    util = require("util"),
    irc = require("irc");

global.helpers = require("./helpers");
global.config = require("./config");

// Load config

// Set up IRC
util.log("rbotson.js - Connecting to IRC");
global.irc = new irc.Client(
    config.irc_server,
    config.irc_nickname,
    config.irc_options
);

global.irc
    .on("registered", function(message){
        util.log("rbotson.js - Connected to IRC.");
        global.irc.whois(global.irc.nick, function(info){
            global.irc.user = info.user;
            global.irc.host = info.host;
        });

        if (config.irc_nickserv_pw) global.irc.say("nickserv", "identify " + config.irc_nickserv_pw);

        // Load plugins
        for (var k in config.plugins) {
            require("./plugins/" + config.plugins[k].name)();
        }
    })

    // Handle IRC server errors
    .on('error', function(message) {
        util.log('IRC error: ', message);
    });