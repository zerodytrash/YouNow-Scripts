// ==UserScript==
// @name         YouNow Mute Overview
// @namespace    https://zerody.one
// @version      0.3
// @description  A simple moderator audit feature for YouNow
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var nativeJsonParse = window.JSON.parse;
    var currentChannelId = null;
    var mutedUserIds = [];
    var modUserIds = [];
    var broadcastInfoPollingInterval = null;
    var popup = null;
    var userInfoCache = {};

    // SVG Icons
    var usersSlash = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false" width="1.25em" height="1em" style="-ms-transform: rotate(360deg); -webkit-transform: rotate(360deg); transform: rotate(360deg);" preserveAspectRatio="xMidYMid meet" viewBox="0 0 640 512"><path d="M132.65 212.32l-96.44-74.54A63.4 63.4 0 0 0 32 160a63.84 63.84 0 0 0 100.65 52.32zm40.44 62.28A63.79 63.79 0 0 0 128 256H64a64.06 64.06 0 0 0-64 64v32a32 32 0 0 0 32 32h65.91a146.62 146.62 0 0 1 75.18-109.4zM544 224a64 64 0 1 0-64-64a64.06 64.06 0 0 0 64 64zm-43.44 131.11a114.24 114.24 0 0 0-84.47-65.28L361 247.23c41.46-16.3 71-55.92 71-103.23A111.93 111.93 0 0 0 320 32c-57.14 0-103.69 42.83-110.6 98.08L45.46 3.38A16 16 0 0 0 23 6.19L3.37 31.46a16 16 0 0 0 2.81 22.45l588.35 454.72a16 16 0 0 0 22.47-2.81l19.64-25.27a16 16 0 0 0-2.81-22.45zM128 403.21V432a48 48 0 0 0 48 48h288a47.45 47.45 0 0 0 12.57-1.87L232 289.13c-58.26 5.7-104 54.29-104 114.08zM576 256h-64a63.79 63.79 0 0 0-45.09 18.6A146.29 146.29 0 0 1 542 384h66a32 32 0 0 0 32-32v-32a64.06 64.06 0 0 0-64-64z" fill="var(--color-text-lighter)"/></svg>';
    var userShield = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false" width="1em" height="1em" style="-ms-transform: rotate(360deg); -webkit-transform: rotate(360deg); transform: rotate(360deg);" preserveAspectRatio="xMidYMid meet" viewBox="0 0 26 26"><path d="M23.633 5.028a1.074 1.074 0 0 0-.777-.366c-2.295-.06-5.199-2.514-7.119-3.477C14.551.592 13.768.201 13.18.098a1.225 1.225 0 0 0-.36.001c-.588.103-1.371.494-2.556 1.087c-1.92.962-4.824 3.417-7.119 3.476a1.08 1.08 0 0 0-.778.366a1.167 1.167 0 0 0-.291.834c.493 10.023 4.088 16.226 10.396 19.831c.164.093.346.141.527.141s.363-.048.528-.141c6.308-3.605 9.902-9.808 10.396-19.831a1.161 1.161 0 0 0-.29-.834zm-5.57 10.249c0 1.36-2.604 1.67-5.048 1.67c-2.44 0-5.077-.31-5.077-1.67v-.374c0-.999 1.8-2.011 3.333-2.564c.111-.041.641-.329.345-1.106c-.76-.775-1.334-2.034-1.334-3.271c0-1.896 1.254-2.889 2.719-2.889s2.726.993 2.726 2.889c0 1.232-.577 2.485-1.332 3.264h.003c-.289.881.174 1.09.248 1.114c1.61.532 3.418 1.536 3.418 2.564l-.001.373z" fill="var(--color-text-lighter)"/></svg>';

    // Intercept JSON-based communcation to detect the current broadcast
    window.JSON.parse = function(text, reviver) {
        var parsedData = nativeJsonParse(text, reviver);

        if(parsedData !== null && typeof parsedData === "object" && parsedData.videoAuthToken && parsedData.broadcastId && parsedData.userId) {
            initBroadcastInfoPolling(parsedData.userId);
        }

        return parsedData;
    }

    function initBroadcastInfoPolling(channelId) {

        // Prevent recursion
        if(channelId === currentChannelId) return;
        currentChannelId = channelId;

        // Create request polling interval
        if(broadcastInfoPollingInterval) clearInterval(broadcastInfoPollingInterval);
        setInterval(refreshBroadcastInfo, 10000);
        refreshBroadcastInfo();
    }

    function createUiCounter(container, id, svg, value, title, onClick) {
        var counterHtml = '';
        counterHtml += '<app-views>';
        counterHtml += '  <div class="toolbar__content ng-star-inserted" title="' + title + '">';
        counterHtml += '    <i class="ynicon">' + svg + '</i>';
        counterHtml += '    <div class="toolbar__value mono-text" id="' + id + '">' + parseInt(value) + '</div>';
        counterHtml += '  </div>';
        counterHtml += '</app-views>';

        var counterElement = document.createElement("div");
        counterElement.className = "toolbar__entry";
        counterElement.innerHTML = counterHtml;
        container.insertBefore(counterElement, container.getElementsByClassName("toolbar__entry")[1]);

        if(onClick) {
            counterElement.onclick = onClick;
            counterElement.getElementsByTagName("div")[0].style = "cursor:pointer";
        }
    }

    function refreshUiCounter() {
        var broadcastToolbarRight = document.getElementsByClassName("toolbar__right");
        if(broadcastToolbarRight.length === 0 || broadcastToolbarRight[0].getElementsByClassName("toolbar__entry").length === 0) return;

        // update existing counter or create a new one
        var upsertCounter = function(id, svg, value, title, onClick) {
            var existingCounter = document.getElementById(id);
            if(existingCounter === null) {
                createUiCounter(broadcastToolbarRight[0], id, svg, value, title, onClick);
            } else {
                existingCounter.innerText = value;
            }
        }

        upsertCounter("muteCounter", usersSlash, mutedUserIds.length, "Silent Users", popupModal);
        upsertCounter("modCounter", userShield, modUserIds.length, "Broadcast Moderators", popupModal);
    }

    function refreshBroadcastInfo() {
        fetch("https://api.younow.com/php/api/broadcast/info/curId=0/channelId=" + currentChannelId).then(response => response.json()).then((broadcastInfo) => {
            if(broadcastInfo.userId !== currentChannelId) return;

            mutedUserIds = convertYouNowArrayToNormalArray(broadcastInfo.silentFromChatUsers);
            modUserIds = convertYouNowArrayToNormalArray(broadcastInfo.broadcastMods);

            refreshUiCounter();
            refreshPopupContentIfVisible();
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

    function popupModal() {

        // focus modal if already opened
        if(popup) {
            popup.focus();
            return;
        }

        // else create a new modal
        popup = open("", "", "width=700,height=400,status=yes,scrollbars=yes,resizable=yes");
        popup.focus();
        popup.document.title = "Moderator Activity";

        var copyStyle = function(from, to, property) {
            to.style.setProperty(property, window.getComputedStyle(from, null).getPropertyValue(property));
        }

        // copy the theme from younow
        copyStyle(document.body, popup.document.body, "background-color");
        copyStyle(document.body, popup.document.body, "color");

        var mainTableHtml = '';
        mainTableHtml += '<table style="table-layout: fixed; width:100%;">';
        mainTableHtml += '   <tr style="vertical-align: top;">';
        mainTableHtml += '     <th><h3>Moderators</h3></th>';
        mainTableHtml += '     <th><h3>Silent Users</h3></th>';
        mainTableHtml += '   </tr>';
        mainTableHtml += '   <tr style="vertical-align: top;">';
        mainTableHtml += '     <td> <div id="moderatorList"> </div> </td>';
        mainTableHtml += '     <td> <div id="silentUserList"> </div> </td>';
        mainTableHtml += '   </tr>';
        mainTableHtml += '</table>';

        popup.document.body.style.setProperty("font-family", "Arial");
        popup.document.body.innerHTML = mainTableHtml;

        // set inital content
        refreshPopupContentIfVisible();

        popup.onbeforeunload = function() {
            popup = null;
        }
    }

    function refreshPopupContentIfVisible() {
        if(!popup) return;

        var generateProfileLink = function(userInfo) {
            if(userInfo.banned) return "<i>banned user</i>";
            var linkColor = window.getComputedStyle(document.body, null).getPropertyValue("color");
            return '<a href="https://www.younow.com/' + userInfo.profile + '" target="_blank" style="text-decoration: none; color: ' + linkColor + '">' + userInfo.profile + '</a>';
        }

        var generateUserList = function(userIds) {
            var userListHtml = "";
            userIds.forEach((userId) => {
                var cachedUserInfo = userInfoCache[userId];

                userListHtml += '<div style="margin-top:5px; margin-left: 10px;">';
                userListHtml += '   <img style="vertical-align: middle;" height="40" width="40" onerror="this.style.visibility=\'hidden\'" src="https://ynassets.younow.com/user/live/' + userId + '/' + userId + '.jpg"></img>';
                userListHtml += '   <div style="display:inline; margin-left: 10px;" id="username_' + userId + '">' + (cachedUserInfo ? generateProfileLink(cachedUserInfo) : "") + '</div>';
                userListHtml += '</div>';

                // retrieve the user info if not cached in 'userInfoCache'
                if(!cachedUserInfo) {
                    fetch("https://cdn.younow.com/php/api/channel/getInfo/channelId=" + userId).then(response => response.json()).then((userInfo) => {
                        userInfoCache[userId] = userInfo;

                        // if the 'profile' attribute didnt exist the user got banned.
                        if(!userInfo || !userInfo.profile) {
                            userInfoCache[userId] = {
                                banned: true
                            }
                        }

                        // insert username and link subsequently
                        var existingUsernameLabel = popup.document.getElementById("username_" + userId);
                        if(existingUsernameLabel) existingUsernameLabel.innerHTML = generateProfileLink(userInfoCache[userId]);
                    });
                }

            })

            return userListHtml;
        }

        popup.document.getElementById("moderatorList").innerHTML = generateUserList(modUserIds);
        popup.document.getElementById("silentUserList").innerHTML = generateUserList(mutedUserIds);
    }
})();
