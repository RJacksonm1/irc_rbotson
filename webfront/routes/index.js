var config = require("../../config").plugins.irc_log;
var nano = require('nano')(config.db_server);
var db = nano.use(config.db_name);
/*
 * GET home page.
 */

var brand = 'RBotson';

exports.index = function(req, res){
    res.redirect("/home");
};

exports.home = function(req, res){
    db.list({include_docs: true}, function (err, data, header) {
        res.render('home', {
            title: 'asd!',
            id: 'home',
            brand: brand,
            channels: config.channels,
            data: data.rows
        });
    });
};