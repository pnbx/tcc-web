<?php
/**
 * Zibal Relay — forwards Zibal API calls so they egress from THIS server's
 * static (shared) IP. Upload to a cPanel host, point a subdomain at it, and
 * whitelist the server's IP in the Zibal panel (result 115 fix).
 *
 * SETUP (cPanel):
 *   1. Change the secret below to any long random string.
 *   2. Upload this file (e.g. to public_html/relay.php).
 *   3. In Vercel, set:
 *        ZIBAL_RELAY_URL   = https://<your-subdomain>/relay.php
 *        ZIBAL_RELAY_SECRET = <the same secret>
 *   4. In the Zibal panel, whitelist THIS server's shared IP
 *      (visible in cPanel sidebar: "Shared IP Address").
 *
 * Security: secret-header gated + endpoint whitelist; payload is passed
 * through untouched. Only POST is accepted.
 */

$SECRET = getenv('ZIBAL_RELAY_SECRET') ?: '1ff94715113d75b4e67c8951b66abd792503e05b617f1b66';

$ALLOWED = [
    'request' => 'https://gateway.zibal.ir/v1/request',
    'verify'  => 'https://gateway.zibal.ir/v1/verify',
    'inquiry' => 'https://gateway.zibal.ir/v1/inquiry',
];

header('Content-Type: application/json');

// Method gate
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

// Secret gate (constant-time compare)
$secret = $_SERVER['HTTP_X_RELAY_SECRET'] ?? '';
if ($SECRET === 'CHANGE-ME-azura-relay-9f4Kp2Xw7Qm8Tz3V' || !hash_equals($SECRET, $secret)) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

// Endpoint whitelist
$ep = $_GET['ep'] ?? '';
if (!isset($ALLOWED[$ep])) {
    http_response_code(400);
    echo json_encode(['error' => 'bad endpoint']);
    exit;
}

$payload = file_get_contents('php://input');

$ch = curl_init($ALLOWED[$ep]);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT        => 20,
]);
$out  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

http_response_code($code ?: 502);
echo ($out !== false && $out !== '') ? $out : json_encode(['error' => 'upstream_failed', 'detail' => $err]);
