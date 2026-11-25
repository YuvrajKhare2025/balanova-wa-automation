/**
 * scripts/patch-wwebjs.js
 *
 * Hotfixes whatsapp-web.js internal bugs:
 * 1. Media message memoize bug ("Error: Data passed to getter must include an id property")
 * 2. Socket null crash ("Cannot read properties of null (reading 'Socket')")
 *    WhatsApp Web updates cause window.require('WAWebSocketModel') to return null
 *    on unauthenticated / QR-code pages, crashing client.initialize().
 */

const fs = require('fs');
const path = require('path');

function patchWWebJS() {
    let anyModified = false;

    // ── 1. Patch Utils.js (Media ID fix) ───────────────────────────────────
    const utilsPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'util', 'Injected', 'Utils.js');

    if (fs.existsSync(utilsPath)) {
        let content = fs.readFileSync(utilsPath, 'utf8');
        let modified = false;

        if (!content.includes('/* PATCH_WWEBJS_MEDIA_ID_FIX */')) {
            const regex = /(\.\.\.extraOptions,[\r\n\s]*\};)([\r\n\s]*)(\/\/ Bot's won't reply if canonicalUrl is set)/;
            if (regex.test(content)) {
                content = content.replace(regex, `$1$2/* PATCH_WWEBJS_MEDIA_ID_FIX */\n        delete message.__x_id;\n        delete mediaOptions.__x_id;\n        message.id = newMsgKey;$2$3`);
                modified = true;
            } else {
                const fallbackRegex = /(\.\.\.extraOptions,[\r\n\s]*\};)/;
                if (fallbackRegex.test(content)) {
                    content = content.replace(fallbackRegex, `$1\n        /* PATCH_WWEBJS_MEDIA_ID_FIX */\n        delete message.__x_id;\n        delete mediaOptions.__x_id;\n        message.id = newMsgKey;`);
                    modified = true;
                }
            }
        }

        if (!content.includes('/* PATCH_WWEBJS_PROCESS_MEDIA_FIX */')) {
            const mediaReturnRegex = /(mediaHandle:\s*sendToChannel\s*\?\s*mediaEntry\.handle\s*:\s*null,[\r\n\s]*\}\);[\r\n\s]*)(return mediaData;)/;
            if (mediaReturnRegex.test(content)) {
                content = content.replace(mediaReturnRegex, `$1/* PATCH_WWEBJS_PROCESS_MEDIA_FIX */\n        delete mediaData.__x_id;\n        delete mediaData.id;\n        $2`);
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(utilsPath, content, 'utf8');
            console.log('✅ [patch-wwebjs] Successfully applied media memoize hotfixes to Utils.js!');
            anyModified = true;
        }
    }

    // ── 2. Patch Client.js (Socket null crash fix) ─────────────────────────
    const clientPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

    if (fs.existsSync(clientPath)) {
        let clientContent = fs.readFileSync(clientPath, 'utf8');
        let clientModified = false;

        if (!clientContent.includes('/* PATCH_WWEBJS_SOCKET_NULL_FIX_V2 */')) {
            // Replace any single-line or multi-line WAWebSocketModel.Socket access with a bulletproof safe fallback
            const socketRegex = /(?:window\s*\.)?require\(\s*['"]WAWebSocketModel['"]\s*\)[\r\n\s]*\.Socket/g;
            const safeSocket = `/* PATCH_WWEBJS_SOCKET_NULL_FIX_V2 */ (window.require?.('WAWebSocketModel')?.Socket || { on: () => {}, off: () => {}, state: 'UNPAIRED', streamState: 'DISCONNECTED', takeover: () => {}, logout: () => {} })`;

            if (socketRegex.test(clientContent)) {
                clientContent = clientContent.replace(socketRegex, safeSocket);
                clientModified = true;
            }

            // Also ensure AppState fallback if present
            const appStateRegex = /const\s+AppState\s*=\s*window\.require\(\s*['"]WAWebSocketModel['"]\s*\)\.Socket;/g;
            if (appStateRegex.test(clientContent)) {
                clientContent = clientContent.replace(
                    appStateRegex,
                    `let AppState = null; try { const m = typeof window.require === 'function' ? window.require('WAWebSocketModel') : null; AppState = m ? m.Socket : null; } catch(_) {}`
                );
                clientModified = true;
            }
        }

        if (clientModified) {
            fs.writeFileSync(clientPath, clientContent, 'utf8');
            console.log('✅ [patch-wwebjs] Successfully applied bulletproof Socket null hotfixes to Client.js!');
            anyModified = true;
        }
    }

    if (anyModified) {
        return true;
    }

    console.log('✅ [patch-wwebjs] whatsapp-web.js is up to date.');
    return true;
}

if (require.main === module) {
    patchWWebJS();
}

module.exports = patchWWebJS;
