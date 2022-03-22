// ==UserScript==
// @name         YouNow Real Viewer
// @namespace    https://zerody.one
// @version      0.3
// @description  Display the current viewer count instead of the like count on trending broadcasts
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var nativeJsonParse = window.JSON.parse;

    window.JSON.parse = function(text, reviver) {
        var parsedData = nativeJsonParse(text, reviver);

        if(typeof parsedData === "object" && parsedData !== null) {

            // Top 10 trending users
            if(Array.isArray(parsedData.trending_users)) processBroadcastList(parsedData.trending_users);

            // Featured users displayed on ~/explore
            if(Array.isArray(parsedData.featured_users)) processBroadcastList(parsedData.featured_users);

            // Users by location /explore/country/americas
            if(Array.isArray(parsedData.users)) processBroadcastList(parsedData.users);

            // Hashtag overview ~/explore/deutsch
            if(Array.isArray(parsedData.queues)) {
                parsedData.queues.forEach((tag) => {
                    if(Array.isArray(tag.items)) processBroadcastList(tag.items);
                });
            }

            // Broadcasts from ~/api/reco/loggedIn response
            if(Array.isArray(parsedData.preview)) processBroadcastList(parsedData.preview);
            if(Array.isArray(parsedData.wtw)) processBroadcastList(parsedData.wtw);
            if(Array.isArray(parsedData.wtf)) processBroadcastList(parsedData.wtf);
        }

        return parsedData;
    }

    function processBroadcastList(broadcastArray) {
        broadcastArray.forEach((broadcast) => {
            if(typeof broadcast.viewers !== "undefined") broadcast.likes = broadcast.viewers;
            if(typeof broadcast.v !== "undefined") broadcast.likes = broadcast.v;
            if(typeof broadcast.v !== "undefined") broadcast.tv = broadcast.v;

            if(!broadcast.viewers && !broadcast.v && broadcast.views) {
                broadcast.likes = broadcast.views;
            }
        });

        setTimeout(replaceWithViewerIcons, 10);
        setTimeout(replaceWithViewerIcons, 100);
        setTimeout(replaceWithViewerIcons, 1000);
    }

    function replaceWithViewerIcons() {
        var likeIconContainer = document.querySelectorAll(".nav-sidebar .likes, .trending-user .likes");

        Array.prototype.forEach.call(likeIconContainer, function(container) {
            var likeIcon = container.getElementsByClassName("ynicon ynicon-like");
            if(likeIcon.length > 0) {
                likeIcon[0].className = 'ynicon ynicon-viewers';
            }
        });
    }

})();
