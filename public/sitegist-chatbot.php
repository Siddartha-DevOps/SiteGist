<?php
/**
 * Plugin Name: SiteGist Chatbot
 * Plugin URI:  https://sitegist.co/wordpress-plugin
 * Description: Embed your SiteGist AI chatbot on every page of your WordPress site — no coding required.
 * Version:     1.0.0
 * Author:      SiteGist
 * Author URI:  https://sitegist.co
 * License:     GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: sitegist-chatbot
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class SiteGist_Chatbot {

    const VERSION    = '1.0.0';
    const OPTION_KEY = 'sitegist_project_id';
    const WIDGET_URL = 'https://sitegist.co/widget.js';
    const MENU_SLUG  = 'sitegist-chatbot';

    public function __construct() {
        add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'wp_footer',  array( $this, 'inject_widget' ) );
    }

    public function add_settings_page() {
        add_options_page(
            __( 'SiteGist Chatbot', 'sitegist-chatbot' ),
            __( 'SiteGist Chatbot', 'sitegist-chatbot' ),
            'manage_options',
            self::MENU_SLUG,
            array( $this, 'render_settings_page' )
        );
    }

    public function register_settings() {
        register_setting(
            'sitegist_chatbot_group',
            self::OPTION_KEY,
            array( 'sanitize_callback' => 'sanitize_text_field' )
        );

        add_settings_section(
            'sitegist_main_section',
            __( 'Connection Settings', 'sitegist-chatbot' ),
            '__return_null',
            self::MENU_SLUG
        );

        add_settings_field(
            self::OPTION_KEY,
            __( 'Project ID', 'sitegist-chatbot' ),
            array( $this, 'render_project_id_field' ),
            self::MENU_SLUG,
            'sitegist_main_section'
        );
    }

    public function render_project_id_field() {
        $value = get_option( self::OPTION_KEY, '' );
        printf(
            '<input type="text" name="%s" value="%s" class="regular-text" placeholder="%s" />
            <p class="description">%s</p>',
            esc_attr( self::OPTION_KEY ),
            esc_attr( $value ),
            esc_attr__( 'e.g. cm9x3kabcdef0123456789', 'sitegist-chatbot' ),
            sprintf(
                /* translators: %s: link to SiteGist dashboard */
                __( 'Find your Project ID in the %s under your project\'s Embed settings.', 'sitegist-chatbot' ),
                '<a href="https://sitegist.co/dashboard" target="_blank" rel="noopener noreferrer">'
                    . esc_html__( 'SiteGist dashboard', 'sitegist-chatbot' )
                    . '</a>'
            )
        );
    }

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $project_id = get_option( self::OPTION_KEY, '' );
        $is_active  = ! empty( $project_id );
        ?>
        <div class="wrap">
            <h1 style="display:flex;align-items:center;gap:10px;">
                <span style="display:inline-flex;width:32px;height:32px;background:#155DEE;border-radius:8px;align-items:center;justify-content:center;">
                    <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </span>
                <?php echo esc_html( get_admin_page_title() ); ?>
            </h1>

            <?php if ( $is_active ) : ?>
                <div class="notice notice-success inline" style="margin:12px 0;">
                    <p><?php esc_html_e( 'Your chatbot is live on this site.', 'sitegist-chatbot' ); ?></p>
                </div>
            <?php else : ?>
                <div class="notice notice-warning inline" style="margin:12px 0;">
                    <p><?php esc_html_e( 'Enter your Project ID below to activate the chatbot.', 'sitegist-chatbot' ); ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="options.php">
                <?php
                settings_fields( 'sitegist_chatbot_group' );
                do_settings_sections( self::MENU_SLUG );
                submit_button( __( 'Save Settings', 'sitegist-chatbot' ) );
                ?>
            </form>

            <hr />

            <h2><?php esc_html_e( 'Quick Start', 'sitegist-chatbot' ); ?></h2>
            <ol style="max-width:500px;line-height:2;">
                <li><?php printf( esc_html__( 'Create a chatbot at %s.', 'sitegist-chatbot' ), '<a href="https://sitegist.co/dashboard" target="_blank">sitegist.co/dashboard</a>' ); ?></li>
                <li><?php esc_html_e( 'Open your project, go to Embed &rarr; copy the Project ID.', 'sitegist-chatbot' ); ?></li>
                <li><?php esc_html_e( 'Paste it in the field above and click Save Settings.', 'sitegist-chatbot' ); ?></li>
                <li><?php esc_html_e( 'The chat bubble appears on every page automatically.', 'sitegist-chatbot' ); ?></li>
            </ol>

            <hr />

            <h2><?php esc_html_e( 'JavaScript SDK', 'sitegist-chatbot' ); ?></h2>
            <p><?php esc_html_e( 'Once the widget is live you can control it programmatically:', 'sitegist-chatbot' ); ?></p>
            <pre style="background:#f6f7f7;padding:16px;border-radius:4px;overflow:auto;max-width:600px;font-size:13px;"><code>// Open / close
SiteGist.open();
SiteGist.close();
SiteGist.toggle();

// Pre-fill user data (call after login)
SiteGist.identify('user_123', { name: 'Jane', plan: 'Pro' });

// Send a message programmatically
SiteGist.sendMessage('What are your business hours?');

// Listen to events
SiteGist.on('open',    function() { console.log('chat opened'); });
SiteGist.on('close',   function() { console.log('chat closed'); });
SiteGist.on('lead',    function(data) { console.log('lead captured', data); });
SiteGist.on('message', function(data) { console.log('message sent', data); });</code></pre>
        </div>
        <?php
    }

    public function inject_widget() {
        $project_id = get_option( self::OPTION_KEY, '' );
        if ( empty( $project_id ) ) {
            return;
        }
        printf(
            '<script src="%s" data-project-id="%s" defer></script>' . "\n",
            esc_url( self::WIDGET_URL ),
            esc_attr( $project_id )
        );
    }
}

new SiteGist_Chatbot();
