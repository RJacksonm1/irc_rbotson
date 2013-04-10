var config = {};

config.plugins = {
    utility_commands: {
        name: "utility_commands",
        authed_users: ["RJackson"] // Nickserv ids.
    },
    steam_relay: {
        name: "steam_relay",
        dependencies: ["steam", "fs"],
        relays: [{channel: "#somechannel", groupid: "103582791429521412"}],
        steam_name: "IRC Relay",
        steam_user: "user",
        steam_pass: "password"
    },
    irc_log: {
        name: "irc_log",
        dependencies: ["nano", "socket.io"],
        channels: ["#somechannel"],
        db_name: "rbotson_irc_log",
        db_server: "http://localhost:5984",
        db_user: "",
        db_pass: "",
        live_socket_enable: true,  // To send live updates to webfront.
        live_socket_port: 2999  // To send live updates to webfront.
    },
    recent_changes: {
        name: "recent_changes",
        dependencies: ["http", "querystring"],
        wikis: [
            {
                enabled: true,
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
config.irc_channels = ["#somechannel"];

config.irc_options = {
    userName: 'RBotson',
    realName: 'RJ made a node.js IRC bot! Woo!',
    port: 6667,
    debug: true,
    showErrors: false,
    autoRejoin: true,
    channels: config.irc_channels,
    floodProtection: true,
    floodProtectionDelay: 1000
};

module.exports = config;