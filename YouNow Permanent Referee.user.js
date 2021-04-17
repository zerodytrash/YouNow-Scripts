// ==UserScript==
// @name         YouNow Permanent Referee
// @namespace    https://zerody.one
// @version      0.3
// @description  Set users as permanent channel moderators on YouNow
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    var channelId = null;
    var channelModeratorsLcKey = "channelModerators";
    var channelModerators = readRefereesFromLocalStorage();
    var nativeJsonParse = window.JSON.parse;
    var nativeXmlHttpOpen = XMLHttpRequest.prototype.open;
    var nativeXmlHttpSend = XMLHttpRequest.prototype.send;
    var currentMiniProfileId = null;
    var addTemporaryRefereeActionId = 10;
    var addPermanentRefereeActionId = 13371337;
    var removePermanentRefereeActionId = 13371338;
    var lastProcessedBroadcastId = null;

    function readRefereesFromLocalStorage() {
        channelModerators = JSON.parse(localStorage.getItem(channelModeratorsLcKey));
        if(channelModerators === null) channelModerators = [];
    }

    function assignReferees(broadcastId, existingReferees) {
        readRefereesFromLocalStorage();
        channelModerators.forEach((moderatorUserId) => {
            if(existingReferees.includes(moderatorUserId)) return;

            fetch("//api.younow.com/php/api/doAdminAction", {
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-by": localStorage.getItem("requestBy")
                },
                "body": "actionId=" + addTemporaryRefereeActionId + "&userId=" + channelId + "&onUserId=" + moderatorUserId + "&broadcastId=" + lastProcessedBroadcastId + "&broadcaster=0",
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            });
        });
    }

    function convertYouNowArrayToNormalArray(stupidArray) {
        if(!stupidArray) return [];
        var parsedObject = JSON.parse(stupidArray);
        if(Array.isArray(parsedObject)) return parsedObject;
        var tempArray = [];
        for (var key in parsedObject) {
            tempArray.push(parsedObject[key]);
        }
        return tempArray;
    }

    window.JSON.parse = function(text, reviver) {
        var parsedData = nativeJsonParse(text, reviver);

        if(parsedData !== null && typeof parsedData === "object") {

            // capture channel info from api/younow/user response
            if(parsedData.errorCode === 0 && parsedData.session && parsedData.userId && parsedData.profile) {
                channelId = parsedData.userId;
            }

            // add additional menu items
            if(currentMiniProfileId && parsedData.actions && Array.isArray(parsedData.actions) && parsedData.actions.length > 0) {
                readRefereesFromLocalStorage();
                var isPermaMod = channelModerators.includes(currentMiniProfileId);
                parsedData.actions.push({
                    "actionId": isPermaMod ? removePermanentRefereeActionId : addPermanentRefereeActionId,
                    "actionName": isPermaMod ? "Remove as Permanent Referee" : "Assign as Permanent Referee",
                    "broadcastRelated": "0",
                    "channels": "0",
                    "allowForLowerLevelsOnly": false
                })
            }
        }

        return parsedData;
    }


    // Intercept the channel-getInfo request
    XMLHttpRequest.prototype.open = function() {
        if(arguments[0] === "GET" && arguments[1].indexOf("/api/getUserActions") >= 0 && arguments[1].indexOf("/channelId=") >= 0) {
            var urlParams = arguments[1].split("/");
            urlParams.forEach((urlParam) => {
                if(urlParam.indexOf("channelId=") === 0) currentMiniProfileId = parseInt(urlParam.split("=")[1]);
            })
        }

        nativeXmlHttpOpen.apply(this, arguments);
    };

    // Intercept the data send by doAdminAction request
    XMLHttpRequest.prototype.send = function() {
        if(arguments.length > 0 && arguments[0] && typeof arguments[0] === "string" && arguments[0].indexOf("{") === -1) {
            var postParams = new URLSearchParams(arguments[0]);
            var actionId = parseInt(postParams.get("actionId"));
            var userId = parseInt(postParams.get("onUserId"));
            var broadcastId = parseInt(postParams.get("broadcastId"));

            if(userId && actionId === addPermanentRefereeActionId) {
                if(!confirm("Assign this user as permanent referee?")) return;
                if(channelModerators.includes(userId)) return;

                channelModerators.push(userId);
                localStorage.setItem(channelModeratorsLcKey, JSON.stringify(channelModerators));

                // is current broadcast related
                if(broadcastId && lastProcessedBroadcastId && broadcastId === lastProcessedBroadcastId) {
                    postParams.set("actionId", addTemporaryRefereeActionId);
                    arguments[0] = postParams.toString();
                } else {
                    return;
                }
            }

            if(userId && actionId === removePermanentRefereeActionId) {
                var index = channelModerators.indexOf(userId);
                channelModerators.splice(index, 1);
                localStorage.setItem(channelModeratorsLcKey, JSON.stringify(channelModerators));

                return;
            }
        }

        nativeXmlHttpSend.apply(this, arguments);
    };

    setInterval(() => {
        if(!channelId) return;
        fetch("//api.younow.com/php/api/broadcast/info/curId=0/channelId=" + channelId).then(response => response.json()).then((broadcastInfo) => {
            broadcastInfo.broadcastId = parseInt(broadcastInfo.broadcastId);

            if(broadcastInfo.broadcastId && lastProcessedBroadcastId !== broadcastInfo.broadcastId) {
                lastProcessedBroadcastId = broadcastInfo.broadcastId;
                var broadcastMods = convertYouNowArrayToNormalArray(broadcastInfo.broadcastMods);
                assignReferees(broadcastInfo.broadcastId, broadcastMods);
            }
        });
    }, 10000);

})();
