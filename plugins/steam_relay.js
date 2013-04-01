var config = global.config.plugins.steam_relay,
    shortenUrl = global.helpers.shortenUrl,
    steam = require("Steam"),
    fs = require("fs"),
    groupidsToChannels = {},
    channelsToGroupids = {},
    sentry,
    bot;

exports.initialise = function (cb) {
    if (fs.existsSync('servers')) {
        steam.servers = JSON.parse(fs.readFileSync('servers'));
    }

    bot = new steam.SteamClient()
        .logOn(config.steam_user, config.steam_pass, fs.readFileSync('sentry'))
        .on("loggedOn", function onSteamLogOn(){
            bot.setPersonaState(steam.EPersonaState.Online) // to display your bot's status as "Online"
                .setPersonaName(config.steam_name); // to change its nickname

            for (var i = 0; i < config.relays.length; i++) {
                // Join Steam Group chats.
                bot.joinChat(config.relays[i].groupid);

                // Map channels to group ids & reverse, for ez access.
                groupidsToChannels[config.relays[i].groupid] = config.relays[i].channel;
                channelsToGroupids[config.relays[i].channel] = config.relays[i].groupid;
            }
        })
        .on("chatMsg", function onSteamChatMessage(source, message, type, chatter){
            if (type == steam.EChatEntryType.ChatMsg) {
                var channel = groupidsToChannels[source];
                var game = bot.users[chatter].gameName;
                var name = bot.users[chatter].playerName;

                ircSay(
                    groupidsToChannels[source],
                    require('util').format(game ? "\x033%s\x03: %s" : "\x032%s\x03: %s", name, message)
                );
            }
        })
        .on("friendMsg", function onSteamFriendMessage(source, message, type, chatter){
            if (type == steam.EChatEntryType.ChatMsg) {
                bot.sendMessage(source, "Hi. I currently have nothing to say to you, sorry!", Steam.EChatEntryType.ChatMsg);
            }
        })
        .on('chatStateChange', function onSteamChatStateChange(stateChange, chatterActedOn, groupid, chatterActedBy) {

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
        })
        .on('sentry', function onSteamSentry(sentry) {
            require('fs').writeFileSync('sentry', sentry);
        })
        .on('servers', function onSteamServers(servers) {
            fs.writeFile('servers', JSON.stringify(servers));
        });

    // IRC Events
    global.irc
        .on("message#", function onIrcMessage(nick, to, text, message){
            if (to in channelsToGroupids) {
                steamSay(channelsToGroupids[to], "<" + nick + "> " + text, steam.EChatEntryType.ChatMsg);

                var command = (new RegExp(global.irc.opt.nick + ":?\\s*(.*)", "i")).exec(text);
                if (command) {
                    switch (command[1]) {
                        case "group":
                            global.irc.say(to, "steam://friends/joinchat/" + channelsToGroupids[to]);
                            break;
                    }
                }
            }
        })
        .on('action', function onIrcAction(from, to, message) {
            if (to in channelsToGroupids) {
                steamSay(channelsToGroupids[to], from + ' ' + message);
            }
        })
        .on('+mode -mode', function onIrcMode(channel, by, mode, argument, message) {
            if (channel in channelsToGroupids && mode == 'b') {
                if (message.args[1].substring(0, 1) === "+") steamSay(channelsToGroupids[channel], by + ' sets ban on ' + argument);
                else steamSay(channelsToGroupids[channel], by + ' removes ban on ' + argument);
            }
        })
        .on('kick', function(channel, nick, by, reason, message) {
            if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], by + ' has kicked ' + nick + ' from ' + channel + ' (' + reason + ')');
        })
        .on('join', function(channel, nick) {
            console.log(channel, nick);
            if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has joined ' + channel);
        })
        .on('part', function(channel, nick) {
            if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has left ' + channel);
        })
        .on('quit', function(nick, reason, channels) {
            for (var i = 0; i < channels.length; i++) {
                if (channels[i] in channelsToGroupids) steamSay(channelsToGroupids[channels[i]], nick + ' has quit (' + reason + ')');
            }
        });

    console.log("Loaded " + config.name);
    if (cb) cb();
};

function ircSay(channel, message) {
    global.irc.say(channel, require('util').format("[\x1fSTEAM\x1f] %s", message));
}

function steamSay(id, message) {
    bot.sendMessage(id, "[IRC] " + message);
}