shortenUrl = require("../helpers").shortenUrl;

var config;
var Steam;
var fs;
var irc_client;
var sentry;
var bot;
var groupidsToChannels = {};
var channelsToGroupids = {};

exports.initialise = function (_irc_client, _config, _steam, _fs, cb) {
    config = _config;
    Steam = _steam;
    fs = _fs;
    irc_client = _irc_client;

    if (fs.existsSync('servers')) {
        Steam.servers = JSON.parse(fs.readFileSync('servers'));
    }

    bot = new Steam.SteamClient();
    bot.logOn(config.steam_user, config.steam_pass, fs.readFileSync('sentry'));

    // Bot events
    bot.on("loggedOn", function(){
        bot.setPersonaState(Steam.EPersonaState.Online); // to display your bot's status as "Online"
        bot.setPersonaName(config.steam_name); // to change its nickname
        for (var i = 0; i < config.relays.length; i++) {
            // Join Steam Group chats.
            bot.joinChat(config.relays[i].groupid);

            // Map channels to group ids & reverse, for ez access.
            groupidsToChannels[config.relays[i].groupid] = config.relays[i].channel;
            channelsToGroupids[config.relays[i].channel] = config.relays[i].groupid;
        }
    });

    bot.on("chatMsg", function(source, message, type, chatter){
        if (type == Steam.EChatEntryType.ChatMsg) {
            var channel = groupidsToChannels[source];
            var game = bot.users[chatter].gameName;
            var name = bot.users[chatter].playerName;

            ircSay(
                groupidsToChannels[source],
                require('util').format(game ? "\x033%s\x03: %s" : "\x032%s\x03: %s", name, message)
            );
        }
    });

    bot.on("friendMsg", function(source, message, type, chatter){
        if (type == Steam.EChatEntryType.ChatMsg) {
            bot.sendMessage(source, "Hi. I currently have nothing to say to you, sorry!", Steam.EChatEntryType.ChatMsg);
        }
    });

    bot.on('chatStateChange', function(stateChange, chatterActedOn, groupid, chatterActedBy) {
        if (stateChange == Steam.EChatMemberStateChange.Kicked && chatterActedOn == bot.steamID) {
            bot.joinChat(groupid);  // autorejoin!
        }
        if (groupid in groupidsToChannels) {
            shortenUrl("http://steamcommunity.com/profiles/" + chatterActedOn, function(url){
                var name = bot.users[chatterActedOn].playerName + ' (' + url + ')';
                switch (stateChange) {
                    case Steam.EChatMemberStateChange.Entered:
                        ircSay(groupidsToChannels[groupid], name + ' entered chat.');
                        break;
                    case Steam.EChatMemberStateChange.Left:
                        ircSay(groupidsToChannels[groupid], name + ' left chat.');
                        break;
                    case Steam.EChatMemberStateChange.Disconnected:
                        ircSay(groupidsToChannels[groupid], name + ' disconnected.');
                        break;
                    case Steam.EChatMemberStateChange.Kicked:
                        ircSay(groupidsToChannels[groupid], name + ' was kicked by ' + bot.users[chatterActedBy].playerName + '.');
                        break;
                    case Steam.EChatMemberStateChange.Banned:
                        ircSay(groupidsToChannels[groupid], name + ' was banned by ' + bot.users[chatterActedBy].playerName + '.');
                }
            });
        }
    });

    // Bot utility
    bot.on('sentry', function(sentry) {
        require('fs').writeFileSync('sentry', sentry);
    });
    bot.on('servers', function(servers) {
        fs.writeFile('servers', JSON.stringify(servers));
    });

    // IRC Events
    irc_client.on("message#", function(nick, to, text, message){
        if (to in channelsToGroupids) {
            steamSay(channelsToGroupids[to], "<" + nick + "> " + text, Steam.EChatEntryType.ChatMsg);
        }
    });


    irc_client.on('action', function(from, to, message) {
        if (to in channelsToGroupids) {
            steamSay(channelsToGroupids[to], from + ' ' + message);
        }
    });

    irc_client.on('+mode', function(channel, by, mode, argument, message) {
        if (channel in channelsToGroupids && mode == 'b') {
            steamSay(channelsToGroupids[channel], by + ' sets ban on ' + argument);
        }
    });

    irc_client.on('-mode', function(channel, by, mode, argument, message) {
        if (channel in channelsToGroupids && mode == 'b') {
            steamSay(channelsToGroupids[channel], by + ' removes ban on ' + argument);
        }
    });

    irc_client.on('kick#', function(channel, nick, by, reason, message) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], by + ' has kicked ' + nick + ' from ' + details.channel + ' (' + reason + ')');
    });

    irc_client.on('join#', function(channel, nick) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has joined ' + details.channel);
    });

    irc_client.on('part#', function(channel, nick) {
        if (channel in channelsToGroupids) steamSay(channelsToGroupids[channel], nick + ' has left ' + details.channel);
    });

    irc_client.on('quit', function(nick, reason, channels) {
        for (var i = 0; i < channels.length; i++) {
            if (channels[i] in channelsToGroupids) steamSay(channelsToGroupids[channels[i]], nick + ' has quit (' + reason + ')');
        }
    });
    console.log("Loaded " + config.name);
    if (cb) cb();
};

function ircSay(channel, message) {
    irc_client.say(channel, require('util').format("[\x1fSTEAM\x1f] %s", message));
}

function steamSay(id, message) {
    bot.sendMessage(id, "[IRC] " + message);
}