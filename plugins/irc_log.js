var config;
var nano;
var db;

exports.initialise = function (irc_client, _config, _nano, cb) {
    config = _config;
    nano = _nano(config.db_server);
    db = nano.use(config.db_name);

    irc_client.on("raw", function(message){
        message.timestamp = parseInt(new Date().getTime()/1000, 10);
        insert_raw(message);
    });
    console.log("Loaded irc log");
    if (cb) cb();
};

function insert_raw(message) {
    db.insert(message, function(error, http_body, http_headers) {
        if(error) {
            console.error(error);
        }
    });
}