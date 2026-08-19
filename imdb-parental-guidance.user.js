// ==UserScript==
// @name         UNIT3D Scripts | IMDb Parental Guidance
// @namespace    https://github.com/gizeto/unit3d-scripts
// @version      69.430
// @description  Add IMDb Parental Guidance Notes on torrent sites
// @author       Kat & gizeto
// @icon         https://hdinnovations.github.io/HDInnovations/media/favicon.ico
// @downloadURL  https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-parental-guidance.user.js
// @updateURL    https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-parental-guidance.user.js
// @match        *://*/torrents/*
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
  const NUM_GUIDE_ITEMS = 100;
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

  const hidetext = false;
  const isToggleableSections = true;
  const hideSpoilers = false;

  const setCache = (key, value) =>
    localStorage.setItem(
      key,
      JSON.stringify({ t: Date.now(), v: SCRIPT_VERSION, data: value })
    );

  const getCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL || parsed.v !== SCRIPT_VERSION) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .parentalspoiler { color: transparent; }
    .parentalspoiler:hover { color: inherit; }

    .parentalHeader {
      color: #aaa;
      margin-top: 12px;
      margin-bottom: 5px;
      cursor: pointer;
    }

    .hide { display: none; }
  `;
  document.head.appendChild(style);

  const imdbAnchor = document.querySelector('a[href*="imdb.com/title/tt"]');
  if (!imdbAnchor) {
    console.warn('[Parental Guide] No IMDb link found.');
    return;
  }

  const match = imdbAnchor.href.match(/tt\d+/);
  const imdbId = match?.[0];
  if (!imdbId) {
    console.warn('[Parental Guide] Could not parse IMDb ID.');
    return;
  }

  const advisoryDiv = document.createElement('div');

  const newPanel = document.createElement('section');
  newPanel.className = 'panelV2';
  newPanel.id = 'parents_guide';
  newPanel.style.marginTop = '0';

  const header = document.createElement('header');
  header.className = 'panel__header';

  const title = document.createElement('h2');
  title.className = 'panel__heading';
  title.textContent = 'IMDb Parental Notes';
  header.appendChild(title);

  const panelBody = document.createElement('div');
  panelBody.className = 'panel__body';
  panelBody.style.padding = '.75rem 1rem';
  panelBody.style.display = 'none';
  panelBody.appendChild(advisoryDiv);

  newPanel.appendChild(header);
  newPanel.appendChild(panelBody);

  const anchor =
    titleEl?.closest('section, div') ||
    document.querySelector('main') ||
    document.body;

  if (panelPosition === PANEL_POSITIONS.BEFORE_FIRST_PANEL && firstPanel) {
    firstPanel.insertAdjacentElement('beforebegin', newPanel);
  } else if (anchor === document.body) {
    anchor.appendChild(newPanel);
  } else {
    anchor.insertAdjacentElement('afterend', newPanel);
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

  const togglePanel = (event) => {
    if (event) event.preventDefault();
    panelVisible = !panelVisible;
    panelBody.style.display = panelVisible ? 'block' : 'none';
    icon.className = panelVisible ? 'fas fa-minus-circle' : 'fas fa-plus-circle';
  };

  globalToggle.onclick = togglePanel;
  header.style.cursor = 'pointer';
  header.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    togglePanel(event);
  });

  const renderMessage = (message, color) => {
    advisoryDiv.replaceChildren();
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = message;
    advisoryDiv.appendChild(div);
  };

  const renderError = (message) => {
    renderMessage(`Unable to load IMDb parental guidance: ${message}`, '#f87171');
  };

  const renderCategories = (categories) => {
    advisoryDiv.replaceChildren();
    if (!categories.length) {
      renderMessage('IMDb has no parental guidance for this title.', '#aaa');
      return;
    }

    const colorMap = {
      None: '#F2DB83',
      Mild: '#c5e197',
      Moderate: '#fbca8c',
      Severe: '#ffb3ad'
    };

    categories.forEach((category) => {
      const edges = category.guideItems?.edges || [];
      const container = document.createElement('div');

      const categoryHeader = document.createElement('h4');
      categoryHeader.className = 'parentalHeader';
      categoryHeader.textContent = `${category.category?.text || 'Other'} - `;

      const severity = document.createElement('span');
      const severityText = category.severity?.text || 'Unknown';
      severity.style.color = colorMap[severityText] || '#ccc';
      severity.textContent = severityText;
      categoryHeader.appendChild(severity);
      categoryHeader.appendChild(document.createTextNode(` - (${edges.length})`));

      const list = document.createElement('ul');
      list.style.margin = '0 15px';
      if (isToggleableSections) list.classList.add('hide');

      edges.forEach(({ node }) => {
        const text = node?.text?.plainText;
        if (!text) return;

        const item = document.createElement('li');
        const content = document.createElement('a');
        content.style.color = 'inherit';
        content.textContent = text;

        if (hidetext) content.classList.add('parentalspoiler');

        if (node.isSpoiler && hideSpoilers) {
          content.textContent = 'Potential Spoilers';
          content.style.textDecoration = 'underline';
          content.onclick = (event) => {
            const element = event.currentTarget;
            element.textContent = element.textContent === text ? 'Potential Spoilers' : text;
          };
        }

        item.appendChild(content);
        list.appendChild(item);
      });

      container.appendChild(categoryHeader);
      container.appendChild(list);
      advisoryDiv.appendChild(container);

      if (isToggleableSections) {
        categoryHeader.onclick = () => list.classList.toggle('hide');
      }
    });
  };

  const cacheKey = `imdb-parental-guidance-${imdbId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    renderCategories(cached);
    return;
  }

  renderMessage('Loading...', '#aaa');

  const graphQlReq = {
    query: `query($id: ID!, $first: Int!) {
      title(id: $id) {
        parentsGuide {
          categories {
            category { text }
            severity { text }
            guideItems(first: $first) {
              edges {
                node {
                  ... on ParentsGuideItem {
                    isSpoiler
                    text { plainText }
                  }
                }
              }
            }
          }
        }
      }
    }`,
    variables: { id: imdbId, first: NUM_GUIDE_ITEMS }
  };

  GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://caching.graphql.imdb.com',
    headers: {
      'Content-Type': 'application/json',
      'x-imdb-client-name': 'imdb-web-next'
    },
    data: JSON.stringify(graphQlReq),

    onload: (response) => {
      try {
        if (response.status < 200 || response.status >= 300) {
          const statusText = response.statusText ? ` ${response.statusText}` : '';
          throw new Error(`request failed (HTTP ${response.status}${statusText}).`);
        }

        let body;
        try {
          body = JSON.parse(response.responseText);
        } catch (cause) {
          throw new Error('the API returned an unreadable response.', { cause });
        }

        if (body.errors?.length) {
          const messages = body.errors
            .map(({ message }) => message)
            .filter(Boolean)
            .join('; ');
          throw new Error(`API error: ${messages || 'unknown GraphQL error'}.`);
        }

        const titleData = body.data?.title;
        if (!titleData) {
          throw new Error(`the API returned no data for ${imdbId}.`);
        }

        const categories = titleData.parentsGuide?.categories || [];
        setCache(cacheKey, categories);
        renderCategories(categories);
      } catch (error) {
        console.error('[Parental Guide] Response error:', error);
        renderError(error instanceof Error ? error.message : 'unexpected response error.');
      }
    },

    onerror: (error) => {
      console.error('[Parental Guide] Request error:', error);
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
