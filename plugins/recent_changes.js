var config = global.config.plugins.recent_changes,
    util = require("util"),
    shortenUrl = global.helpers.shortenUrl,
    strCapitalize = global.helpers.strCapitalize,
    strCapitalize = global.helpers.strCapitalize,
    numPadLeft = global.helpers.numPadLeft,
    http = require("http"),
    querystring = require("querystring");

module.exports = function (cb) {
    var checkRecentChangesCB = function checkRecentChangesCB(wiki_config) {
      return function(){
        checkRecentChanges(wiki_config);
      };
    };

    for (var i = 0; i < config.wikis.length; i++) {
        if (config.wikis[i].enabled) setInterval(checkRecentChangesCB(config.wikis[i]), config.wikis[i].interval);
    }

    util.log("Plugin loaded " + config.name);
    if (cb) cb();
};

function checkRecentChanges(wiki_config) {
    getRCFromMediaWiki(wiki_config.api_url, wiki_config.params, function(rcs){
        if (rcs.length) {
            for (var i = 0; i < rcs.length; i++) {
                if (rcs[i].rcid <= wiki_config.last_rcid) {
                    continue;
                }
                else {
                    wiki_config.last_rcid = rcs[i].rcid;
                }
                rcs[i].base_url = wiki_config.base_url;
                rcToIRC(rcs[i], wiki_config.irc_channel);
            }
            wiki_config.params.rcstart = parseInt(new Date().getTime()/1000, 10);
        }
    });
}

function getRCFromMediaWiki(rc_api_url, rc_params, cb, rc_start) {
    rc_start = rc_start || null;

    var params = rc_params;
    params.nonsensebcuzcache = parseInt(new Date().getTime()/1000, 10);
    if (rc_start) (params.rcstart = rc_start);

    var url = rc_api_url + querystring.stringify(params) + "&";

    http.get(url, function(res){
        var data = "";
        res.on("data", function(chunk){
            data += chunk;
        })
        .on("end", function(){
            util.log("recent_changes.js - Received data from RC check");
            // TODO:  Retry X times on fail.
            try {
                var js_data = JSON.parse(data);
                cb(js_data.query.recentchanges);
                if ("query-continue" in js_data) {
                    console.log("Query-continue present, grabbing more data");
                    getRCFromMediaWiki(rc_api_url, rc_params, cb, js_data["query-continue"].recentchanges.rcstart);
                }
            }
            catch (e) {
                util.log("recent_changes.js - Error on json.parse: ", e);
            }

        })
        .on("error", function(){
            util.log("recent_changes.js - http callback, res, got an error event =(");
        });
    });
}

function rcToIRC(rc, channel) {
    util.log("recent_changes.js - Sending RC to IRC.");

    var url = "";
    if (rc.type === "log") url = rc.base_url + "?title=" + rc.title.replace("_", " ");
    else url = rc.base_url + "?title=" + rc.title.replace("_", " ") + "&diff=" + rc.revid + "&oldid=" + rc.old_revid;

    shortenUrl(url, function(url){
        var flags = "";
        if ("redirect" in rc) flags += "R";
        if (rc.type === "new") flags += "N";
        if (rc.type === "log") flags += "L";
        if ("minor" in rc) flags +="m";
        if ("bot" in rc) flags +="b";
        if (!flags.length) flags = "-";

        sizeDiff = (rc.newlen - rc.oldlen);
        if (sizeDiff < 0) sizeDiffFm = "\x0304" + sizeDiff + "\x03";
        else if (sizeDiff === 0) sizeDiffFm = "\x0314" + sizeDiff + "\x03";
        else if (sizeDiff > 0) sizeDiffFm = "\x0303+" + sizeDiff + "\x03";
        if (Math.abs(sizeDiff) >= 512) sizeDiffFm = "\x02" + sizeDiffFm + "\x02";

        var date = new Date(rc.timestamp),
            dateFm = [ numPadLeft(date.getUTCHours()), numPadLeft(date.getUTCMinutes()), numPadLeft(date.getUTCSeconds())].join(":"),
            comment = (function(comment){
                // MW link regex.
                // TODO restructure with Q promises.
            }(rc.comment));

        statement = require("util").format(
            "[\x1fRC\x1f] \x02\x0304%s\x03\x02%s \x02\x0310%s\x03 \x02by \x02\x0306%s\x03\x02 - %s (%s)%s (\x0305%s\x03)",
            flags,
            (rc.type == "log") ? " \x0304" + strCapitalize(rc.logaction) + "\x03" : "",
            rc.title,
            rc.user,
            url,
            sizeDiffFm,
            (rc.comment) ? " (\x0314" + rc.comment.replace(/(?:\[|\]|\{|\})/g,"") +"\x03)" : "",
            dateFm
            );
        global.irc.say(channel, statement);
    });
}