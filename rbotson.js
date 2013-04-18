var fs = require("fs"),
    util = require("util"),
    irc = require("irc");

// Load config
global.loadConfig = function loadConfig (cb) {
    util.log("Loading config");
    if (fs.existsSync('config.json')) {
        var oldConfig = global.config;
        global.config = JSON.parse(fs.readFileSync('config.json'));

        if (global.plugins) {
            // Only do this if global.plugins exists; else plugin dependencies wont be init'd.
            for (var k in global.config.plugins) {
                if (global.plugins[k]) {
                    util.log("Reloading plugin: " + k);
                    global.plugins[k].reloadConfig(oldConfig.plugins[k]);
                }
                else {
                    util.log("Loading new plugin: " + k);
                    loadPlugin(k);
                }
            }
        }
        if (cb) cb();
    }
    else {
        throw new Error("No config.js, wat do vOv?!");
    }
};

var loadPlugin = function loadPlugin(pluginName) {
        if (!global.plugins) global.plugins = {};
        global.plugins[pluginName] = require("./plugins/" + pluginName);
        global.plugins[pluginName].start(function(){
            util.log("Loaded " + pluginName);
        });
    },
    onRegistered = function onRegistered(message) {
        util.log("rbotson.js - Connected to IRC.");
        global.irc.whois(global.irc.nick, function(info){
            global.irc.user = info.user;
            global.irc.host = info.host;
        });

        if (global.config.irc_nickserv_pw) global.irc.say("nickserv", "identify " + global.config.irc_nickserv_pw);

        // Load plugins
        for (var k in config.plugins) {
            loadPlugin(k);
        }
    },
    onError = function onError(message) {
        util.log('IRC error: ', message);
    };

(function() {
    global.helpers = require("./helpers");
    global.loadConfig(function onConfigLoaded(){
        // Set up IRC
        util.log("rbotson.js - Connecting to IRC");
        global.irc = new irc.Client(
            global.config.irc_server,
            global.config.irc_nickname,
            global.config.irc_options
        );

        global.irc
            .on("registered", onRegistered)

            // Handle IRC server errors
            .on('error', onError);

    });
})();