var config = global.config.plugins.utility_commands;

var onUserIsNickservAuthed = function onUserIsNickservAuthed (user, cb) {
    var noticeCheckAttempts = 0;
    var maxNoticeCheckAttempts = 15;
    global.irc.say("NickServ", "ACC " + user);

    /* Cannot use "on" here as the anonymous function would continue to
    fire for future calls of this method; thus firing the current-state
    callback in future events.*/
    var onNoticeNickServAuthCheck = function onNoticeNickServAuthCheck(nick, to, text){
        var notWhoWeWant = false;
        var authResponse = /(.+?) ACC ([0-3])/.exec(text);
        if (nick === "NickServ" && to === global.irc.nick && authResponse) {
            if (authResponse[1] === user) {
                switch (authResponse[2]) {
                    case "0":
                        // User not online or nickname not registered.
                        break;

                    case "1":
                        // User not recognized as nicknames owner.
                        break;

                    case "2":
                        // User recognized as owner via access list.
                        cb();
                        break;
                    case "3":
                        // User recignozed as owner via password id.
                        cb();
                        break;
                }
            }
            else {
                notWhoWeWant = true;
            }
        }
        if (notWhoWeWant && noticeCheckAttempts < maxNoticeCheckAttempts) {
            // If this notice is not the one we want, try again.
            noticeCheckAttempts++;
            global.irc.once("notice", onNoticeNickServAuthCheck);
        }
    };
    global.irc.once("notice", onNoticeNickServAuthCheck);
};

var onUserIsBotAuthed = function onUserIsBotAuthed(user, cb) {
    onUserIsNickservAuthed(user, function(){
        if (config.authed_users.indexOf(user) > -1) cb();
    });
};

module.exports = function (cb) {

    global.irc.on("message", function onIrcMessage(from, to, message){
        var command = (new RegExp(global.irc.nick + ":?\\s*(.*)", "i")).exec(message);

        // Trim leading or trailing whitespace
        command = (command) ? command[1].replace(/^\s+|\s+$/g, "") : undefined;

        if (command) {
            // Auth commands
            onUserIsBotAuthed(from, function(){
                switch (true) {
                    case /^op\s*(.*)/.test(command):
                        (function (){
                            var target = /^op\s*(.*)/.exec(command)[1] || from;
                            global.irc.send("MODE", to, "+o", target);
                        }());
                        break;
                    case /^deop\s*(.*)/.test(command):
                        (function (){
                            var target = /^deop\s*(.*)/.exec(command)[1] || from;
                            global.irc.send("MODE", to, "-o", target);
                        }());
                        break;
                    case /^voice\s*(.*)/.test(command):
                        (function (){
                            var target = /^voice\s*(.*)/.exec(command)[1] || from;
                            global.irc.send("MODE", to, "+v", target);
                        }());
                        break;
                    case /^devoice\s*(.*)/.test(command):
                        (function (){
                            var target = /^devoice\s*(.*)/.exec(command)[1] || from;
                            global.irc.send("MODE", to, "-v", target);
                        }());
                        break;
                    case /^join\s*(.*)/.test(command):
                        (function (){
                            // TODO Check target exists before joining
                            var target = /^join\s*(.*)/.exec(command)[1] || undefined;
                            if (target) {
                                global.irc.join(target);
                            }
                            else {
                                global.irc.say(to, from + ": That ain't no channel I've ever heard of.");
                            }
                        }());
                        break;

                    case /^part\s*(.*)/.test(command):
                        (function (){
                            // TODO Refuse if logging or relay is enabled.
                            var target = /^part\s*(.*)/.exec(command)[1] || to;
                            global.irc.part(target);
                        }());
                        break;
                }
            });

            // Free-for-all commands
            switch (true) {
                case /^kiss your cousin\s*(.*)/.test(command):
                    global.irc.action(to, "kisses Spacenet juicily");
                    break;
                case /^boop\s*(.*)/.test(command):
                    global.irc.say(to, from + ": beep");
                    break;
                case /^(?:src|source|sauce)\s*(.*)/.test(command):
                    global.irc.say(to, from + ": https://github.com/RJacksonm1/irc_rbotson");
                    break;
            }
        }

    });

    console.log("Loaded " + config.name);
    if (cb) cb();
};