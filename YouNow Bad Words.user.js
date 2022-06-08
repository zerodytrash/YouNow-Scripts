// ==UserScript==
// @name         YouNow Bad Words
// @namespace    https://github.com/zerodytrash/YouNow-Scripts/
// @version      0.3
// @description  This script allows you to write anything in YouNow chats without getting filtered
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var nativeXmlHttpSend = XMLHttpRequest.prototype.send;

    // Intercept POST-Requests and mondify content
    XMLHttpRequest.prototype.send = function(data) {
        if(typeof data === "string" && data.indexOf("comment=") >= 0) {
            var params = new URLSearchParams(data)
            var comment = params.get("comment");

            params.set("comment", obfuscateText(comment));

            data = params.toString();
        }

        nativeXmlHttpSend.call(this, data);
    }

    function obfuscateText(text) {
        var obfuscatedText = "";
        var magicChar = String.fromCharCode(8203); //zero-width space
        var mention = false;

        // Append the magic char after every second char
        for(var i = 0; i < text.length; i++) {

            // Prevent from breaking @mentions
            if(text[i] === ' ') mention = false;
            if(text[i + 1] === '@') mention = true;

            obfuscatedText += text[i] + (i % 2 > 0 && !mention ? magicChar : "");
        }

        return obfuscatedText;
    }

})();
