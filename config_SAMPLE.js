var config = {};

config.plugins = {
    irc_log: {
        name: "irc_log",
        dependencies: ["fs"],
        channels: ["#somechannel"],
        db_name: "rbotson_irc_log",
        db_server: "http://localhost:5984"
    },
    recent_changes: {
        name: "recent_changes",
        dependencies: ["http", "querystring"],
        wikis: [
            {
                enabled: false,
                irc_channel: "#somechannel",
                interval: 30000,
                api_url: "http://www.the_best_wiki.com/w/api.php?",
                base_url: "http://www.the_best_wiki.com/w/",
                last_rcid: 0,
                params: {
            "action": "query",
            "list": "recentchanges",
            "format": "json",
            "rcprop": "user|comment|title|ids|timestamp|sizes|redirect|flags|loginfo",
            "rcshow": "!bot",
            "rclimit": 100,
            "rcdir": "newer",
            "rcstart": parseInt(new Date().getTime()/1000, 10)
                }
            }
        ]
    }
};

config.google_api_key = "";
config.irc_server = "irc.freenode.com";
config.irc_nickname = "RBotson";
config.irc_nickserv_pw = null;
var irc_channels = ["#somechannel"];

config.irc_options = {
    userName: 'RBotson',
    realName: 'RJ made a node.js IRC bot! Woo!',
    port: 6667,
    debug: true,
    showErrors: false,
    autoRejoin: true,
    channels: irc_channels,
    floodProtection: true,
    floodProtectionDelay: 1000
};

module.exports = config;