var googleapis = require("googleapis"),
    util = require("util");

    exports.shortenUrl = function shortenUrl(url, cb) {
        googleapis.discover('urlshortener', 'v1')
            .execute(function(err, client) {
                client.urlshortener.url
                    .insert(null, {longUrl: url})
                    .withApiKey(global.config.google_api_key)
                    .execute(function (err, result){
                        if (!err) {
                            cb(result.id);
                        }
                        else {
                            cb(url);
                        }
                });
        });
    };

exports.strCapitalize = function strCapitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

exports.numPadLeft = function numPadLeft(num, base, chr) {
    var  len = (String(base || 10).length - String(num).length)+1;
    return len > 0? new Array(len).join(chr || '0')+num : num;
};

exports.filterWikitext = function filterWikitext(rc, inline, callback) {
    inline = inline || false;

    // Filter MW links
    text = rc.comment.replace(/\[\[(.+?)(?:|\|(.+?))\]\]/g, function(match, link, name){
        link = link.replace(/ /g, "_");
        if (link.substring(0,1) === "#") link = rc.title + link;
        if (!name) name = link;
        return util.format("\x02%s\x02 (%s)", name, rc.base_url + link);
    });

    // Filter MW templates
    text = text.replace(/\{\{(.+?)(?:|\|.+?)\}\}/g, function(match, template_name){
        template_name = template_name.replace(/ /g, "_");
        return util.format("\x02%s\x02 (%s)", template_name, rc.base_url + 'Template:' + template_name);
    });

    // Filter newliens if inline == true
    if (inline === true)
    {
        text = text.replace(/\n/g, ' ');
    }

    callback(text);
};