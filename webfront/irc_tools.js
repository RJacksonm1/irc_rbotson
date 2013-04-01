var util = require('util');
var tokenizer = require('node-tokenizer');
var validator = require("validator");

tokenizer.rule("bold",          /^\u0002/);
tokenizer.rule("colour_fg_bg",  /^\u0003(\d{1,2}),(\d{1,2})/);
tokenizer.rule("colour_fg",     /^\u0003(\d{1,2})/);
tokenizer.rule("colour_reset",  /^\u0003/);
tokenizer.rule("italic",        /^\u0009/);
// tokenizer.rule("strike",        /^\u0013/);
tokenizer.rule("reset",         /^\u000f/);
tokenizer.rule("underline",     /^\u001f/);
// tokenizer.rule("reverse",       /^\u0016/);
tokenizer.rule("catch_all",     /^.|\n/);

var colVals = { // Using default mIRC colours
            White: "#CCCCCC", // 0 "White",
            Black: "#000000", // 1 "Black",
            DarkBlue: "#3636B2", // 2 "DarkBlue",
            DarkGreen: "#2A8C2A", // 3 "DarkGreen",
            Red: "#C33B3B", // 4 "Red",
            DarkRed: "#C73232", // 5 "DarkRed",
            DarkViolet: "#80267F", // 6 "DarkViolet",
            Orange: "#66361F", // 7 "Orange",
            Yellow: "#D9A641", // 8 "Yellow",
            LightGreen: "#3DCC3D", // 9 "LightGreen",
            Cyan: "#1A5555", // 10 "Cyan",
            LightCyan: "#2F8C74", // 11 "LightCyan",
            Blue: "#4545E6", // 12 "Blue",
            Violet: "#B037B0", // 13 "Violet",
            DarkGray: "#4C4C4C", // 14 "DarkGray",
            LightGray: "#959595" // 15 "LightGray"
    };

var colNames = [
    "White",
    "Black",
    "DarkBlue",
    "DarkGreen",
    "Red",
    "DarkRed",
    "DarkViolet",
    "Orange",
    "Yellow",
    "LightGreen",
    "Cyan",
    "LightCyan",
    "Blue",
    "Violet",
    "DarkGray",
    "LightGray"
];

function colour(identifier) {
    return (isNaN(identifier)) ? colVals[identifier] : colVals[colNames[identifier]];
}

function htmlColour (identifier, content) {
    return "<span style=\"color:" + colour(identifier) + "\">" + content + "</span>";
}

exports.htmlColour = htmlColour;

function ircToHtml(raw_text) {

    sanitized_text = validator.sanitize(raw_text).entityEncode()
    var tokens = tokenizer.tokenize(sanitized_text);
    var states = {
        bold: false,
        colour: false,
        italic: false,
        underline: false
    };
    var output = "";
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        switch (true) {
            case /^\u0002/.test(token): // Bold
                output += (states.bold === false) ? "<strong>" : "</strong>";
                states.bold = !states.bold;
                break;

            case /^\u0003(\d{1,2}),(\d{1,2})/.test(token): // Colour FG BG
                output += "<span style=\"color:" + colour(parseInt(result[1], 10)) + ";background-color:" + ircColours[parseInt(result[2], 10)] + "\">";
                break;

            case /^\u0003(\d{1,2})/.test(token): // Colour FG
                var result = /^\u0003(\d{1,2})/.exec(token);
                console.log(result);
                output += "<span style=\"color:" + colour(parseInt(result[1], 10)) + "\">";
                break;

            case /^\u0003/.test(token): // Colour
                output += "</span>";
                states.colour = false;
                break;

            case /^\u0009/.test(token): // Italic
                output += (states.italic === false) ? "<em>" : "</em>";
                states.italic = !states.italic;
                break;

            case /^\u0013/.test(token): // Strike
                break;

            case /^\u000f/.test(token): // Reset
                if (states.bold === true) {
                    output += "</strong>";
                }
                if (states.colour === true) {
                    output += "</span>";
                }
                if (states.italic === true) {
                    output += "</em>";
                }
                if (states.underline === true) {
                    output += "</span>";
                }
                states = {
                    bold: false,
                    colour: false,
                    italic: false,
                    underline: false
                };
                break;

            case /^\u001f/.test(token): // Underline
                output += (states.underline === false) ? "<span style=\"text-decoration: underline;\">" : "</span>";
                states.underline = !states.underline;
                break;

            default: // Rest
                output += token;
        }
    }
    return output;
}

exports.ircToHtml = ircToHtml;

// JonathonK of StackOverflow. http://stackoverflow.com/a/2315478
function formatTime(unixTimestamp) {
    var dt = new Date(unixTimestamp * 1000);

    var hours = dt.getHours();
    var minutes = dt.getMinutes();
    var seconds = dt.getSeconds();

    // the above dt.get...() functions return a single digit
    // so I prepend the zero here when needed
    if (hours < 10)
     hours = '0' + hours;

    if (minutes < 10)
     minutes = '0' + minutes;

    if (seconds < 10)
     seconds = '0' + seconds;

    return hours + ":" + minutes + ":" + seconds;
}

exports.dataParse = function(data){
    var message;
    var channel = data.channel;
    var actor = data.actor;
    var command = data.command;
    var args = data.args;
    var user = "*";

    switch (command) {
        case "PRIVMSG":
            message = ircToHtml(args[0]);
            user = htmlColour("Blue", "&lt;" + actor.name + "&gt;");

            // Do fancy stuff if it's the bot talking.
            if (["RBotson", "RFeedson"].indexOf(actor.name) > -1) {
                var steamIdentifier = "[<span style=\"text-decoration: underline;\">STEAM</span>]";
                if (message.indexOf(steamIdentifier) === 0) {
                    // Steam message.  Be fancy
                    message = message.substring(steamIdentifier.length + 1);
                    user = htmlColour("Blue", "STEAM");
                }
            }
            break;

        case "JOIN":
            message = htmlColour("DarkGreen", util.format("%s (%s@%s) has joined %s", actor.name, actor.user, actor.host, channel));
            user = htmlColour("DarkGreen", "*");
            break;

        case "PART":
            message = htmlColour("DarkRed", util.format("%s (%s@%s) has left %s", actor.name, actor.user, actor.host, channel));
            user = htmlColour("DarkRed", "*");
            break;

        case "TOPIC":
            message = util.format("%s has changed the topic to: %s", actor.name, args[0]);
            break;

        case "MODE":
            if (data.actedUpon) {
                var actedUpon = data.actedUpon;
                modes = args[0].substring(1);
                sign = args[0].substring(0, 1);
                message = util.format((sign == "+") ? "%s gives %s to %s" : "%s removes %s from %s", actor.name, modes, actedUpon.name);
            }
            else {
                message = util.format("%s sets mode %s %s", actor.name, args[0], channel);
            }
            break;

        case "KICK":
            var actedUpon = data.actedUpon;
            message = util.format("%s has kicked %s from %s (%s)", actor.name, actedUpon.name, channel, args[0]);
            break;

        case "NICK":
            message = util.format("%s is now known as %s", actor.name, args[0]);
            break;

        case "KILL":
            message = util.format("THE ALLLL~~MIGHTY LORD, FROM THE HEAVENS ABOVE, STRIKES DOWN THE NONBELIEVER.  BYE %s (%s)", actor.name, args[0]);
            break;
    }
    return {
        time: formatTime(data.timestamp),
        user: user,
        message: message,
        channel: channel
    };
};