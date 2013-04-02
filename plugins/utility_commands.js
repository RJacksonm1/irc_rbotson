var config = global.config.plugins.utility_commands;

module.exports = function (cb) {

    global.irc.on("message", function onIrcMessage(from, to, message){
        var command = (new RegExp(global.irc.nick + ":?\\s*(.*)", "i")).exec(message);

        // Trim leading or trailing whitespace
        command = (command) ? command[1].replace(/^\s+|\s+$/g, "") : undefined;

        // Auth-required commands
        if (command) {

            // Auth commands
            if (["RJackson"].indexOf(from) > -1) {
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
                            (target) ? global.irc.join(target) : global.irc.say(to, "Give me a target you fack");
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
            }

            // Free-for-all commands
            switch (true) {
                case /^kiss your cousin\s*(.*)/.test(command):
                    global.irc.action(to, "kisses Spacenet juicily");
                    break;
                case /^boop\s*(.*)/.test(command):
                    global.irc.say(to, from + ": beep");
                    break;
            }
        }

    });

    console.log("Loaded " + config.name);
    if (cb) cb();
};