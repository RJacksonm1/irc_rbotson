var config = global.config.plugins.steam_relay,
    util = require("util"),
    shortenUrl = global.helpers.shortenUrl,
    steam = require("steam"),
    fs = require("fs"),
    groupidsToChannels = {},
    channelsToGroupids = {},
    sentry,
    bot;


var reloadConfig = function reloadConfig(oldConfig) {
        config = global.config.plugins.steam_relay;

        if (oldConfig.steam_user !== config.steam_user ||
            oldConfig.auth_code !== config.auth_code) {
            log("Logging on to Steam");

            // FIXME: onSteamLogOn event not firing after this.
            bot.logOn(config.steam_user, config.steam_pass, sentry || config.auth_code || undefined);
        }

        if (oldConfig.steam_name !== config.steam_name) {
            log("Changing Steam name");
            bot.setPersonaName(config.steam_name);
        }

        if (oldConfig.relays !== config.relays) {
            // TODO: Debug this; seems to fire regardless.
            log("Setting up relays");
            for (var i = 0; i < config.relays.length; i++) {
                initRelayChannel(config.relays[i]);
            }
        }
    },

    log = function log(message) {
        util.log("steam_relay.js - " + message);
    },

    ircSay = function ircSay(channel, message) {
        global.irc.say(channel, util.format("[\x1fSTEAM\x1f] %s", message));
    },

    steamSay = function steamSay(id, message) {
        bot.sendMessage(id, "[IRC] " + message);
    },

    initRelayChannel = function initRelayChannel(item) {
            bot.joinChat(item.groupid);

            // Map channels to group ids & reverse, for ez access.
            groupidsToChannels[item.groupid] = item.channel;
            channelsToGroupids[item.channel] = item.groupid;
    },

    onSteamLogOn = function onSteamLogOn(){
        log("Received onSteamLogOn event");
        bot.setPersonaState(steam.EPersonaState.Online)
            .setPersonaName(config.steam_name);

        for (var i = 0; i < config.relays.length; i++) {
            initRelayChannel(config.relays[i]);
        }
    },

    onSteamChatMessage = function onSteamChatMessage(source, message, type, chatter){
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
        if (type == steam.EChatEntryType.ChatMsg) {
            bot.sendMessage(source, "Hi. I currently have nothing to say to you, sorry!", steam.EChatEntryType.ChatMsg);
        }
    },

    onSteamChatStateChange = function onSteamChatStateChange(stateChange, chatterActedOn, groupid, chatterActedBy) {
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

    onSteamSentry = function onSteamSentry(sentry) {
        fs.writeFileSync(config.sentry_file, sentry);
    },

    onSteamServers = function onSteamServers(servers) {
        fs.writeFile(config.servers_file, JSON.stringify(servers));
    },

    onSteamError = function onSteamError(err){
        log("Steam caught an error event =( " + err);
    },

    onIrcMessage = function onIrcMessage(nick, to, text, message){
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
        if (to in channelsToGroupids) {
            steamSay(channelsToGroupids[to], from + ' ' + message);
        }
    },

    onIrcMode = function onIrcMode(channel, by, mode, argument, message) {
        if (channel in channelsToGroupids && mode == 'b') {
            if (message.args[1].substring(0, 1) === "+") steamSay(channelsToGroupids[channel], by + ' sets ban on ' + argument);
            else steamSay(channelsToGroupids[channel], by + ' removes ban on ' + argument);
        }
    },

    onIrcKick = function onIrcKick(channel, nick, by, reason, message) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], by + ' has kicked ' + nick + ' from ' + channel + ' (' + reason + ')');
    },

    onIrcJoin = function onIrcJoin(channel, nick) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has joined ' + channel);
    },

    onIrcPart = function onIrcPart(channel, nick) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has left ' + channel);
    },

    onIrcQuit = function onIrcQuit(nick, reason, channels) {
        for (var i = 0; i < channels.length; i++) {
            if (channels[i] in channelsToGroupids) steamSay(channelsToGroupids[channels[i]], nick + ' has quit (' + reason + ')');
        }
    };

exports.reloadConfig = reloadConfig;
exports.start = function (cb) {
    if (fs.existsSync(config.servers_file)) {
        steam.servers = JSON.parse(fs.readFileSync(config.servers_file));
    }
    if (fs.existsSync(config.sentry_file)) {
        sentry = JSON.parse(fs.readFileSync(config.sentry_file));
    }

    bot = new steam.SteamClient()
        .on("loggedOn", onSteamLogOn)
        .on("chatMsg", onSteamChatMessage)
        .on("friendMsg", onSteamFriendMessage)
        .on('chatStateChange', onSteamChatStateChange)
        .on('sentry', onSteamSentry)
        .on('servers', onSteamServers)
        .on('error', onSteamError);

    bot.logOn(config.steam_user, config.steam_pass, sentry || config.auth_code || undefined);

    // IRC Events
    global.irc
        .on("message#", onIrcMessage)
        .on("selfMessage", onIrcSelfMessage)
        .on('action', onIrcAction)
        .on('+mode -mode', onIrcMode)
        .on('kick', onIrcKick)
        .on('join', onIrcJoin)
        .on('part', onIrcPart)
        .on('quit', onIrcQuit);

    if (cb) cb();
};