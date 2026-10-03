<?php
/**
 * Plugin Name: AceAds Free Website Preview
 * Description: "Get a free preview of your website" form. Saves the lead, tells the team (Telegram + email), asks GitHub to build the preview, hosts it on this site and emails it to the prospect.
 * Version: 1.0.0
 * Author: AceAds
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AceAds_Preview
{
    const OPT = 'aceads_preview';
    const CPT = 'aceads_lead';
    const TYPES = [
        'cafe', 'restaurant', 'takeaway', 'bar or pub', 'bakery', 'barber or hairdresser', 'beauty salon',
        'massage or spa', 'gym or studio', 'florist', 'boutique', 'gift or homewares', 'pet business',
        'tattoo studio', 'wedding venue', 'celebrant', 'wedding cakes', 'hair and makeup', 'event hire',
        'trades', 'mechanic', 'cleaning service', 'other',
    ];
    const STATUSES = ['new', 'preview ready', 'called', 'DM sent', 'meeting booked', 'won', 'not interested'];

    public static function boot(): void
    {
        add_action('init', [__CLASS__, 'register']);
        add_shortcode('aceads_preview_form', [__CLASS__, 'shortcode']);
        add_action('admin_post_nopriv_aceads_preview_request', [__CLASS__, 'handle_form']);
        add_action('admin_post_aceads_preview_request', [__CLASS__, 'handle_form']);
        add_action('rest_api_init', [__CLASS__, 'rest']);
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_init', [__CLASS__, 'settings']);
        add_filter('manage_' . self::CPT . '_posts_columns', [__CLASS__, 'columns']);
        add_action('manage_' . self::CPT . '_posts_custom_column', [__CLASS__, 'column'], 10, 2);
        add_action('add_meta_boxes', [__CLASS__, 'meta_box']);
        add_action('save_post_' . self::CPT, [__CLASS__, 'save_meta_box']);
    }

    /* ---------- settings ---------- */

    public static function defaults(): array
    {
        return [
            'notify_email' => get_option('admin_email'),
            'telegram_token' => '',
            'telegram_chat' => '',
            'github_repo' => 'xtrywow/socialcominucated',
            'github_token' => '',
            'preview_secret' => wp_generate_password(40, false),
            'price_starter' => '690',
            'price_business' => '1490',
            'price_care' => '39',
            'from_name' => 'AceAds',
        ];
    }

    public static function opt(string $key): string
    {
        $saved = get_option(self::OPT);
        if (!is_array($saved)) {
            $saved = self::defaults();
            update_option(self::OPT, $saved);
        }
        return (string) ($saved[$key] ?? self::defaults()[$key] ?? '');
    }

    public static function menu(): void
    {
        add_options_page('AceAds Previews', 'AceAds Previews', 'manage_options', 'aceads-preview', [__CLASS__, 'settings_page']);
    }

    public static function settings(): void
    {
        register_setting('aceads_preview', self::OPT, ['sanitize_callback' => [__CLASS__, 'sanitize_settings']]);
    }

    public static function sanitize_settings($in): array
    {
        $out = self::defaults();
        $current = get_option(self::OPT);
        foreach ($out as $k => $default) {
            $v = isset($in[$k]) ? trim((string) $in[$k]) : '';
            if ($v === '' && is_array($current) && !empty($current[$k])) {
                $v = $current[$k]; // leave secrets alone when the field is submitted empty
            }
            $out[$k] = $k === 'notify_email' ? sanitize_email($v) : sanitize_text_field($v);
        }
        return $out;
    }

    public static function settings_page(): void
    {
        $fields = [
            'notify_email' => ['Team email for new leads', 'text'],
            'telegram_token' => ['Telegram bot token (from @BotFather)', 'password'],
            'telegram_chat' => ['Telegram chat ID (your group or user)', 'text'],
            'github_repo' => ['GitHub repository (owner/name)', 'text'],
            'github_token' => ['GitHub token (fine-grained, Contents: read & write on that repo)', 'password'],
            'preview_secret' => ['Preview secret (put the same value in the GitHub secret PREVIEW_SECRET)', 'text'],
            'price_starter' => ['Starter price, one page (AUD)', 'text'],
            'price_business' => ['Business price, up to five pages (AUD)', 'text'],
            'price_care' => ['Care plan per month (AUD)', 'text'],
            'from_name' => ['Sender name on emails', 'text'],
        ];
        echo '<div class="wrap"><h1>AceAds Previews</h1>';
        echo '<p>Put <code>[aceads_preview_form]</code> on a page. Lead endpoint for GitHub: <code>' .
            esc_html(rest_url('aceads/v1/preview/{lead_id}')) . '</code></p>';
        echo '<form method="post" action="options.php">';
        settings_fields('aceads_preview');
        echo '<table class="form-table">';
        foreach ($fields as $k => [$label, $type]) {
            $value = $type === 'password' ? '' : self::opt($k);
            $hint = $type === 'password' && self::opt($k) !== '' ? ' <em>(saved; leave empty to keep)</em>' : '';
            printf(
                '<tr><th scope="row"><label for="%1$s">%2$s</label></th><td><input class="regular-text" type="%3$s" id="%1$s" name="%4$s[%1$s]" value="%5$s" autocomplete="off">%6$s</td></tr>',
                esc_attr($k), esc_html($label), esc_attr($type), esc_attr(self::OPT), esc_attr($value), $hint
            );
        }
        echo '</table>';
        submit_button();
        echo '</form></div>';
    }

    /* ---------- leads ---------- */

    public static function register(): void
    {
        register_post_type(self::CPT, [
            'labels' => ['name' => 'Preview leads', 'singular_name' => 'Lead', 'menu_name' => 'Preview leads'],
            'public' => false,
            'show_ui' => true,
            'menu_icon' => 'dashicons-megaphone',
            'supports' => ['title'],
            'capability_type' => 'post',
            'map_meta_cap' => true,
        ]);
    }

    public static function columns($cols): array
    {
        return [
            'cb' => $cols['cb'],
            'title' => 'Business',
            'type' => 'Type',
            'suburb' => 'Suburb',
            'contact' => 'Contact',
            'social' => 'Social',
            'preview' => 'Preview',
            'status' => 'Status',
            'date' => 'Requested',
        ];
    }

    public static function column(string $col, int $id): void
    {
        $m = fn(string $k) => (string) get_post_meta($id, $k, true);
        switch ($col) {
            case 'type':
            case 'suburb':
            case 'status':
                echo esc_html($m($col));
                break;
            case 'contact':
                echo esc_html($m('contact_name')) . '<br><a href="tel:' . esc_attr(preg_replace('/\s+/', '', $m('phone'))) . '">' .
                    esc_html($m('phone')) . '</a><br><a href="mailto:' . esc_attr($m('email')) . '">' . esc_html($m('email')) . '</a>';
                break;
            case 'social':
                if ($m('social')) {
                    echo '<a href="' . esc_url($m('social')) . '" target="_blank" rel="noopener">Open</a>';
                }
                break;
            case 'preview':
                echo $m('preview_url') ? '<a href="' . esc_url($m('preview_url')) . '" target="_blank" rel="noopener">Open preview</a>' : '<em>building…</em>';
                break;
        }
    }

    public static function meta_box(): void
    {
        add_meta_box('aceads_lead', 'Lead', function (WP_Post $post) {
            $m = fn(string $k) => (string) get_post_meta($post->ID, $k, true);
            wp_nonce_field('aceads_lead_meta', 'aceads_lead_nonce');
            echo '<p><label>Status <select name="aceads_status">';
            foreach (self::STATUSES as $s) {
                printf('<option value="%1$s"%2$s>%1$s</option>', esc_attr($s), selected($m('status'), $s, false));
            }
            echo '</select></label></p>';
            echo '<p><label>Notes<br><textarea name="aceads_notes" rows="4" class="large-text">' . esc_textarea($m('notes')) . '</textarea></label></p>';
            foreach (['type', 'suburb', 'contact_name', 'phone', 'email', 'social', 'preview_url', 'consent', 'ip'] as $k) {
                echo '<p><strong>' . esc_html($k) . ':</strong> ' . esc_html($m($k)) . '</p>';
            }
        }, self::CPT, 'normal', 'high');
    }

    public static function save_meta_box(int $id): void
    {
        if (!isset($_POST['aceads_lead_nonce']) || !wp_verify_nonce($_POST['aceads_lead_nonce'], 'aceads_lead_meta') || !current_user_can('edit_post', $id)) {
            return;
        }
        $status = sanitize_text_field(wp_unslash($_POST['aceads_status'] ?? 'new'));
        update_post_meta($id, 'status', in_array($status, self::STATUSES, true) ? $status : 'new');
        update_post_meta($id, 'notes', sanitize_textarea_field(wp_unslash($_POST['aceads_notes'] ?? '')));
    }

    /* ---------- the public form ---------- */

    public static function shortcode(): string
    {
        $done = isset($_GET['preview']) && $_GET['preview'] === 'requested';
        $error = isset($_GET['preview_error']) ? sanitize_text_field(wp_unslash($_GET['preview_error'])) : '';
        $p = fn(string $k) => esc_html(self::opt($k));
        ob_start(); ?>
<style>
.aceads-preview{max-width:720px;margin:0 auto;font-size:17px;line-height:1.55}
.aceads-preview h2{font-size:clamp(28px,5vw,40px);line-height:1.1;margin:0 0 12px}
.aceads-preview .sub{font-size:19px;color:#444;margin:0 0 28px}
.aceads-preview .prices{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:0 0 32px}
.aceads-preview .price{border:1px solid #ddd;border-radius:12px;padding:18px}
.aceads-preview .price b{display:block;font-size:26px;margin:4px 0}
.aceads-preview .price small{color:#555}
.aceads-preview form{display:grid;gap:14px;background:#f6f7f9;border-radius:14px;padding:22px}
.aceads-preview label{display:grid;gap:6px;font-weight:600}
.aceads-preview input,.aceads-preview select{width:100%;padding:12px;border:1px solid #c9ccd1;border-radius:8px;font:inherit;background:#fff}
.aceads-preview .row{display:grid;gap:14px;grid-template-columns:1fr 1fr}
.aceads-preview .consent{font-weight:400;display:flex;gap:10px;align-items:flex-start}
.aceads-preview .consent input{width:auto;margin-top:5px}
.aceads-preview button{padding:14px 22px;border:0;border-radius:999px;background:#111;color:#fff;font:600 17px/1 inherit;cursor:pointer}
.aceads-preview .ok{background:#e7f6ec;border:1px solid #9bd3ab;border-radius:12px;padding:18px}
.aceads-preview .err{background:#fdecec;border:1px solid #f0a8a8;border-radius:12px;padding:14px}
.aceads-preview .hp{position:absolute;left:-9999px}
@media (max-width:560px){.aceads-preview .row{grid-template-columns:1fr}}
</style>
<div class="aceads-preview" id="aceads-preview">
  <h2>See your business with a real website, free, before you pay a cent.</h2>
  <p class="sub">Tell us the name of your business and we'll build a one-page preview of what your website could look like, usually within the hour. We'll send it to you, then call to walk you through it. No cost, no obligation.</p>
  <div class="prices">
    <div class="price"><small>Starter, one page</small><b>A$<?php echo $p('price_starter'); ?></b><small>Your info, photos, hours, call and directions buttons. Live in 7 days.</small></div>
    <div class="price"><small>Business, up to five pages</small><b>A$<?php echo $p('price_business'); ?></b><small>Services or menu pages, enquiry form, Google Business setup.</small></div>
    <div class="price"><small>Care plan, optional</small><b>A$<?php echo $p('price_care'); ?>/mo</b><small>Hosting, backups, security updates and small changes when you need them.</small></div>
  </div>
  <?php if ($done): ?>
    <div class="ok"><strong>Thanks! We're building your preview now.</strong><br>You'll get an email with the link, usually within the hour, and one of us will call you to walk you through it.</div>
  <?php else: ?>
    <?php if ($error): ?><div class="err"><?php echo esc_html($error); ?></div><?php endif; ?>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
      <input type="hidden" name="action" value="aceads_preview_request">
      <input type="hidden" name="return" value="<?php echo esc_url(get_permalink()); ?>">
      <?php wp_nonce_field('aceads_preview_request', 'aceads_nonce'); ?>
      <label class="hp" aria-hidden="true">Website<input type="text" name="website_url" tabindex="-1" autocomplete="off"></label>
      <label>Business name<input type="text" name="business" required maxlength="80" placeholder="e.g. Bloom & Co Florist"></label>
      <div class="row">
        <label>Type of business<select name="type" required>
          <?php foreach (self::TYPES as $t): ?><option value="<?php echo esc_attr($t); ?>"><?php echo esc_html(ucfirst($t)); ?></option><?php endforeach; ?>
        </select></label>
        <label>Suburb or town<input type="text" name="suburb" required maxlength="60" placeholder="e.g. Paddington, Brisbane"></label>
      </div>
      <label>Your Instagram or Facebook page<input type="url" name="social" maxlength="200" placeholder="https://www.instagram.com/yourbusiness"></label>
      <div class="row">
        <label>Your name<input type="text" name="contact_name" required maxlength="60"></label>
        <label>Phone<input type="tel" name="phone" required maxlength="25" placeholder="04xx xxx xxx"></label>
      </div>
      <label>Email (we'll send the preview here)<input type="email" name="email" required maxlength="120"></label>
      <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>Yes, email me the preview and contact me about it. I can say stop at any time.</span></label>
      <button type="submit">Build my free preview</button>
    </form>
  <?php endif; ?>
</div>
        <?php return (string) ob_get_clean();
    }

    public static function handle_form(): void
    {
        $return = isset($_POST['return']) ? esc_url_raw(wp_unslash($_POST['return'])) : home_url('/');
        $back = function (string $error = '') use ($return) {
            $args = $error ? ['preview_error' => $error] : ['preview' => 'requested'];
            wp_safe_redirect(add_query_arg($args, $return) . '#aceads-preview');
            exit;
        };
        if (!isset($_POST['aceads_nonce']) || !wp_verify_nonce($_POST['aceads_nonce'], 'aceads_preview_request')) {
            $back('That form expired. Please try again.');
        }
        if (!empty($_POST['website_url'])) {
            $back(); // honeypot: pretend it worked
        }
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
        $key = 'aceads_rl_' . md5($ip);
        if ((int) get_transient($key) >= 3) {
            $back('Too many requests from this connection. Please try again in an hour.');
        }
        $f = fn(string $k) => sanitize_text_field(wp_unslash($_POST[$k] ?? ''));
        $business = $f('business');
        $type = in_array($f('type'), self::TYPES, true) ? $f('type') : 'other';
        $suburb = $f('suburb');
        $social = esc_url_raw(wp_unslash($_POST['social'] ?? ''));
        $phone = $f('phone');
        $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
        $name = $f('contact_name');
        if ($business === '' || $suburb === '' || $phone === '' || $name === '' || !is_email($email) || $f('consent') !== 'yes') {
            $back('Please fill in every field and tick the consent box.');
        }
        if ($social && !preg_match('~^https?://(www\.|m\.)?(instagram|facebook)\.com/~i', $social)) {
            $back('The social link should be an Instagram or Facebook page URL.');
        }
        set_transient($key, (int) get_transient($key) + 1, HOUR_IN_SECONDS);

        $id = wp_insert_post([
            'post_type' => self::CPT,
            'post_status' => 'publish',
            'post_title' => $business,
        ]);
        if (!$id || is_wp_error($id)) {
            $back('Something went wrong on our side. Please call us instead.');
        }
        $slug = sanitize_title($business . '-' . $suburb) . '-' . $id;
        foreach (compact('type', 'suburb', 'social', 'phone', 'email', 'slug', 'ip') + ['contact_name' => $name, 'status' => 'new', 'consent' => current_time('mysql')] as $k => $v) {
            update_post_meta($id, $k, $v);
        }

        $admin = admin_url('post.php?post=' . $id . '&action=edit');
        self::notify_team(
            "New preview request: {$business} ({$type}, {$suburb})\nContact: {$name}, {$phone}, {$email}\nSocial: " . ($social ?: '-') . "\nLead: {$admin}"
        );
        $dispatched = self::dispatch_build($id, compact('business', 'type', 'suburb', 'social', 'phone', 'slug'));
        if (!$dispatched) {
            self::notify_team("Could not start the preview build for {$business}. Check the GitHub token in Settings > AceAds Previews, or build it by hand.");
        }
        $back();
    }

    /* ---------- GitHub + delivery ---------- */

    private static function dispatch_build(int $id, array $fields): bool
    {
        $repo = self::opt('github_repo');
        $token = self::opt('github_token');
        if (!$repo || !$token) {
            return false;
        }
        $fields['callback'] = rest_url('aceads/v1/preview/' . $id);
        $resp = wp_remote_post("https://api.github.com/repos/{$repo}/dispatches", [
            'timeout' => 20,
            'headers' => [
                'Accept' => 'application/vnd.github+json',
                'Authorization' => 'Bearer ' . $token,
                'X-GitHub-Api-Version' => '2022-11-28',
                'Content-Type' => 'application/json',
                'User-Agent' => 'aceads-preview-plugin',
            ],
            'body' => wp_json_encode(['event_type' => 'preview_request', 'client_payload' => $fields]),
        ]);
        return !is_wp_error($resp) && wp_remote_retrieve_response_code($resp) === 204;
    }

    public static function rest(): void
    {
        register_rest_route('aceads/v1', '/preview/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'receive_preview'],
            'permission_callback' => function (WP_REST_Request $r) {
                $secret = self::opt('preview_secret');
                $given = (string) $r->get_header('x-aceads-secret');
                return $secret !== '' && $given !== '' && hash_equals($secret, $given);
            },
        ]);
    }

    public static function receive_preview(WP_REST_Request $r)
    {
        $id = (int) $r['id'];
        $post = get_post($id);
        if (!$post || $post->post_type !== self::CPT) {
            return new WP_Error('no_lead', 'Unknown lead', ['status' => 404]);
        }
        $slug = (string) get_post_meta($id, 'slug', true);
        $files = $r->get_param('files');
        if (!is_array($files) || empty($files['index.html'])) {
            return new WP_Error('bad_payload', 'files.index.html is required', ['status' => 400]);
        }
        $uploads = wp_upload_dir();
        $dir = trailingslashit($uploads['basedir']) . 'aceads-previews/' . $slug;
        wp_mkdir_p($dir . '/fonts');
        file_put_contents(dirname($dir) . '/.htaccess', "Options -Indexes\n");
        foreach ($files as $path => $b64) {
            if (!preg_match('~^(fonts/)?[a-z0-9._-]+\.(html|png|woff2)$~i', (string) $path)) {
                continue; // only the files the builder makes, nothing that could run on the server
            }
            $bytes = base64_decode((string) $b64, true);
            if ($bytes === false) {
                continue;
            }
            file_put_contents($dir . '/' . $path, $bytes);
        }
        $url = trailingslashit($uploads['baseurl']) . 'aceads-previews/' . $slug . '/';
        update_post_meta($id, 'preview_url', $url);
        update_post_meta($id, 'status', 'preview ready');

        $business = $post->post_title;
        $phone = (string) get_post_meta($id, 'phone', true);
        $email = (string) get_post_meta($id, 'email', true);
        $name = (string) get_post_meta($id, 'contact_name', true);
        self::notify_team("Preview ready for {$business}: {$url}\nCall {$name} on {$phone} and walk them through it.");
        self::email($email, "Your website preview for {$business}",
            "Hi {$name},\n\nHere's the preview we built for {$business}:\n{$url}\n\n" .
            "It's a concept, not a live website: your photos, menu or services and hours go in once you say go. " .
            "One of us will call you on {$phone} to walk you through it and answer questions.\n\n" .
            "Starter (one page) is A$" . self::opt('price_starter') . ", Business (up to five pages) is A$" . self::opt('price_business') .
            ", and the optional care plan is A$" . self::opt('price_care') . " a month.\n\n" .
            "Not interested? Reply STOP and we won't contact you again.\n\n" . self::opt('from_name') . "\n" . home_url('/'));
        return ['ok' => true, 'url' => $url];
    }

    /* ---------- notifications ---------- */

    private static function notify_team(string $text): void
    {
        $token = self::opt('telegram_token');
        $chat = self::opt('telegram_chat');
        if ($token && $chat) {
            wp_remote_post("https://api.telegram.org/bot{$token}/sendMessage", [
                'timeout' => 10,
                'body' => ['chat_id' => $chat, 'text' => $text, 'disable_web_page_preview' => 'true'],
            ]);
        }
        if (self::opt('notify_email')) {
            self::email(self::opt('notify_email'), 'AceAds: ' . strtok($text, "\n"), $text);
        }
    }

    private static function email(string $to, string $subject, string $body): void
    {
        wp_mail($to, $subject, $body, ['From: ' . self::opt('from_name') . ' <' . get_option('admin_email') . '>']);
    }
}

AceAds_Preview::boot();
