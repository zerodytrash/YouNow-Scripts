// ==UserScript==
// @name         YouNow Undercover
// @namespace    https://zerody.one
// @version      0.2
// @description  This script will make you invisible in the YouNow audience list
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var nativeSharedWorker = window.SharedWorker;

    // Intercept the creation of shared workers to hijack YouNow's Pusher connection
    window.SharedWorker = function(url, name) {
        var worker = new nativeSharedWorker(url, name);

        if(url.includes("pusher-shared-worker")) {
            interceptPusherWorker(worker);
        }

        return worker;
    };

    function interceptPusherWorker(worker) {
        var nativePostMessage = worker.port.postMessage;

        // Intercept shared worker communication by hijacking the postMessage function
        worker.port.postMessage = function(message, transferList) {

            // Set the UserID to 0 on any pusher channel, this will cause an anonymous subscription
            if(message && message.type && message.type === "LISTEN_TO_PUBLIC") {
                message.data.userId = 0;
            }

            // Redirect the modified message to the original (native) postMessage function
            nativePostMessage.call(worker.port, message, transferList);
        }
    }

})();
