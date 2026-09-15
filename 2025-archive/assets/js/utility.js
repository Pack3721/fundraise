// Utility functions for encoding/decoding and obfuscation

/**
 * Returns a map of query parameters with lowercase keys for case-insensitive lookup.
 * @returns {Object} Map of query parameters (all keys lowercase)
 */
function getQueryParamsCI() {
    const params = new URLSearchParams(window.location.search);
    const map = {};
    for (const [key, value] of params.entries()) {
        map[key.toLowerCase()] = value;
    }
    return map;
}


/**
 * RFC 4648 base32 alphabet.
 * @type {string}
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a Uint8Array of bytes to a base32 string.
 * @param {Uint8Array} bytes - The bytes to encode.
 * @returns {string} Base32 encoded string.
 */
function bytesToBase32(bytes) {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

/**
 * Decodes a base32 string to a Uint8Array of bytes.
 * @param {string} str - The base32 string to decode.
 * @returns {Uint8Array} Decoded bytes.
 */
function base32ToBytes(str) {
    let bits = 0, value = 0, output = [];
    str = str.replace(/=+$/, '').toUpperCase();
    for (let i = 0; i < str.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(str[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(output);
}

/**
 * XORs two byte arrays (Uint8Array) together, cycling the key if needed.
 * @param {Uint8Array} dataBytes - Data bytes to XOR.
 * @param {Uint8Array} keyBytes - Key bytes to XOR with.
 * @returns {Uint8Array} XORed result.
 */
function xorBytes(dataBytes, keyBytes) {
    const out = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
        out[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return out;
}

/**
 * Computes the SHA-256 hash of a string and returns an ArrayBuffer.
 * @param {string} str - The string to hash.
 * @returns {Promise<ArrayBuffer>} SHA-256 hash as ArrayBuffer.
 */
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return buf;
}

/**
 * Obfuscates a string using two rounds of XOR (with key and IV) and base32 encoding.
 * @param {string} plainText - The text to obfuscate.
 * @param {Uint8Array} keyBytes - Key bytes for XOR.
 * @returns {Promise<string>} Obfuscated string (IV + base32).
 */
async function xorObfuscate(plainText, keyBytes) {
    // Generate random number
    const randNum = Math.random();
    // Convert to string and sha256
    const randNumStr = randNum.toString();
    const randHashBuf = await sha256(randNumStr);
    const randHash = new Uint8Array(randHashBuf);
    // Base32 encode the hash
    const randHashBase32 = bytesToBase32(randHash);
    // Take last two chars as IV
    const iv = randHashBase32.slice(-2);
    // Sha256 the IV
    const ivHashBuf = await sha256(iv);
    const ivHash = new Uint8Array(ivHashBuf);
    // XOR plainText with keyBytes
    const enc = new TextEncoder().encode(plainText);
    const obfuscatedBytes = xorBytes(enc, keyBytes);
    // XOR obfuscatedBytes with ivHash
    const doubleObfuscated = xorBytes(obfuscatedBytes, ivHash);
    // Encode doubleObfuscated to base32
    const obfBase32 = bytesToBase32(doubleObfuscated);
    // Return iv + obfBase32
    return iv + obfBase32;
}

/**
 * Deobfuscates a string produced by xorObfuscate.
 * @param {string} obfuscatedString - The obfuscated string (IV + base32).
 * @param {Uint8Array} keyBytes - Key bytes for XOR.
 * @returns {Promise<string>} Decrypted plain text.
 */
async function xorDeobfuscate(obfuscatedString, keyBytes) {
    // First two chars are IV
    if (obfuscatedString.length < 3) return '';
    const iv = obfuscatedString.slice(0, 2);
    const obfBase32 = obfuscatedString.slice(2);
    // Sha256 the IV
    const ivHashBuf = await sha256(iv);
    const ivHash = new Uint8Array(ivHashBuf);
    // Decode obfuscated
    const doubleObfuscated = base32ToBytes(obfBase32);
    // XOR with ivHash
    const obfuscatedBytes = xorBytes(doubleObfuscated, ivHash);
    // XOR with keyBytes
    const out = xorBytes(obfuscatedBytes, keyBytes);
    return new TextDecoder().decode(out);
}