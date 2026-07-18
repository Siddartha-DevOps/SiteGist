# SiteGist WordPress Plugin

Source for the official SiteGist AI Chatbot WordPress plugin. It injects the
SiteGist widget loader (`/widget.js`) into a WordPress site's front end, driven by
a Project (Widget) ID entered on a settings screen.

## Layout

- `sitegist/sitegist.php` — main plugin (settings screen, options, front-end injection)
- `sitegist/uninstall.php` — removes options on delete
- `sitegist/readme.txt` — WordPress.org plugin-directory readme

## How it works

The plugin does not reimplement the widget. It enqueues `<BASE_URL>/widget.js`
(default `https://app.sitegist.co/widget.js`) with a `data-project-id` attribute, so
all widget appearance/behaviour stays controlled from the SiteGist dashboard and is
always up to date.

## Building the downloadable zip

The marketing page (`/wordpress-plugin`) links to `public/sitegist-wordpress-plugin.zip`.
Regenerate it after changing the plugin source:

```sh
cd wordpress-plugin
zip -r -X ../public/sitegist-wordpress-plugin.zip sitegist -x '*.DS_Store'
```

The archive must contain a top-level `sitegist/` directory (WordPress requirement).
