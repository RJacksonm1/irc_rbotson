String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
Number.prototype.padLeft = function(base,chr){
    var  len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
};
shortenUrl = require("../helpers").shortenUrl;

var irc_client;
var http;
var querystring;

function initialise(_irc_client, config, _http, _querystring, cb) {
    irc_client = _irc_client;
    http = _http;
    querystring = _querystring;

    for (var i = 0; i < config.length; i++) {
        checkRecentChanges(config[i]);
        setInterval(checkRecentChangesCB(config[i]), config[i].interval);
    }
    console.log("Loaded RC");
    if (cb) cb();
}

function checkRecentChangesCB(config) {
  return function(){
    checkRecentChanges(config);
  };
}

function checkRecentChanges(config) {
    getRCFromMediaWiki(config.api_url, config.params, function(rcs){
        if (rcs.length) {
            for (var i = 0; i < rcs.length; i++) {
                if (rcs[i].rcid <= config.last_rcid) {
                    continue;
                }
                else {
                    config.last_rcid = rcs[i].rcid;
                }
                rcs[i].base_url = config.base_url;
                rcToIRC(rcs[i], config.irc_channel);
            }
            config.params.rcstart = parseInt(new Date().getTime()/1000, 10);
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

        if (rc.comment) statement += " (\x0314" + rc.comment.replace(/(?:\[|\]|\{|\})/g,"") +"\x03)"; // Escape []{} bcuz Spacenet.

        var date = new Date(rc.timestamp),
            dateFm = [ date.getUTCHours().padLeft(), date.getUTCMinutes().padLeft(), date.getUTCSeconds().padLeft()].join(":");
        statement += " (\x0304" + dateFm + "\x03)";

        irc_client.say(channel, statement);
    });
}

exports.initialise = initialise;