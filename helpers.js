var googleapis = require("googleapis");

exports.shortenUrl = function shortenUrl(url, cb) {
    googleapis.load('urlshortener', 'v1', function(err, client) {
        client.withApiKey(global.config.google_api_key);
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
};

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
Number.prototype.padLeft = function(base,chr){
    var  len = (String(base || 10).length - String(this).length)+1;
    return len > 0? new Array(len).join(chr || '0')+this : this;
};