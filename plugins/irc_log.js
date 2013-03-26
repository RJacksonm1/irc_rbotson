var config;
var nano;
var db;

exports.initialise = function (irc_client, _config, _nano, cb) {
    config = _config;
    nano = _nano(config.db_server);
    db = nano.use(config.db_name);

    irc_client.on("raw", function(message){
        message.timestamp = parseInt(new Date().getTime()/1000, 10);
        switch (message.command) {
            // TODO: Figure out how do quit, kill, notice, nick.
            default:
                // This will catch: MODE, TOPIC, JOIN, PART, KICK
                if (config.channels.indexOf(message.args[0]) > -1) insert(message);
                break;
        }
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
}