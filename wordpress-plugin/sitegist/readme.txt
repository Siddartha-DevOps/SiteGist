=== SiteGist AI Chatbot ===
Contributors: sitegist
Tags: chatbot, ai, customer support, live chat, gpt
Requires at least: 5.0
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add your SiteGist AI support chatbot to WordPress in seconds — paste your Project ID and go live. No code required.

== Description ==

SiteGist turns your website content into an AI support agent that answers visitor
questions, captures leads, and hands off to a human when needed. This plugin adds
your SiteGist chat widget to every page of your WordPress site without editing your
theme or touching any code.

Features:

* One-field setup — paste your Project (Widget) ID and enable.
* Loads the official SiteGist widget loader (`widget.js`) — always up to date.
* Widget appearance, greeting, suggested questions, colours and behaviour are all
  controlled from your SiteGist dashboard, so no re-publishing is needed to change them.
* Lightweight: a single async script tag, no render-blocking assets.
* Works with Gutenberg, Elementor, and all standard WordPress themes.

You need a SiteGist account (https://www.sitegist.co) and a trained project to use
this plugin.

== Installation ==

1. In your SiteGist dashboard, open your project and copy its Project (Widget) ID
   from the Install / Embed settings.
2. In WordPress, go to Plugins → Add New → Upload Plugin and upload the plugin `.zip`
   (or install from the WordPress plugin directory), then click Activate.
3. Go to Settings → SiteGist Chatbot.
4. Paste your Project (Widget) ID, tick "Enable chatbot", and Save Changes.
5. Visit the front end of your site — the chat bubble appears in the corner.

== Frequently Asked Questions ==

= Where do I find my Project (Widget) ID? =
In your SiteGist dashboard, open the project and look at its Install / Embed settings.
It is the same ID used in the `data-project-id` attribute of the embed snippet.

= How do I change the widget colour, greeting, or position? =
All of that is configured in your SiteGist dashboard under Bot Settings. Changes take
effect on your live site automatically — no need to touch WordPress again.

= Does this slow down my site? =
No. The plugin adds a single asynchronous script tag that loads the widget after your
page renders.

= I self-host SiteGist or use a custom domain. =
Set your install URL in the "SiteGist URL (advanced)" field on the settings screen.
It defaults to https://app.sitegist.co.

== Changelog ==

= 1.0.0 =
* Initial release: settings screen, enable toggle, and front-end widget injection.
