// ==UserScript==
// @name         UNIT3D Scripts | TVDB Series Stats
// @namespace    https://github.com/gizeto/unit3d-scripts
// @version      1.4
// @description  Show TVDB status, season count, and episode count in UNIT3D series metadata
// @author       gizeto
// @match        *://*/torrents/*
// @icon         https://hdinnovations.github.io/HDInnovations/media/favicon.ico
// @updateURL    https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/tvdb-series-stats.user.js
// @downloadURL  https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/tvdb-series-stats.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api4.thetvdb.com
// ==/UserScript==

(function () {
    'use strict';

    const API_BASE_URL = 'https://api4.thetvdb.com/v4';
    const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
    const MAX_PAGES = 200;

    const STORAGE_KEYS = {
        API_KEY: 'tvdb_api_key',
        TOKEN: 'tvdb_token',
        STATS_CACHE: 'tvdb_series_stats_cache'
    };

    function getStoredSecret(key) {
        const value = GM_getValue(key, '');
        return typeof value === 'string' ? value.trim() : '';
    }

    function registerMenuCommands() {
        GM_registerMenuCommand('Set TVDB API key', () => {
            const input = prompt('Enter your TVDB API key. Leave empty to remove the saved key.', '');
            if (input === null) {
                return;
            }

            GM_setValue(STORAGE_KEYS.API_KEY, input.trim());
            alert(input.trim()
                ? 'TVDB API key saved. Reload the page to apply.'
                : 'TVDB API key removed. Reload the page to apply.');
        });

        GM_registerMenuCommand('Set TVDB token', () => {
            const input = prompt('Enter your TVDB bearer token. Leave empty to remove the saved token.', '');
            if (input === null) {
                return;
            }

            GM_setValue(STORAGE_KEYS.TOKEN, input.trim());
            alert(input.trim()
                ? 'TVDB token saved. Reload the page to apply.'
                : 'TVDB token removed. Reload the page to apply.');
        });

        GM_registerMenuCommand('Clear TVDB stats cache', () => {
            GM_setValue(STORAGE_KEYS.STATS_CACHE, {});
            alert('TVDB stats cache cleared. Reload the page to fetch fresh data.');
        });
    }

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function loadCache() {
        const stored = GM_getValue(STORAGE_KEYS.STATS_CACHE, {});
        if (isObject(stored)) {
            return stored;
        }

        if (typeof stored === 'string') {
            try {
                const parsed = JSON.parse(stored);
                return isObject(parsed) ? parsed : {};
            } catch (error) {
                return {};
            }
        }

        return {};
    }

    function isCacheEntry(entry) {
        return isObject(entry)
            && Number.isInteger(entry.seasons)
            && entry.seasons >= 0
            && Number.isInteger(entry.episodes)
            && entry.episodes >= 0
            && Number.isInteger(entry.specials)
            && entry.specials >= 0
            && typeof entry.status === 'string'
            && entry.status.length > 0
            && Number.isFinite(entry.cachedAt);
    }

    function getCachedStats(tvdbId, allowExpired = false) {
        const entry = loadCache()[tvdbId];
        if (!isCacheEntry(entry)) {
            return null;
        }

        if (!allowExpired && Date.now() - entry.cachedAt >= CACHE_MAX_AGE_MS) {
            return null;
        }

        return entry;
    }

    function cacheStats(tvdbId, stats) {
        const now = Date.now();
        const cache = loadCache();

        Object.entries(cache).forEach(([id, entry]) => {
            if (!isCacheEntry(entry) || now - entry.cachedAt >= CACHE_RETENTION_MS) {
                delete cache[id];
            }
        });

        cache[tvdbId] = { ...stats, cachedAt: now };
        GM_setValue(STORAGE_KEYS.STATS_CACHE, cache);
    }

    function request(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                timeout: 20000,
                ...options,
                onload: resolve,
                onerror: () => reject(new Error('Could not connect to TVDB.')),
                ontimeout: () => reject(new Error('The TVDB request timed out.'))
            });
        });
    }

    function parseResponse(response) {
        try {
            return JSON.parse(response.responseText);
        } catch (error) {
            throw new Error('TVDB returned an invalid response.');
        }
    }

    function getApiMessage(body) {
        if (typeof body?.message === 'string' && body.message.trim()) {
            return body.message.trim();
        }
        if (typeof body?.data === 'string' && body.data.trim()) {
            return body.data.trim();
        }
        return '';
    }

    async function createToken(apiKey) {
        const response = await request({
            method: 'POST',
            url: `${API_BASE_URL}/login`,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({ apikey: apiKey })
        });
        const body = parseResponse(response);

        if (response.status !== 200 || typeof body?.data?.token !== 'string' || !body.data.token.trim()) {
            const detail = getApiMessage(body);
            throw new Error(detail
                ? `TVDB login failed: ${detail}`
                : 'TVDB login failed. Check the configured API key.');
        }

        const token = body.data.token.trim();
        GM_setValue(STORAGE_KEYS.TOKEN, token);
        return token;
    }

    async function fetchEpisodePage(tvdbId, page, token) {
        const response = await request({
            method: 'GET',
            url: `${API_BASE_URL}/series/${encodeURIComponent(tvdbId)}/episodes/default?page=${page}`,
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        const body = parseResponse(response);

        if (response.status === 401) {
            return { unauthorized: true };
        }
        if (response.status === 404) {
            throw new Error(`TVDB series ${tvdbId} was not found.`);
        }
        if (response.status === 429) {
            throw new Error('TVDB rate limit reached. Try again later.');
        }
        if (response.status < 200 || response.status >= 300) {
            const detail = getApiMessage(body);
            throw new Error(detail
                ? `TVDB request failed: ${detail}`
                : `TVDB request failed (HTTP ${response.status}).`);
        }
        if (!Array.isArray(body?.data?.episodes)) {
            throw new Error('TVDB returned an unexpected episode response.');
        }

        return { body, unauthorized: false };
    }

    function getNextPage(body, currentPage) {
        const next = body?.links?.next;
        if (next === null || next === undefined || next === '') {
            return null;
        }

        if (Number.isInteger(next) && next > currentPage) {
            return next;
        }

        if (typeof next === 'string') {
            try {
                const value = Number(new URL(next, API_BASE_URL).searchParams.get('page'));
                if (Number.isInteger(value) && value > currentPage) {
                    return value;
                }
            } catch (error) {
                // Fall through to the normal sequential page number.
            }

            return currentPage + 1;
        }

        return null;
    }

    function getSeriesStatus(series) {
        const status = series?.status;
        if (typeof status === 'string' && status.trim()) {
            return status.trim();
        }
        if (isObject(status) && typeof status.name === 'string' && status.name.trim()) {
            return status.name.trim();
        }

        return '';
    }

    async function fetchStats(tvdbId) {
        const apiKey = getStoredSecret(STORAGE_KEYS.API_KEY);
        let token = getStoredSecret(STORAGE_KEYS.TOKEN);
        let refreshedToken = false;

        if (!token) {
            if (!apiKey) {
                throw new Error('Configure a TVDB API key or token in the userscript menu.');
            }
            token = await createToken(apiKey);
            refreshedToken = true;
        }

        const episodes = new Map();
        let status = '';
        let page = 0;

        for (let pagesFetched = 0; pagesFetched < MAX_PAGES; pagesFetched += 1) {
            let result = await fetchEpisodePage(tvdbId, page, token);

            if (result.unauthorized) {
                if (!apiKey || refreshedToken) {
                    throw new Error(apiKey
                        ? 'TVDB authorization failed. Check the configured API key or token.'
                        : 'The TVDB token is invalid or expired. Configure a new token or an API key.');
                }

                token = await createToken(apiKey);
                refreshedToken = true;
                result = await fetchEpisodePage(tvdbId, page, token);
                if (result.unauthorized) {
                    throw new Error('TVDB authorization failed. Check the configured API key.');
                }
            }

            const pageEpisodes = result.body.data.episodes;
            status ||= getSeriesStatus(result.body.data.series);
            pageEpisodes.forEach((episode, index) => {
                if (!isObject(episode)) {
                    return;
                }

                const fallbackKey = `${page}:${index}:${episode.seasonNumber}:${episode.number}`;
                episodes.set(String(episode.id ?? fallbackKey), episode);
            });

            const nextPage = getNextPage(result.body, page);
            if (nextPage === null) {
                const totalItems = Number(result.body?.links?.total_items);
                if (Number.isFinite(totalItems) && episodes.size < totalItems && pageEpisodes.length > 0) {
                    page += 1;
                    continue;
                }
                break;
            }

            page = nextPage;
        }

        const allEpisodes = [...episodes.values()];
        const regularEpisodes = allEpisodes.filter(episode => Number(episode.seasonNumber) > 0);
        const specials = allEpisodes.filter(episode => Number(episode.seasonNumber) === 0).length;
        const seasons = new Set(regularEpisodes.map(episode => Number(episode.seasonNumber))).size;

        return {
            status: status || 'Status unknown',
            seasons,
            episodes: regularEpisodes.length,
            specials
        };
    }

    function findTvdbId(metaSection) {
        const link = metaSection.querySelector('.meta__tvdb a[href]');
        if (!link) {
            return null;
        }

        try {
            const url = new URL(link.href, window.location.href);
            const queryId = url.searchParams.get('id');
            if (/^\d+$/.test(queryId || '')) {
                return queryId;
            }

            const pathId = url.pathname.match(/\/(?:series|movies?)\/(\d+)(?:\/|$)/i)?.[1];
            if (pathId) {
                return pathId;
            }
        } catch (error) {
            return null;
        }

        return link.title.match(/The TV Database:\s*(\d+)/i)?.[1] || null;
    }

    function createTag(className, text) {
        const item = document.createElement('li');
        item.className = className;

        const value = document.createElement('span');
        value.className = `${className}-text`;
        value.textContent = text;
        item.append(value);

        return item;
    }

    function formatCount(count, singular) {
        return `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`;
    }

    function isUnsetRuntime(runtimeTag) {
        return runtimeTag?.textContent.trim() === '0s';
    }

    function getExistingFields(tags, stats) {
        const nativeTags = [...tags.children].filter(tag =>
            ![...tag.classList].some(className => className.startsWith('work__tvdb-'))
        );
        const normalizedStatus = stats.status.trim().toLocaleLowerCase();
        const seasonsTag = nativeTags.find(tag => /\bseasons?\b/i.test(tag.textContent));
        const episodesTag = nativeTags.find(tag => /\bepisodes?\b/i.test(tag.textContent));
        const statsTags = new Set([seasonsTag, episodesTag].filter(Boolean));
        let lastStatsTag = null;
        nativeTags.forEach(tag => {
            if (statsTags.has(tag)) {
                lastStatsTag = tag;
            }
        });

        return {
            seasons: Boolean(seasonsTag),
            episodes: Boolean(episodesTag),
            status: nativeTags.some(tag =>
                tag.textContent.trim().toLocaleLowerCase() === normalizedStatus
            ),
            lastStatsTag
        };
    }

    function renderStats(statusTag, tags, stats, note = '') {
        const existing = getExistingFields(tags, stats);
        const specialsNote = stats.specials > 0
            ? `${stats.specials.toLocaleString()} season 0 special${stats.specials === 1 ? '' : 's'} excluded.`
            : 'Season 0 specials are excluded.';
        const generatedTags = [];

        if (!existing.seasons) {
            const seasonsTag = createTag('work__tvdb-seasons', formatCount(stats.seasons, 'Season'));
            seasonsTag.title = [specialsNote, note].filter(Boolean).join(' ');
            generatedTags.push(seasonsTag);
        }
        if (!existing.episodes) {
            const episodesTag = createTag('work__tvdb-episodes', formatCount(stats.episodes, 'Episode'));
            episodesTag.title = [specialsNote, note].filter(Boolean).join(' ');
            generatedTags.push(episodesTag);
        }
        if (!existing.status) {
            const seriesStatusTag = createTag('work__tvdb-series-status', stats.status);
            seriesStatusTag.title = ['TVDB series status.', note].filter(Boolean).join(' ');
            generatedTags.push(seriesStatusTag);
        }

        if (generatedTags.length === 0) {
            statusTag.remove();
            return;
        }

        if (existing.lastStatsTag) {
            statusTag.remove();
            existing.lastStatsTag.after(...generatedTags);
        } else {
            statusTag.replaceWith(...generatedTags);
        }
    }

    function renderError(statusTag, error) {
        const message = error instanceof Error ? error.message : String(error);
        statusTag.className = 'work__tvdb-error';
        statusTag.firstElementChild.className = 'work__tvdb-error-text';
        statusTag.firstElementChild.textContent = message.startsWith('Configure ')
            ? 'TVDB: Configure API key or token'
            : `TVDB error: ${message}`;
        statusTag.title = message;
        statusTag.style.color = 'var(--danger, #dc3545)';
        statusTag.firstElementChild.style.color = 'inherit';
    }

    async function main() {
        registerMenuCommands();

        const title = document.querySelector('.meta__title');
        const metaSection = title?.closest('.meta');
        const tags = metaSection?.querySelector('.work__tags');
        const tvdbId = metaSection ? findTvdbId(metaSection) : null;
        if (!metaSection || !tags || !tvdbId) {
            return;
        }

        const statusTag = createTag('work__tvdb-status', 'TVDB: Loading…');
        const runtimeTag = tags.querySelector('.work__runtime');
        if (isUnsetRuntime(runtimeTag)) {
            runtimeTag.replaceWith(statusTag);
        } else if (runtimeTag) {
            runtimeTag.after(statusTag);
        } else {
            tags.append(statusTag);
        }

        const cached = getCachedStats(tvdbId);
        if (cached) {
            renderStats(statusTag, tags, cached);
            return;
        }

        try {
            const stats = await fetchStats(tvdbId);
            cacheStats(tvdbId, stats);
            renderStats(statusTag, tags, stats);
        } catch (error) {
            const stale = getCachedStats(tvdbId, true);
            if (stale) {
                const detail = error instanceof Error ? error.message : String(error);
                renderStats(statusTag, tags, stale, `Cached data shown because refresh failed: ${detail}`);
                return;
            }

            renderError(statusTag, error);
        }
    }

    main();
})();
