// ==UserScript==
// @name         YouNow Undercover
// @namespace    https://zerody.one
// @version      0.3
// @description  This script will make you invisible in the YouNow audience list
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const pusherHijackInterval = setInterval(() => {
        if (typeof window.Pusher?.prototype?.subscribe === 'function'){
            const nativePusherSubscribe = window.Pusher.prototype.subscribe;

            clearInterval(pusherHijackInterval);

            window.Pusher.prototype.subscribe = function(channelName) {
                if (channelName.indexOf('public-on-channel') === 0) {
                    arguments[0] = arguments[0].split('_').slice(0, 2).join('_') + '_0_0';
                }
                return nativePusherSubscribe.apply(this, arguments);
            }
        }
    }, 1);
})();
