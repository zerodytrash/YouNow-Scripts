// ==UserScript==
// @name         YouNow Bad Words
// @namespace    https://zerody.one
// @version      0.1
// @description  This script allows you to write anything in the YouNow chat without getting filtered
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

        // Append the magic char after every second char except before and after spaces
        for(var i = 0; i < text.length; i++) {
            obfuscatedText += text[i] + (i % 2 > 0 && text[i] !== " " && i + 1 < text.length && text[i + 1] !== " " ? magicChar : "");
        }

        return obfuscatedText;
    }

})();
