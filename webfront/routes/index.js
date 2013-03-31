var config = require("../../config").plugins.irc_log;
var nano = require('nano')(config.db_server);
var db = nano.use(config.db_name);
var irc_tools = require('./../irc_tools.js');
var dataParse = irc_tools.dataParse;
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.redirect("/home");
};

exports.home = function(req, res){
    db.list({include_docs: true}, function (err, data, header) {
        var frontData = {};

        for (var i = 0; i < data.rows.length; i++) {
            if (!frontData[data.rows[i].doc.channel]) frontData[data.rows[i].doc.channel] = [];
            frontData[data.rows[i].doc.channel].push(dataParse(data.rows[i].doc));
        }
        res.render('home', {
            title: 'asd!',
            channels: config.channels,
            data: frontData
        });
    });
};