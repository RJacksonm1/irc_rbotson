var irc_client = null;

function initialise(irc_client, config, fs, cb) {
    irc_client = irc_client;

    // irc_client.on("topic", function(channel, topic, nick, message){});
    // irc_client.on("join", function(channel, nick, message){});
    // irc_client.on("part", function(channel, nick, reason, message){});
    // irc_client.on("quit", function(nick, reason, channels, message){});
    // irc_client.on("kick", function(channel, nick, by, reason, message){});
    // irc_client.on("message", function(nick, to, text, message){});
    // irc_client.on("nick", function(oldnick, newnick, channels, message){});
    // irc_client.on("+mode", function(channel, by, mode, argument, message){});
    // irc_client.on("-mode", function(channel, by, mode, argument, message){});
    irc_client.on("raw", function(message){
        fs.appendFile("./raw_log.txt", JSON.stringify(message) + "\n", function(err){
            if (err) console.error(err);
        });
    });
    console.log("Loaded irc log");
    if (cb) cb();
}

exports.initialise = initialise;