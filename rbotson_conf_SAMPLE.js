var config = {};

config.rc_configs = [
    {
        enabled: true,
        irc_channel: "#somechannel",
        rc_interval: 30000,
        rc_api_url: "http://www.the_best_wiki.com/w/api.php?",
        rc_base_url: "http://www.the_best_wiki.com/w/",
        rc_last: 0,
        rc_params: {
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
];

config.google_api_key = "";
config.irc_server = "irc.freenode.com";
config.irc_nickname = "RBotson";
config.irc_nickserv_pw = null;
var irc_channels = [];  // rc_config channels are added automatically.

// Generate list of irc channels from rc_config.
for (var i = 0; i < config.rc_configs.length; i++) if (config.rc_configs[i].enabled) (irc_channels.push(config.rc_configs[i].irc_channel));

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