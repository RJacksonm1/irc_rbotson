var config = require("../../config");
/*
 * GET home page.
 */

var brand = 'RBotson';

exports.index = function(req, res){
    res.redirect("/home");
};

exports.home = function(req, res){
    res.render('home', {
        title: 'asd!',
        id: 'home',
        brand: brand,
        channels: config.irc_relayed_channels
    });
};