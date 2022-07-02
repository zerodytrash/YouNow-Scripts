// ==UserScript==
// @name         YouNow Locale Switcher
// @namespace    https://zerody.one
// @version      0.1
// @description  Switch the locale of the trending list and explore page (featured list) without changing your YouNow account settings
// @author       ZerodyOne
// @match        https://www.younow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var cdnHost = 'https://cdn.younow.com/';
    var localeOverride = JSON.parse(localStorage.getItem('localeOverride'));
    var locales = ['en', 'de', 'es', 'tr', 'me', 'ww'];
    var hideOtherLocales = true;

    var nativeXmlHttpOpen = XMLHttpRequest.prototype.open;
    var nativeJsonParse = window.JSON.parse;

    // Intercept GET-Requests and modify locale param
    XMLHttpRequest.prototype.open = function(method, url) {
        if(method === 'GET' && typeof url === 'string' && url.indexOf(cdnHost) === 0) {
            if(url.includes('younow/dashboard') || url.includes('younow/trendingUsers')) {
                let normalizedUrl = url.replace(cdnHost, '').replace(/\//g, '&');
                let urlParams = new URLSearchParams(normalizedUrl);

                if(localeOverride) {
                    urlParams.set('locale', localeOverride);
                    arguments[1] = cdnHost + urlParams.toString().replace(/&/g, '/').replace(/=\//g, '/');
                }
            }
        }

        nativeXmlHttpOpen.apply(this, arguments);
    }

    window.JSON.parse = function() {
        let data = nativeJsonParse.apply(this, arguments);
        if(typeof data === 'object' && data !== null && hideOtherLocales && localeOverride && localeOverride !== 'ww') {
            // unfortunately wtw and wtf from /reco/loggedIn doesnt have a locale flag.
            // so we remove the entries...
            if(data.wtw) data.wtw = [];
            if(data.wtf) data.wtf = [];

            // filter out trending users from other locales
            if(data.trending_users) data.trending_users = data.trending_users.filter(x => x.locale === localeOverride);
        }

        return data;
    }

    let topbarFinder = setInterval(() => {
        let topbarRight = document.querySelector('.topbar .right > .user-logged-in');
        if(!topbarRight) return;

        clearInterval(topbarFinder);

        var inputWrapper = document.createElement('div');
        inputWrapper.classList.add('input-wrapper');
        inputWrapper.classList.add('input-wrapper--select');
        inputWrapper.style['margin-right'] = '15px';

        var select = document.createElement('select');
        select.classList.add('input');
        select.classList.add('select');

        [null, ...locales].forEach(locale => {
            var option = document.createElement('option');
            option.value = locale;
            option.innerText = locale ? locale.toUpperCase() : 'Off';
            option.selected = locale === localeOverride;
            select.appendChild(option);
        })

        select.addEventListener('change', function() {
            localStorage.setItem('localeOverride', JSON.stringify(this.value));
            window.location.reload();
        });

        inputWrapper.appendChild(select);
        topbarRight.insertBefore(inputWrapper, topbarRight.children[1]);

    }, 100);

})();
