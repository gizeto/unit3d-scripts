// ==UserScript==
// @name         UNIT3D Favorite Subtitle Flags
// @namespace    https://github.com/gizeto/unit3d-scripts
// @version      0.7
// @description  Show flags for favorite subtitle languages on UNIT3D torrents
// @author       gizeto
// @match        */torrents
// @match        */torrents?*
// @match        */torrents/similar/*
// @icon         https://hdinnovations.github.io/HDInnovations/media/favicon.ico
// @updateURL    https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/subtitle-flags.user.js
// @downloadURL  https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/subtitle-flags.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEYS = {
        FAVORITE_SUBS: 'unit3d_favorite_subs',
        API_KEYS: 'unit3d_api_keys',
        SUBTITLE_LANGUAGE_CACHE: 'unit3d_subtitle_language_cache'
    };

    const DEFAULT_FAVORITE_SUBS = ['English'];
    const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Map language names from MediaInfo to country codes for flags
    // Source: https://raw.githubusercontent.com/HDInnovations/UNIT3D/master/app/Helpers/Helpers.php
    const LANG_MAP = {
        'English': 'us', 'English (US)': 'us', 'English (GB)': 'gb', 'English (CA)': 'can', 'English (AU)': 'au',
        'Albanian': 'al', 'Albanian (AL)': 'al',
        'Arabic': 'ae', 'Arabic (001)': 'ae', 'Arabic (AE)': 'ae', 'Arabic (SA)': 'sa', 'Arabic (MA)': 'ma',
        'Armenian': 'am', 'Azerbaijani': 'az', 'Belarusian': 'by', 'Bengali': 'bd',
        'Bosnian': 'ba', 'Bosnian (BA)': 'ba',
        'Bulgarian': 'bg', 'Bulgarian (BG)': 'bg',
        'Burmese': 'mm',
        'Chinese': 'cn', 'Mandarin': 'cn', 'Mandarin (Hans)': 'cn', 'Mandarin (Hant)': 'cn', 'Cantonese': 'cn', 'Cantonese (Hant)': 'cn', 'Chinese (Simplied)': 'cn', 'Chinese (Traditional)': 'cn', 'Chinese (Simplified)': 'cn', 'Chinese-yue-Hant': 'cn', 'Chinese-cmn-Hans': 'cn', 'Chinese-cmn-Hant': 'cn',
        'Chinese (HK)': 'hk', 'Chinese-Hant-HK': 'hk', 'Mandarin (HK)': 'hk', 'Cantonese (HK)': 'hk', 'Chinese-cmn-HK': 'hk',
        'Chinese (Taiwan)': 'tw',
        'Croatian': 'hr', 'Croatian (HR)': 'hr',
        'Czech': 'cz', 'Czech (CZ)': 'cz',
        'Danish': 'dk', 'Danish (DK)': 'dk',
        'Dutch': 'nl', 'Dutch (NL)': 'nl', 'Limburgish': 'nl', 'Dutch (BE)': 'be',
        'Estonian': 'ee', 'Estonian (EE)': 'ee',
        'Finnish': 'fi', 'Finnish (FI)': 'fi',
        'French': 'fr', 'French (FR)': 'fr', 'French (CA)': 'can-qc',
        'Georgian': 'ge',
        'German': 'de', 'German (DE)': 'de', 'German (CH)': 'ch',
        'Greek': 'gr', 'Greek (GR)': 'gr',
        'Hebrew': 'il', 'Hebrew (IL)': 'il',
        'Hindi': 'in', 'Tamil': 'in', 'Telugu': 'in', 'Hindi (IN)': 'in', 'Tamil (IN)': 'in', 'Telugu (IN)': 'in', 'Kannada': 'in', 'Kannada (IN)': 'in', 'Malayalam': 'in', 'Malayalam (IN)': 'in', 'Marathi': 'in', 'Marathi (IN)': 'in',
        'Hungarian': 'hu', 'Hungarian (HU)': 'hu',
        'Icelandic': 'is', 'Icelandic (IS)': 'is',
        'Indonesian': 'id', 'Indonesian (ID)': 'id',
        'Irish': 'ie', 'Irish (IE)': 'ie',
        'Italian': 'it', 'Italian (IT)': 'it',
        'Japanese': 'jp', 'Japanese (JP)': 'jp',
        'Kazakh': 'kz', 'Kazakh (KZ)': 'kz',
        'Korean': 'kr', 'Korean (KR)': 'kr',
        'Latvian': 'lv', 'Latvian (LV)': 'lv',
        'Lithuanian': 'lt', 'Lithuanian (LT)': 'lt',
        'Malay': 'my', 'Malay (MY)': 'my', 'Malay (SG)': 'sg',
        'Macedonian': 'mk', 'Macedonian (MK)': 'mk',
        'Mongolian': 'mn',
        'Norwegian': 'no', 'Norwegian Bokmal': 'no', 'Norwegian (NO)': 'no', 'Norwegian Bokmal (NO)': 'no', 'Norwegian Nynorsk': 'no', 'Norwegian Nynorsk (NO)': 'no',
        'Persian': 'ir',
        'Polish': 'pl', 'Polish (PL)': 'pl',
        'Portuguese': 'pt', 'Portuguese (PT)': 'pt', 'Portuguese (BR)': 'br',
        'Romanian': 'ro', 'Romanian (RO)': 'ro',
        'Russian': 'ru', 'Russian (RU)': 'ru',
        'Serbian': 'rs', 'Serbian-Latn-RS': 'rs', 'Serbian (RS)': 'rs', 'Serbian (Cyrl)': 'rs', 'Serbian (Latn)': 'rs',
        'Sinhala': 'lk',
        'Slovak': 'sk', 'Slovak (SK)': 'sk',
        'Slovenian': 'si', 'Slovenian (SI)': 'si',
        'Spanish': 'es', 'Spanish (ES)': 'es', 'Spanish (CA)': 'es', 'Spanish (EU)': 'es', 'Spanish (150)': 'es',
        'Spanish (Latin America)': 'mx', 'Spanish (LA)': 'mx', 'Spanish (MX)': 'mx',
        'Spanish (AR)': 'ar', 'Spanish (CL)': 'cl', 'Spanish (VE)': 've', 'Spanish (BO)': 'bo', 'Spanish (CO)': 'co', 'Spanish (CR)': 'cr', 'Spanish (DO)': 'do', 'Spanish (EC)': 'ec', 'Spanish (SV)': 'sv', 'Spanish (GT)': 'gt', 'Spanish (HN)': 'hn', 'Spanish (NI)': 'ni', 'Spanish (PA)': 'pa', 'Spanish (PY)': 'py', 'Spanish (PE)': 'pe', 'Spanish (PR)': 'pr', 'Spanish (UY)': 'uy',
        'Basque': 'es-pv', 'Basque (ES)': 'es-pv',
        'Catalan': 'es-ct', 'Catalan (ES)': 'es-ct',
        'Galician': 'es-ga', 'Galician (ES)': 'es-ga',
        'Swedish': 'se', 'Swedish (SE)': 'se',
        'Tagalog': 'ph', 'fil': 'ph', 'fil (PH)': 'ph', 'Filipino': 'ph', 'Filipino (PH)': 'ph',
        'Thai': 'th', 'Thai (TH)': 'th',
        'Turkish': 'tr', 'Turkish (TR)': 'tr',
        'Ukrainian': 'ua', 'Ukrainian (UA)': 'ua',
        'Vietnamese': 'vn', 'Vietnamese (VN)': 'vn',
        'Welsh': 'gb-wls'
    };

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function parseStoredJson(value) {
        if (typeof value !== 'string') {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    }

    function loadFavoriteSubs() {
        const stored = GM_getValue(STORAGE_KEYS.FAVORITE_SUBS, null);
        const parsed = parseStoredJson(stored);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (typeof stored === 'string') {
            return stored.split(',').map(sub => sub.trim()).filter(Boolean);
        }

        return DEFAULT_FAVORITE_SUBS.slice();
    }

    function loadApiKeys() {
        const parsed = parseStoredJson(GM_getValue(STORAGE_KEYS.API_KEYS, null));
        return isObject(parsed) ? parsed : {};
    }

    function saveFavoriteSubs(subs) {
        GM_setValue(STORAGE_KEYS.FAVORITE_SUBS, JSON.stringify(subs));
        CONFIG.FAVORITE_SUBS = subs;
    }

    function saveApiKeys(keys) {
        GM_setValue(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
        CONFIG.API_KEYS = keys;
    }

    function loadSubtitleCache() {
        const emptyCache = { hosts: {} };
        const parsed = parseStoredJson(GM_getValue(STORAGE_KEYS.SUBTITLE_LANGUAGE_CACHE, null));
        return isObject(parsed) && isObject(parsed.hosts) ? parsed : emptyCache;
    }

    function registerMenuCommands() {
        GM_registerMenuCommand('Set favorite subtitles', () => {
            const current = CONFIG.FAVORITE_SUBS.join(', ');
            const input = prompt('Comma-separated favorite subtitles (case-sensitive)', current);
            if (input === null) {
                return;
            }

            const favorites = input.split(',').map(sub => sub.trim()).filter(Boolean);
            saveFavoriteSubs(favorites);
            alert('Favorite subtitles saved. Reload the page to apply.');
        });

        GM_registerMenuCommand('Set API key for this site', () => {
            const hostname = window.location.hostname;
            const currentKeys = { ...CONFIG.API_KEYS };
            const input = prompt(`API key for ${hostname}`, currentKeys[hostname] || '');
            if (input === null) {
                return;
            }

            const trimmed = input.trim();
            if (trimmed) {
                currentKeys[hostname] = trimmed;
            } else {
                delete currentKeys[hostname];
            }

            saveApiKeys(currentKeys);
            alert('API key saved. Reload the page to apply.');
        });
    }

    const CONFIG = {
        FAVORITE_SUBS: loadFavoriteSubs(),
        API_KEYS: loadApiKeys()
    };

    registerMenuCommands();

    const subtitleCache = loadSubtitleCache();
    let subtitleCacheDirty = false;
    let rateLimitedUrl = null;

    function getHostCache() {
        const hostnameKey = `host:${window.location.hostname}`;
        const existing = subtitleCache.hosts[hostnameKey];
        if (isObject(existing)) {
            return existing;
        }

        subtitleCache.hosts[hostnameKey] = {};
        return subtitleCache.hosts[hostnameKey];
    }

    function isValidCacheEntry(entry, now = Date.now()) {
        return entry
            && Array.isArray(entry.languages)
            && entry.languages.every(language => typeof language === 'string')
            && Number.isFinite(entry.cachedAt)
            && entry.cachedAt <= now
            && now - entry.cachedAt < CACHE_MAX_AGE_MS;
    }

    function pruneExpiredHostCache() {
        const hostCache = getHostCache();
        const now = Date.now();

        Object.entries(hostCache).forEach(([torrentId, entry]) => {
            if (!isValidCacheEntry(entry, now)) {
                delete hostCache[torrentId];
                subtitleCacheDirty = true;
            }
        });
    }

    function cacheLanguages(torrentId, languages) {
        getHostCache()[torrentId] = {
            languages: languages.slice(),
            cachedAt: Date.now()
        };
        subtitleCacheDirty = true;
    }

    function flushSubtitleCache() {
        if (!subtitleCacheDirty) {
            return;
        }

        GM_setValue(STORAGE_KEYS.SUBTITLE_LANGUAGE_CACHE, JSON.stringify(subtitleCache));
        subtitleCacheDirty = false;
    }

    function getFlagCode(language) {
        if (LANG_MAP[language]) {
            return LANG_MAP[language];
        }

        const baseLang = language.split('(')[0].trim();
        if (LANG_MAP[baseLang]) {
            return LANG_MAP[baseLang];
        }

        return Object.entries(LANG_MAP).find(([lang]) => language.includes(lang))?.[1] || null;
    }

    function getApiKey() {
        return CONFIG.API_KEYS[window.location.hostname];
    }

    function getSimilarTmdbId() {
        return window.location.pathname.match(/similar\/\d+\.(\d+)/)?.[1] || null;
    }

    function parseSubtitles(attributes) {
        const subtitles = new Set();

        if (attributes.media_info) {
            attributes.media_info.split(/\n\s*\n/).forEach(section => {
                const trimmedSection = section.trim();
                if (/^Text/i.test(trimmedSection)) {
                    const match = /Language\s*:\s*([^\n\r]+)/i.exec(trimmedSection);
                    if (match) {
                        subtitles.add(match[1].trim());
                    }
                }
            });
        }

        if (attributes.bd_info) {
            const regex = /Subtitle\s*:\s*([^\/]+)/gi;
            let match;

            while ((match = regex.exec(attributes.bd_info)) !== null) {
                subtitles.add(match[1].trim());
            }
        }

        return Array.from(subtitles);
    }

    function collectVisibleTorrents() {
        const visible = [];

        document.querySelectorAll('.torrent-search--list__row').forEach(row => {
            const id = row.getAttribute('data-torrent-id');
            if (!id) {
                return;
            }

            visible.push({
                id,
                layout: 'search',
                renderTarget: row
            });
        });

        document.querySelectorAll('.torrent-search--grouped__name').forEach(name => {
            const link = name.querySelector('a[href*="/torrents/"]');
            const torrentIdMatch = link && link.getAttribute('href').match(/\/torrents\/(\d+)/);
            if (!torrentIdMatch) {
                return;
            }

            visible.push({
                id: torrentIdMatch[1],
                layout: 'grouped',
                renderTarget: name
            });
        });

        return visible;
    }

    function createFlagContainer(layout) {
        const container = document.createElement('span');
        container.className = 'unit3d-flag-container';
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.gap = '3px';
        container.style.marginLeft = layout === 'grouped' ? '10px' : '6px';
        return container;
    }

    function renderLanguages(visibleTorrent, languages) {
        const favoriteSubs = languages.filter(sub =>
            CONFIG.FAVORITE_SUBS.some(fav => sub.includes(fav))
        );
        const target = visibleTorrent.renderTarget;
        const parent = visibleTorrent.layout === 'grouped'
            ? target
            : target.querySelector('.torrent-icons');

        if (!parent) {
            return;
        }

        let flagContainer = parent.querySelector('.unit3d-flag-container');
        if (favoriteSubs.length === 0) {
            if (flagContainer) {
                flagContainer.remove();
            }
            return;
        }

        if (!flagContainer) {
            flagContainer = createFlagContainer(visibleTorrent.layout);
            parent.appendChild(flagContainer);
        } else {
            flagContainer.innerHTML = '';
        }

        favoriteSubs.forEach(sub => {
            const code = getFlagCode(sub);
            if (!code) {
                return;
            }

            const img = document.createElement('img');
            img.src = `/img/flags/${code}.png`;
            img.title = sub;
            img.style.height = '11px';
            img.style.verticalAlign = 'middle';
            flagContainer.appendChild(img);
        });

        if (flagContainer.children.length === 0) {
            flagContainer.remove();
            return;
        }

        if (visibleTorrent.layout === 'grouped') {
            target.style.display = 'flex';
            target.style.alignItems = 'center';
            target.style.flexWrap = 'wrap';
        }
    }

    function toInt(val) {
        const n = parseInt(val, 10);
        return Number.isNaN(n) ? null : n;
    }

    function buildApiParamsFromSearchUrl() {
        const params = new URLSearchParams(window.location.search);
        const apiParams = {};

        const arrayParamMap = {
            categoryIds: 'categories',
            typeIds: 'types',
            resolutionIds: 'resolutions',
            genreIds: 'genres',
            primaryLanguageNames: 'primaryLanguages',
            free: 'free'
        };

        const booleanKeys = new Set(['doubleup', 'featured', 'refundable', 'highspeed', 'internal', 'personalRelease', 'alive', 'dying', 'dead']);
        const numericKeys = new Set(['startYear', 'endYear', 'tmdbId', 'imdbId', 'tvdbId', 'malId', 'playlistId', 'collectionId', 'seasonNumber', 'episodeNumber', 'page', 'perPage']);
        const passthroughKeys = new Set(['name', 'description', 'mediainfo', 'bdinfo', 'uploader', 'keywords', 'file_name', 'sortField', 'sortDirection']);

        for (const [rawKey, rawVal] of params.entries()) {
            if (!rawVal.trim()) {
                continue;
            }

            const arrayMatch = rawKey.match(/^(\w+)\[\d+\]$/);
            if (arrayMatch) {
                const baseKey = arrayMatch[1];
                const apiKey = arrayParamMap[baseKey];
                if (!apiKey) {
                    continue;
                }
                if (!Array.isArray(apiParams[apiKey])) {
                    apiParams[apiKey] = [];
                }
                const numericVal = toInt(rawVal);
                apiParams[apiKey].push(numericVal !== null ? numericVal : rawVal);
                continue;
            }

            if (passthroughKeys.has(rawKey)) {
                apiParams[rawKey] = rawVal;
                continue;
            }

            if (numericKeys.has(rawKey)) {
                const n = toInt(rawVal);
                if (n !== null) {
                    apiParams[rawKey] = n;
                }
                continue;
            }

            if (booleanKeys.has(rawKey)) {
                if (rawVal === 'true' || rawVal === '1') {
                    apiParams[rawKey] = true;
                }
                continue;
            }

            if (rawKey === 'minSize' || rawKey === 'maxSize') {
                // Handle after loop with multipliers
                continue;
            }
        }

        const minSize = toInt(params.get('minSize'));
        const minMultiplier = toInt(params.get('minSizeMultiplier')) || 1;
        if (minSize !== null) {
            apiParams.minSize = minSize * minMultiplier;
        }

        const maxSize = toInt(params.get('maxSize'));
        const maxMultiplier = toInt(params.get('maxSizeMultiplier')) || 1;
        if (maxSize !== null) {
            apiParams.maxSize = maxSize * maxMultiplier;
        }

        if (!('perPage' in apiParams)) {
            apiParams.perPage = 25;
        }

        return apiParams;
    }

    function buildApiQuery(apiParams) {
        const search = new URLSearchParams();
        Object.entries(apiParams).forEach(([key, val]) => {
            if (val === null || val === undefined) {
                return;
            }
            if (Array.isArray(val)) {
                val.forEach(v => {
                    search.append(`${key}[]`, v);
                });
                return;
            }
            search.set(key, val);
        });
        return search.toString();
    }

    async function fetchApiJson(url, apiKey) {
        if (rateLimitedUrl === window.location.href) {
            return null;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            if (response.status === 429) {
                rateLimitedUrl = window.location.href;
                console.warn('Unit3D Favorite Subtitle Flags: API rate limit reached. Stopping requests for this page.');
                return null;
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error(`Unit3D Favorite Subtitle Flags: Error fetching ${url}`, e);
            return null;
        }
    }

    async function fetchFilteredTorrents(apiParams, apiKey) {
        const json = await fetchApiJson(`/api/torrents/filter?${buildApiQuery(apiParams)}`, apiKey);
        return Array.isArray(json?.data) ? json.data : [];
    }

    async function fetchTorrentById(torrentId, apiKey) {
        const json = await fetchApiJson(`/api/torrents/${torrentId}`, apiKey);
        const torrent = isObject(json?.data) ? json.data : json;
        return isObject(torrent) && torrent.id != null && isObject(torrent.attributes) ? torrent : null;
    }

    function recordTorrentLanguages(torrent, visibleById) {
        if (!torrent || torrent.id == null || !torrent.attributes) {
            return null;
        }

        const torrentId = String(torrent.id);
        const languages = parseSubtitles(torrent.attributes);
        const visibleTorrent = visibleById.get(torrentId);

        cacheLanguages(torrentId, languages);
        if (visibleTorrent) {
            renderLanguages(visibleTorrent, languages);
        }

        return torrentId;
    }

    async function resolveVisibleTorrents(visibleTorrents, fetchBulkTorrents, apiKey) {
        const visibleById = new Map(visibleTorrents.map(torrent => [torrent.id, torrent]));
        pruneExpiredHostCache();
        const hostCache = getHostCache();
        const uncachedTorrents = visibleTorrents.filter(torrent => {
            const entry = hostCache[torrent.id];
            if (!entry) {
                return true;
            }
            renderLanguages(torrent, entry.languages);
            return false;
        });

        if (uncachedTorrents.length === 0) {
            return;
        }

        if (!apiKey) {
            console.log(`Unit3D Favorite Subtitle Flags: No API Key set for ${window.location.hostname}. Use the Tampermonkey menu "Set API key for this site".`);
            return;
        }

        const bulkTorrents = await fetchBulkTorrents();
        if (rateLimitedUrl === window.location.href) {
            return;
        }

        const bulkIds = new Set();
        bulkTorrents.forEach(torrent => {
            const torrentId = recordTorrentLanguages(torrent, visibleById);
            if (torrentId !== null) {
                bulkIds.add(torrentId);
            }
        });

        const currentVisibleIds = new Set(collectVisibleTorrents().map(torrent => torrent.id));
        if (uncachedTorrents.some(torrent => !currentVisibleIds.has(torrent.id))) {
            return;
        }

        for (const visibleTorrent of uncachedTorrents) {
            if (rateLimitedUrl === window.location.href) {
                return;
            }
            if (bulkIds.has(visibleTorrent.id)) {
                continue;
            }
            const torrent = await fetchTorrentById(visibleTorrent.id, apiKey);
            if (torrent) {
                recordTorrentLanguages(torrent, visibleById);
            }
        }
    }

    async function init() {
        if (/\/torrents\/\d+(?:\/|$)/.test(window.location.pathname)) {
            return;
        }

        const visibleTorrents = collectVisibleTorrents();
        if (visibleTorrents.length === 0) {
            console.log('Unit3D Favorite Subtitle Flags: No torrent rows found on this page. Aborting.');
            return;
        }

        const apiKey = getApiKey();
        try {
            if (visibleTorrents.some(torrent => torrent.layout === 'search')) {
                const apiParams = buildApiParamsFromSearchUrl();
                await resolveVisibleTorrents(
                    visibleTorrents,
                    () => fetchFilteredTorrents(apiParams, apiKey),
                    apiKey
                );
                return;
            }

            const tmdbId = getSimilarTmdbId();
            if (!tmdbId) {
                console.log('Unit3D Favorite Subtitle Flags: Could not determine page context (TMDB ID/Category).');
                return;
            }

            await resolveVisibleTorrents(
                visibleTorrents,
                () => fetchFilteredTorrents({ perPage: 100, tmdbId }, apiKey),
                apiKey
            );
        } finally {
            flushSubtitleCache();
        }
    }

    let lastUrl = null;
    let isProcessing = false;
    let runPending = false;
    let domChangeTimer = null;
    let lastTorrentIds = null;

    async function runForCurrentUrl() {
        runPending = true;
        if (isProcessing) {
            return;
        }

        isProcessing = true;
        try {
            while (runPending) {
                runPending = false;
                await init();
            }
        } finally {
            isProcessing = false;
        }
    }

    function onLocationChange() {
        const current = window.location.href;
        if (current === lastUrl) {
            return;
        }
        lastUrl = current;
        runForCurrentUrl();
    }

    function startTorrentRowObserver() {
        lastTorrentIds = collectVisibleTorrents().map(torrent => torrent.id).join(',');

        const observer = new MutationObserver(() => {
            const torrentIds = collectVisibleTorrents().map(torrent => torrent.id).join(',');
            if (torrentIds === lastTorrentIds) {
                return;
            }
            lastTorrentIds = torrentIds;

            clearTimeout(domChangeTimer);
            domChangeTimer = setTimeout(runForCurrentUrl, 50);
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true
        });
    }

    function startLocationObserver() {
        lastUrl = window.location.href;
        runForCurrentUrl();
        startTorrentRowObserver();

        ['pushState', 'replaceState'].forEach(method => {
            const original = history[method];
            history[method] = function () {
                const result = original.apply(this, arguments);
                window.dispatchEvent(new Event('unit3d:locationchange'));
                return result;
            };
        });

        window.addEventListener('popstate', onLocationChange);
        window.addEventListener('unit3d:locationchange', onLocationChange);

        // Fallback polling in case site manipulates URL without history events
        setInterval(onLocationChange, 1000);
    }

    startLocationObserver();

})();
