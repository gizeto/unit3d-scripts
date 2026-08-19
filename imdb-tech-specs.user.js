// ==UserScript==
// @name         UNIT3D Scripts | IMDb Tech Specs
// @version      69.433
// @author       Kat & gizeto
// @description  IMDb Tech Specs via GraphQL API
// @icon         https://hdinnovations.github.io/HDInnovations/media/favicon.ico
// @match        *://*/torrents/*
// @namespace    https://github.com/gizeto/unit3d-scripts
// @downloadURL  https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-tech-specs.user.js
// @updateURL    https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-tech-specs.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      caching.graphql.imdb.com
// ==/UserScript==

(() => {
  'use strict';

  const CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
  const SCRIPT_VERSION = GM_info.script.version;
  const NUM_RUNTIMES = 10;
  const PANEL_POSITION_KEY = 'panelPosition';
  const PANEL_POSITIONS = {
    BEFORE_FIRST_PANEL: 'before-first-panel',
    AFTER_TITLE: 'after-title'
  };

  const titleEl = document.querySelector('.meta__title');
  const firstPanel = document.querySelector('.panelV2');
  if (!titleEl || !firstPanel) return;

  const savedPanelPosition = GM_getValue(
    PANEL_POSITION_KEY,
    PANEL_POSITIONS.BEFORE_FIRST_PANEL
  );
  const panelPosition = Object.values(PANEL_POSITIONS).includes(savedPanelPosition)
    ? savedPanelPosition
    : PANEL_POSITIONS.BEFORE_FIRST_PANEL;

  const registerPanelPosition = (position, label) => {
    const selected = panelPosition === position ? '✓ ' : '';
    GM_registerMenuCommand(`${selected}Position: ${label}`, () => {
      if (panelPosition === position) return;
      GM_setValue(PANEL_POSITION_KEY, position);
      window.location.reload();
    });
  };

  registerPanelPosition(PANEL_POSITIONS.BEFORE_FIRST_PANEL, 'Before first panel');
  registerPanelPosition(PANEL_POSITIONS.AFTER_TITLE, 'After title');

  const setCache = (k, v) =>
    localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: SCRIPT_VERSION, data: v }));

  const getCache = (k) => {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL) {
        localStorage.removeItem(k);
        return null;
      }
      if (parsed.v !== SCRIPT_VERSION) {
        localStorage.removeItem(k);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  };

  const imdbAnchor = document.querySelector('a[href*="imdb.com/title/tt"]');
  if (!imdbAnchor) return;

  const match = imdbAnchor.href.match(/(tt\d+)/);
  if (!match) return;
  const imdbId = match[1];

  const fallbackAnchor =
    titleEl?.closest('section, div') ||
    document.querySelector('main') ||
    document.body;

  const wrapper = document.createElement('section');
  wrapper.className = 'panelV2';
  wrapper.id = 'imdb_tech_specs';
  wrapper.style.marginTop = '0';

  const header = document.createElement('header');
  header.className = 'panel__header';

  const title = document.createElement('h2');
  title.className = 'panel__heading';
  title.textContent = 'IMDb Technical Specs';
  header.appendChild(title);

  const body = document.createElement('div');
  body.className = 'panel__body';
  body.id = 'ptp-tech-body';
  body.style.padding = '.75rem 1rem';
  body.style.display = 'none';
  body.innerHTML = `<div style="color:#aaa;">Loading...</div>`;

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  if (panelPosition === PANEL_POSITIONS.BEFORE_FIRST_PANEL && firstPanel) {
    firstPanel.insertAdjacentElement('beforebegin', wrapper);
  } else if (fallbackAnchor === document.body) {
    fallbackAnchor.appendChild(wrapper);
  } else {
    fallbackAnchor.insertAdjacentElement('afterend', wrapper);
  }

  const globalToggle = document.createElement('a');
  globalToggle.href = '#';
  globalToggle.style.cssText =
    'margin-left:10px;cursor:pointer;font-size:0.9em;display:inline-flex;align-items:center;gap:6px;';

  const icon = document.createElement('i');
  icon.className = 'fas fa-plus-circle';
  globalToggle.appendChild(icon);
  header.appendChild(globalToggle);

  let panelVisible = false;

  const togglePanel = (e) => {
    if (e) e.preventDefault();
    panelVisible = !panelVisible;
    body.style.display = panelVisible ? 'block' : 'none';
    icon.className = panelVisible ? 'fas fa-minus-circle' : 'fas fa-plus-circle';
  };

  globalToggle.onclick = togglePanel;

  header.style.cursor = 'pointer';
  header.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    togglePanel(e);
  });

  const renderMessage = (message, color) => {
    body.replaceChildren();
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = message;
    body.appendChild(div);
  };

  const renderError = (message) => {
    renderMessage(`Unable to load IMDb technical specs: ${message}`, '#f87171');
  };

  const render = (rows) => {
    body.replaceChildren();
    if (!rows || !rows.length) {
      renderMessage('IMDb has no technical data for this title.', '#aaa');
      return;
    }
    rows.forEach(([k, v]) => {
      const div = document.createElement('div');
      div.style.padding = '3px 0';
      div.innerHTML = `<strong>${k}:</strong> ${v}`;
      body.appendChild(div);
    });
  };

  const cacheKey = `imdb-tech-${imdbId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    render(cached);
    return;
  }

  // ── id and first are now real GraphQL variables instead of being
  //    interpolated directly into the query string
  const query = {
    query: `query($id: ID!, $first: Int!) {
        title(id: $id) {
            runtimes(first: $first) {
                edges {
                    node {
                        seconds
                        attributes { text }
                        displayableProperty {
                            value { plainText }
                        }
                    }
                }
            }
            technicalSpecifications {
                aspectRatios { items { aspectRatio attributes { text } } }
                cameras { items { camera attributes { text } } }
                colorations { items { text attributes { text } } }
                laboratories { items { laboratory attributes { text } } }
                negativeFormats { items { negativeFormat attributes { text } } }
                printedFormats { items { printedFormat attributes { text } } }
                processes { items { process attributes { text } } }
                soundMixes { items { text attributes { text } } }
                filmLengths {
                    items {
                        filmLength
                        countries { text }
                        numReels
                    }
                }
            }
        }
    }`,
    variables: { id: imdbId, first: NUM_RUNTIMES }
  };

  GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://caching.graphql.imdb.com',
    headers: {
      'Content-Type': 'application/json',
      'x-imdb-client-name': 'imdb-web-next'
    },
    data: JSON.stringify(query),

    onload: (res) => {
      try {
        if (res.status < 200 || res.status >= 300) {
          const statusText = res.statusText ? ` ${res.statusText}` : '';
          throw new Error(`request failed (HTTP ${res.status}${statusText}).`);
        }

        let json;
        try {
          json = JSON.parse(res.responseText);
        } catch (cause) {
          throw new Error('the API returned an unreadable response.', { cause });
        }

        if (json.errors?.length) {
          const messages = json.errors
            .map(({ message }) => message)
            .filter(Boolean)
            .join('; ');
          throw new Error(`API error: ${messages || 'unknown GraphQL error'}.`);
        }

        const titleData = json.data?.title;
        if (!titleData) {
          throw new Error(`the API returned no data for ${imdbId}.`);
        }

        const specs = titleData.technicalSpecifications || {};

        // Format the runtimes list: no attributes = theatrical
        const runtimeEdges = titleData.runtimes?.edges || [];
        const runtimeStr = runtimeEdges
          .map(({ node }) => {
            const time = node.displayableProperty?.value?.plainText || '';
            const attrs = node.attributes?.map(a => a.text) || [];
            const label = attrs.length ? `${time} (${attrs.join(', ')})` : time;
            // title attribute carries seconds for tooltip
            return `<span title="${node.seconds}s">${label}</span>`;
          })
          .filter(Boolean)
          .join(', ') || 'N/A';

        const formatSpec = (items, key, attrKey) => {
          if (!items?.length) return '';
          return items
            .map((item) => {
              let value = item[key];
              if (item[attrKey]?.length) {
                value += ` (${item[attrKey].map(a => a.text).join(', ')})`;
              }
              return value;
            })
            .filter(Boolean)
            .join(', ');
        };

        const formatFilmLengths = (items) => {
          if (!items?.length) return '';
          return items
            .map((item) => {
              let value = `${item.filmLength} m`;
              if (item.countries?.length) {
                value += ` (${item.countries.map(c => c.text).join(', ')})`;
              }
              if (item.numReels) {
                value += ` (${item.numReels} reels)`;
              }
              return value;
            })
            .filter(Boolean)
            .join(', ');
        };

        const rows = [
          ['Runtime', runtimeStr],
          ['Sound Mix', formatSpec(specs.soundMixes?.items, 'text', 'attributes')],
          ['Color', formatSpec(specs.colorations?.items, 'text', 'attributes')],
          ['Aspect Ratio', formatSpec(specs.aspectRatios?.items, 'aspectRatio', 'attributes')],
          ['Camera', formatSpec(specs.cameras?.items, 'camera', 'attributes')],
          ['Laboratory', formatSpec(specs.laboratories?.items, 'laboratory', 'attributes')],
          ['Film Length', formatFilmLengths(specs.filmLengths?.items)],
          ['Negative Format', formatSpec(specs.negativeFormats?.items, 'negativeFormat', 'attributes')],
          ['Cinematographic Process', formatSpec(specs.processes?.items, 'process', 'attributes')],
          ['Printed Film Format', formatSpec(specs.printedFormats?.items, 'printedFormat', 'attributes')],
        ].filter(([, v]) => v);

        setCache(cacheKey, rows);
        render(rows);
      } catch (e) {
        console.error('[Tech Specs] Response error:', e);
        renderError(e instanceof Error ? e.message : 'unexpected response error.');
      }
    },

    onerror: (error) => {
      console.error('[Tech Specs] Request error:', error);
      const detail =
        (typeof error?.error === 'string' && error.error) ||
        (typeof error?.statusText === 'string' && error.statusText);
      renderError(detail ? `network request failed: ${detail}.` : 'network request failed.');
    },

    ontimeout: () => renderError('the request timed out.'),
    onabort: () => renderError('the request was aborted.'),
    timeout: 20000
  });

})();
