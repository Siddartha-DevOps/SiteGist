<?php
/**
 * Plugin Name:       SiteGist AI Chatbot
 * Plugin URI:        https://www.sitegist.co/wordpress-plugin
 * Description:       Add your SiteGist AI support chatbot to your WordPress site. Paste your Project (Widget) ID and go live — no theme editing or code required.
 * Version:           1.0.0
 * Requires at least: 5.0
 * Requires PHP:      7.2
 * Author:            SiteGist
 * Author URI:        https://www.sitegist.co
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       sitegist
 *
 * @package SiteGist
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Block direct access.
}

define( 'SITEGIST_VERSION', '1.0.0' );
define( 'SITEGIST_DEFAULT_BASE_URL', 'https://app.sitegist.co' );

/**
 * Register the plugin options and their sanitizers.
 */
function sitegist_register_settings() {
	register_setting(
		'sitegist_settings',
		'sitegist_project_id',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sitegist_sanitize_project_id',
			'default'           => '',
		)
	);
	register_setting(
		'sitegist_settings',
		'sitegist_enabled',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'sitegist_sanitize_checkbox',
			'default'           => 0,
		)
	);
	register_setting(
		'sitegist_settings',
		'sitegist_base_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sitegist_sanitize_base_url',
			'default'           => SITEGIST_DEFAULT_BASE_URL,
		)
	);
}
add_action( 'admin_init', 'sitegist_register_settings' );

/**
 * Project IDs are cuid-like alphanumeric strings. Strip everything else so a
 * pasted value can never inject markup into the script tag.
 *
 * @param string $value Raw option value.
 * @return string Sanitized project id.
 */
function sitegist_sanitize_project_id( $value ) {
	return preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $value );
}

/**
 * Normalize a checkbox to 1/0.
 *
 * @param mixed $value Raw option value.
 * @return int
 */
function sitegist_sanitize_checkbox( $value ) {
	return ( ! empty( $value ) ) ? 1 : 0;
}

/**
 * Validate the SiteGist base URL, falling back to the default when empty/invalid.
 *
 * @param string $value Raw option value.
 * @return string
 */
function sitegist_sanitize_base_url( $value ) {
	$value = esc_url_raw( trim( (string) $value ), array( 'http', 'https' ) );
	if ( empty( $value ) ) {
		return SITEGIST_DEFAULT_BASE_URL;
	}
	return untrailingslashit( $value );
}

/**
 * Add the settings screen under Settings → SiteGist Chatbot.
 */
function sitegist_add_admin_menu() {
	add_options_page(
		__( 'SiteGist', 'sitegist' ),
		__( 'SiteGist Chatbot', 'sitegist' ),
		'manage_options',
		'sitegist',
		'sitegist_render_settings_page'
	);
}
add_action( 'admin_menu', 'sitegist_add_admin_menu' );

/**
 * Render the settings screen.
 */
function sitegist_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$project_id = get_option( 'sitegist_project_id', '' );
	$enabled    = get_option( 'sitegist_enabled', 0 );
	$base_url   = get_option( 'sitegist_base_url', SITEGIST_DEFAULT_BASE_URL );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'SiteGist AI Chatbot', 'sitegist' ); ?></h1>
		<p><?php esc_html_e( 'Paste your Project (Widget) ID from your SiteGist dashboard to add the chat widget to every page of your site.', 'sitegist' ); ?></p>
		<form action="options.php" method="post">
			<?php settings_fields( 'sitegist_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="sitegist_project_id"><?php esc_html_e( 'Project (Widget) ID', 'sitegist' ); ?></label>
					</th>
					<td>
						<input name="sitegist_project_id" id="sitegist_project_id" type="text" class="regular-text" value="<?php echo esc_attr( $project_id ); ?>" placeholder="e.g. clx8f2a9b0001abcd" />
						<p class="description">
							<?php esc_html_e( 'Find this in your SiteGist dashboard under your project’s Install / Embed settings.', 'sitegist' ); ?>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Enable chatbot', 'sitegist' ); ?></th>
					<td>
						<label>
							<input name="sitegist_enabled" type="checkbox" value="1" <?php checked( 1, $enabled ); ?> />
							<?php esc_html_e( 'Show the chat widget on the front end of this site', 'sitegist' ); ?>
						</label>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<label for="sitegist_base_url"><?php esc_html_e( 'SiteGist URL (advanced)', 'sitegist' ); ?></label>
					</th>
					<td>
						<input name="sitegist_base_url" id="sitegist_base_url" type="url" class="regular-text code" value="<?php echo esc_attr( $base_url ); ?>" />
						<p class="description">
							<?php esc_html_e( 'Only change this if you use a self-hosted or custom-domain SiteGist install. Default: https://app.sitegist.co', 'sitegist' ); ?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/**
 * Enqueue the SiteGist widget loader on the front end when enabled and configured.
 */
function sitegist_enqueue_widget() {
	if ( is_admin() ) {
		return;
	}

	$enabled    = get_option( 'sitegist_enabled', 0 );
	$project_id = sitegist_sanitize_project_id( get_option( 'sitegist_project_id', '' ) );
	if ( empty( $enabled ) || empty( $project_id ) ) {
		return;
	}

	$base_url = sitegist_sanitize_base_url( get_option( 'sitegist_base_url', SITEGIST_DEFAULT_BASE_URL ) );

	wp_enqueue_script(
		'sitegist-widget',
		$base_url . '/widget.js',
		array(),
		SITEGIST_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'sitegist_enqueue_widget' );

/**
 * The widget loader reads its project id from a data-project-id attribute on its
 * own <script> tag, so rewrite the enqueued tag to include it.
 *
 * @param string $tag    The full <script> tag.
 * @param string $handle The enqueued handle.
 * @param string $src    The script src.
 * @return string
 */
function sitegist_add_widget_attributes( $tag, $handle, $src ) {
	if ( 'sitegist-widget' !== $handle ) {
		return $tag;
	}

	$project_id = sitegist_sanitize_project_id( get_option( 'sitegist_project_id', '' ) );
	if ( empty( $project_id ) ) {
		return $tag;
	}

	return sprintf(
		'<script src="%s" data-project-id="%s" async></script>' . "\n",
		esc_url( $src ),
		esc_attr( $project_id )
	);
}
add_filter( 'script_loader_tag', 'sitegist_add_widget_attributes', 10, 3 );

/**
 * Add a Settings shortcut on the Plugins list row.
 *
 * @param array $links Existing action links.
 * @return array
 */
function sitegist_settings_link( $links ) {
	$url             = admin_url( 'options-general.php?page=sitegist' );
	$settings_link   = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'sitegist' ) . '</a>';
	array_unshift( $links, $settings_link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'sitegist_settings_link' );
