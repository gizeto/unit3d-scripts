# UNIT3D Scripts

- [Install IMDb Technical Specs](https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-tech-specs.user.js) — adds runtime and technical-specification details.
- [Install IMDb Parental Guidance](https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/imdb-parental-guidance.user.js) — adds parental-guide categories, severity ratings, and notes.
- [Install TVDB Series Stats](https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/tvdb-series-stats.user.js) — adds status, season count, and episode count to TV-series metadata.
- [Install Subtitle Flags](https://raw.githubusercontent.com/gizeto/unit3d-scripts/master/subtitle-flags.user.js) — shows flags for configured subtitle languages in torrent lists.

Open an installation link with Tampermonkey or Violentmonkey enabled to install the script and receive future updates.

## Settings

Open the userscript-manager menu on a matching UNIT3D page.

### IMDb scripts

Each IMDb script stores its position independently:

- **Before first panel** — default.
- **After title** — original placement.

The selected position is marked with `✓`; choosing another position saves it and reloads the page.

### Subtitle Flags

- **Set favorite subtitles** — comma-separated, case-sensitive language names. Defaults to `English`; reload after saving.
- **Set API key for this site** — saves a separate UNIT3D API key for the current hostname. Submit an empty value to remove it; reload after saving.

### TVDB Series Stats

- **Set TVDB API key** — saves an API key and lets the script obtain or refresh its bearer token automatically.
- **Set TVDB token** — saves a bearer token directly. The script uses it before trying the API key.
- **Clear TVDB stats cache** — removes the cached counts. Successful results are normally cached for 24 hours.

The script shows the TVDB series status and counts of aired regular seasons and episodes in the metadata tag row. Future and undated episodes are not counted. Fields already provided by the site are not duplicated, and an unset `0s` runtime tag is removed. Season 0 specials are excluded. Submit an empty API-key or token value to remove it; reload after changing either setting.
