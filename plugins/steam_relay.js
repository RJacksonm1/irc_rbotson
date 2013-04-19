var config = global.config.plugins.steam_relay,
    util = require("util"),
    shortenUrl = global.helpers.shortenUrl,
    steam = require("steam"),
    fs = require("fs"),
    groupidsToChannels = {},
    channelsToGroupids = {},
    logonAttempts = 0,
    sentry,
    bot;


var reloadConfig = function reloadConfig(oldConfig) {
        config = global.config.plugins.steam_relay;

        if (oldConfig.steam_user !== config.steam_user) {
            // log("reloadConfig - steam_user changed.");
            log("reloadConfig - steam_user changed, but I can't handle this :(");

            // Code doesn't work, need to figure out how to gracefully
            // terminate original bot instance.

            // bot._connection.destroy();
            // delete bot._connection;
            // onSteamLogOff();
            // setTimeout(botLogOn, 1000); // To make sure onSteamLogOff removes event listeners on old bot instance.
        }

        else if (oldConfig.auth_code !== config.auth_code) {
            log("reloadConfig - auth_code changed.");
            botLogOn();
        }

        else if (oldConfig.steam_name !== config.steam_name) {
            log("reloadConfig - steam_name changed.");
            bot.setPersonaName(config.steam_name);
        }

        else if (oldConfig.relays !== config.relays) {
            // TODO: Debug this; seems to fire regardless.
            log("reloadConfig - relays changed.");
            for (var i = 0; i < config.relays.length; i++) {
                initRelayChannel(config.relays[i]);
            }
        }
    },

    botLogOn = function botLogOn() {
        log("Attempting to log on!");
        bot = new steam.SteamClient()
            .on("loggedOn", onSteamLogOn)
            .on("loggedOff", onSteamLogOff)
            .on('servers', onSteamServers)
            .on('error', onSteamError)
            .logOn(config.steam_user, config.steam_pass, sentry || config.auth_code || undefined);
    },

    log = function log(message) {
        util.log("steam_relay.js - " + message);
    },

    ircSay = function ircSay(channel, message) {
        log("Sending message to IRC: " + JSON.stringify(arguments));
        global.irc.say(channel, util.format("[\x1fSTEAM\x1f] %s", message));
    },

    steamSay = function steamSay(id, message) {
        log("Sending message to Steam: " + JSON.stringify(arguments));
        bot.sendMessage(id, "[IRC] " + message);
    },

    initRelayChannel = function initRelayChannel(item) {
        log("Setting up relay between " + item.groupid + " and " + item.channel);
        bot.joinChat(item.groupid);

        // Map channels to group ids & reverse, for ez access.
        groupidsToChannels[item.groupid] = item.channel;
        channelsToGroupids[item.channel] = item.groupid;
    },

    onSteamLogOn = function onSteamLogOn(){
        log("Received onSteamLogOn");

        // Make visible and set name.
        bot.setPersonaState(steam.EPersonaState.Online)
            .setPersonaName(config.steam_name);

        // Event listeners.
        bot
            .on("chatMsg", onSteamChatMessage)
            .on("friendMsg", onSteamFriendMessage)
            .on('chatStateChange', onSteamChatStateChange)
            .on('sentry', onSteamSentry);

        global.irc
            .on("message#", onIrcMessage)
            .on("selfMessage", onIrcSelfMessage)
            .on('action', onIrcAction)
            .on('+mode -mode', onIrcMode)
            .on('kick', onIrcKick)
            .on('join', onIrcJoin)
            .on('part', onIrcPart)
            .on('quit', onIrcQuit);

        // Set up relays.
        for (var i = 0; i < config.relays.length; i++) {
            initRelayChannel(config.relays[i]);
        }
    },

    onSteamLogOff = function onSteamLogOff(){
        log("Received onSteamLogOff");

        // Clean up event listeners.
        bot
            .removeListener("chatMsg", onSteamChatMessage)
            .removeListener("friendMsg", onSteamFriendMessage)
            .removeListener('chatStateChange', onSteamChatStateChange)
            .removeListener('sentry', onSteamSentry);

        global.irc
            .removeListener("message#", onIrcMessage)
            .removeListener("selfMessage", onIrcSelfMessage)
            .removeListener('action', onIrcAction)
            .removeListener('+mode -mode', onIrcMode)
            .removeListener('kick', onIrcKick)
            .removeListener('join', onIrcJoin)
            .removeListener('part', onIrcPart)
            .removeListener('quit', onIrcQuit);
    },

    onSteamServers = function onSteamServers(servers) {
        log("Received onSteamServers");

        fs.writeFile(config.servers_file, JSON.stringify(servers));
    },

    onSteamError = function onSteamError(err){
        log(err);
        if (err == "Error: Logon fail: 63" && logonAttempts < 10) {
            //FIXME: This code never gets triggered.

            // 63 means user, pass, or sentry are wrong.
            sentry = null;
            logonAttempts++;
            botLogOn();
        }
    },

    onSteamChatMessage = function onSteamChatMessage(source, message, type, chatter){
        log("Received onSteamChatMessage: " + JSON.stringify(arguments));
        if (type == steam.EChatEntryType.ChatMsg) {
            var channel = groupidsToChannels[source];
            var game = bot.users[chatter].gameName;
            var name = bot.users[chatter].playerName;

            ircSay(
                groupidsToChannels[source],
                require('util').format(game ? "\x033%s\x03: %s" : "\x032%s\x03: %s", name, message)
            );
        }
    },

    onSteamFriendMessage = function onSteamFriendMessage(source, message, type, chatter){
        log("Received onSteamFriendMessage: " + JSON.stringify(arguments));
        if (type == steam.EChatEntryType.ChatMsg) {
            bot.sendMessage(source, "Hi. I currently have nothing to say to you, sorry!", steam.EChatEntryType.ChatMsg);
        }
    },

    onSteamChatStateChange = function onSteamChatStateChange(stateChange, chatterActedOn, groupid, chatterActedBy) {
        log("Received onSteamChatStateChange: " + JSON.stringify(arguments));
        if (stateChange == steam.EChatMemberStateChange.Kicked && chatterActedOn == bot.steamID) {
            bot.joinChat(groupid);  // autorejoin!
        }

        if (groupid in groupidsToChannels) {
            shortenUrl("http://steamcommunity.com/profiles/" + chatterActedOn, function(url){
                var name = bot.users[chatterActedOn].playerName + ' (' + url + ')';
                switch (stateChange) {
                    case steam.EChatMemberStateChange.Entered:
                        ircSay(groupidsToChannels[groupid], name + ' entered chat.');
                        break;
                    case steam.EChatMemberStateChange.Left:
                        ircSay(groupidsToChannels[groupid], name + ' left chat.');
                        break;
                    case steam.EChatMemberStateChange.Disconnected:
                        ircSay(groupidsToChannels[groupid], name + ' disconnected.');
                        break;
                    case steam.EChatMemberStateChange.Kicked:
                        ircSay(groupidsToChannels[groupid], name + ' was kicked by ' + bot.users[chatterActedBy].playerName + '.');
                        break;
                    case steam.EChatMemberStateChange.Banned:
                        ircSay(groupidsToChannels[groupid], name + ' was banned by ' + bot.users[chatterActedBy].playerName + '.');
                }
            });
        }
    },

    onSteamSentry = function onSteamSentry(_sentry) {
        log("Received onSteamSentry: " + JSON.stringify(arguments));
        fs.writeFileSync(config.sentry_file, _sentry);
        sentry = _sentry;
    },

    onIrcMessage = function onIrcMessage(nick, to, text, message){
        log("Received onIrcMessage: " + JSON.stringify(arguments));
        if (to in channelsToGroupids) {
            text = text.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, "");
            steamSay(channelsToGroupids[to], "<" + nick + "> " + text, steam.EChatEntryType.ChatMsg);

            var command = (new RegExp(global.irc.nick + ":?\\s*(.*)", "i")).exec(text);
            if (command) {
                switch (command[1]) {
                    case "group":
                        global.irc.say(to, message.nick + ": steam://friends/joinchat/" + channelsToGroupids[to]);
                        break;
                }
            }
        }
    },

    onIrcSelfMessage = function onIrcSelfMessage(target, message){
        log("Received onIrcSelfMessage: " + JSON.stringify(arguments));
        if (target in channelsToGroupids) {
            message = message.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, "");
            if (message.indexOf("[STEAM]") !== 0) {
                // Delay by 1 second in case it's an IRC command and selfMessage is being parsed before message.
                setTimeout(function(){
                    bot.sendMessage(channelsToGroupids[target], message, steam.EChatEntryType.ChatMsg);
                }, 1000);
            }
        }
    },

    onIrcAction = function onIrcAction(from, to, message) {
        log("Received onIrcAction: " + JSON.stringify(arguments));
        if (to in channelsToGroupids) {
            steamSay(channelsToGroupids[to], from + ' ' + message);
        }
    },

    onIrcMode = function onIrcMode(channel, by, mode, argument, message) {
        log("Received onIrcMode: " + JSON.stringify(arguments));
        if (channel in channelsToGroupids && mode == 'b') {
            if (message.args[1].substring(0, 1) === "+") steamSay(channelsToGroupids[channel], by + ' sets ban on ' + argument);
            else steamSay(channelsToGroupids[channel], by + ' removes ban on ' + argument);
        }
    },

    onIrcKick = function onIrcKick(channel, nick, by, reason, message) {
        log("Received onIrcKick: " + JSON.stringify(arguments));
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], by + ' has kicked ' + nick + ' from ' + channel + ' (' + reason + ')');
    },

    onIrcJoin = function onIrcJoin(channel, nick) {
        log("Received onIrcJoin: " + JSON.stringify(arguments));
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has joined ' + channel);
    },

    onIrcPart = function onIrcPart(channel, nick) {
        log("Received onIrcPart: " + JSON.stringify(arguments));
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has left ' + channel);
    },

    onIrcQuit = function onIrcQuit(nick, reason, channels) {
        log("Received onIrcQuit: " + JSON.stringify(arguments));
        for (var i = 0; i < channels.length; i++) {
            if (channels[i] in channelsToGroupids) steamSay(channelsToGroupids[channels[i]], nick + ' has quit (' + reason + ')');
        }
    };

exports.reloadConfig = reloadConfig;
exports.start = function (cb) {
    if (fs.existsSync(config.servers_file)) {
        log("Loading servers from file.");
        steam.servers = JSON.parse(fs.readFileSync(config.servers_file));
    }
    if (fs.existsSync(config.sentry_file)) {
        log("Loading sentry from file.");
        sentry = fs.readFileSync(config.sentry_file);
    }

    botLogOn();

    if (cb) cb();
};