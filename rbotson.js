var googleapis = require("googleapis");
var http = require("http");
var irc = require("irc");
var querystring = require("querystring");

// Load config
var config = require("./rbotson_conf");
var rc_configs = config.rc_configs;

// Set up IRC
console.log("Connecting to IRC");
var client = new irc.Client(
    config.irc_server,
    config.irc_nickname,
    config.irc_options
);

client.on("registered", function(message){
    console.log("Connected to IRC.");
    for (var i = 0; i < rc_configs.length; i++) {  // Once connected start checking RCs
        if (rc_configs[i].enabled){
            checkRecentChanges(rc_configs[i]);
            setInterval(checkRecentChangesCB(rc_configs[i]), rc_configs[i].rc_interval);
        }
    }
    if (config.irc_nickserv_pw) client.say("nickserv", "identify " + config.irc_nickserv_pw);
});

function checkRecentChangesCB(config) {
  return function(){
    checkRecentChanges(config);
  };
}

// Handle IRC server errors
client.addListener('error', function(message) {
    console.log('error: ', message);
});


// RC-related stuffs
function checkRecentChanges(config) {
    getRCFromMediaWiki(config.rc_api_url, config.rc_params, function(rcs){
        if (rcs.length) {
            for (var i = 0; i < rcs.length; i++) {
                if (rcs[i].rcid <= config.rc_last) {
                    continue;
                }
                else {
                    config.rc_last = rcs[i].rcid;
                }
                rcs[i].base_url = config.rc_base_url;
                rcToIRC(rcs[i], config.irc_channel);
            }
            config.rc_params.rcstart = parseInt(new Date().getTime()/1000, 10);
        }
    });
}

function getRCFromMediaWiki(rc_api_url, rc_params, cb, rc_start) {
    rc_start = rc_start || null;

    var params = rc_params;
    params.nonsensebcuzcache = parseInt(new Date().getTime()/1000, 10);
    if (rc_start !== null) (params.rcstart = rc_start);

    var url = rc_api_url + querystring.stringify(params) + "&";

    http.get(url, function(res){
        var data = "";
        res.on("data", function(chunk){
            data += chunk;
        });
        res.on("end", function(){
            console.log("Received data from RC check");
            var js_data = JSON.parse(data);
            cb(js_data.query.recentchanges);

            if ("query-continue" in js_data) {
                cosole.log("Query-continue present, grabbing more data");
                getRCFromMediaWiki(rc_api_url, rc_params, cb, js_data["query-continue"].recentchanges.rcstart);
            }
        });
    });
}

function rcToIRC(rc, channel) {
    console.log("Sending RC to IRC.");

    var url = "";
    if (rc.type == "log") url = rc.base_url + "?title=" + rc.title.replace("_", " ");
    else url = rc.base_url + "?title=" + rc.title.replace("_", " ") + "&diff=" + rc.revid + "&oldid=" + rc.old_revid;

    shortenUrl(url, function(url){
        var flags = "";
        if ("redirect" in rc) flags += "R";
        if (rc.type == "new") flags += "N";
        if (rc.type == "log") flags += "L";
        if ("minor" in rc) flags +="m";
        if ("bot" in rc) flags +="b";
        if (!flags.length) flags = "-";

        statement = "[\x1fRC\x1f]";
        statement += " \x02\x0304" + flags + "\x03\x02";
        if (rc.type == "log") statement += " \x0304" + rc.logaction.capitalize() + "\x03";
        statement += " \x02\x0310" + rc.title + "\x03";
        statement += " \x02by \x02\x0306" + rc.user + "\x03\x02";
        statement += " - " + url;

        sizeDiff = (rc.newlen - rc.oldlen);
        if (sizeDiff < 0) sizeDiffFm = "\x0304" + sizeDiff + "\x03";
        else if (sizeDiff === 0) sizeDiffFm = "\x0314" + sizeDiff + "\x03";
        else if (sizeDiff > 0) sizeDiffFm = "\x0303+" + sizeDiff + "\x03";
        if (Math.abs(sizeDiff) >= 512) sizeDiffFm = "\x02" + sizeDiffFm + "\x02";
        statement += " (" + sizeDiffFm +")";

        if (rc.comment) statement += " (\x0314" + rc.comment +"\x03)";

        var date = new Date(rc.timestamp),
            dateFm = [ date.getUTCHours().padLeft(), date.getUTCMinutes().padLeft(), date.getUTCSeconds().padLeft()].join(":");
        statement += " (\x0304" + dateFm + "\x03)";

        client.say(channel, statement);
    });
}

// Helpers
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
Number.prototype.padLeft = function(base,chr){
    var  len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
};

function shortenUrl(url, cb) {
    googleapis.load('urlshortener', 'v1', function(err, client) {
        client.withApiKey(config.google_api_key);
        client.urlshortener.url
            .insert(null, {longUrl: url})
            .execute(function (err, result){
                if (!err) {
                    cb(result.id);
                }
                else {
                    cb(url);
                }
            });
    });
}