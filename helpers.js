var config = require("./config");
var googleapis = require("googleapis");

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

exports.shortenUrl = shortenUrl;