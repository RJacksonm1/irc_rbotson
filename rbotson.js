var irc = require("irc");
var fs = require("fs");

// Load config
var config = require("./config");

// Set up IRC
console.log("Connecting to IRC");
var client = new irc.Client(
    config.irc_server,
    config.irc_nickname,
    config.irc_options
);

client.on("registered", function(message){
    console.log("Connected to IRC.");
    if (config.irc_nickserv_pw) client.say("nickserv", "identify " + config.irc_nickserv_pw);

    // Initialise irc bot plugins
    for (var i = 0; i < config.plugins.length; i++) {
        var args = [client, config.plugins[i]];
        for (var j = 0; j < config.plugins[i].dependencies.length; j++) {
            args.push(require(config.plugins[i].dependencies[j]));
        }
        //console.log(args);
        require("./plugins/" + config.plugins[i].name).initialise.apply(null, args);
    }
});


// Handle IRC server errors
client.addListener('error', function(message) {
    console.log('error: ', message);
});

client.on("message", function(from, to, message){
    if (config.irc_relayed_channels.indexOf(to) >= 0) {
        console.log("Sending [from, to, message]");
    }
});