<?php
/**
 * Remove all SiteGist options when the plugin is deleted.
 *
 * @package SiteGist
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'sitegist_project_id' );
delete_option( 'sitegist_enabled' );
delete_option( 'sitegist_base_url' );
