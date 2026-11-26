/**
 * pinService.js
 * Secure PIN generation, hashing, verification, and HSM-ready encryption.
 *
 * HSM SUPPORT
 * ───────────
 * HSM_PROVIDER can select an optional key-management adapter:
 *
 *   HSM_PROVIDER=aws        → AWS KMS API (HSM backing depends on AWS key configuration)
 *   HSM_PROVIDER=azure      → Azure Key Vault key operations
 *   HSM_PROVIDER=pkcs11     → INCOMPLETE vendor-specific PKCS#11 placeholder
 *   HSM_PROVIDER=software   → (default) bcrypt-only storage
 *
 * The AWS and Azure adapters wrap the bcrypt hash with a remote key operation.
 * This is not PCI PIN-block processing and does not establish PCI compliance.
 * The PKCS#11 adapter is a stub and is not operational. If a configured
 * provider fails, PIN creation must fail rather than silently downgrade to
 * software-only storage.
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// ─── HSM Interface ────────────────────────────────────────────────────────────
/**
 * Returns the configured key-management adapter, or null only for explicit
 * software mode. Unknown provider names fail closed instead of silently
 * selecting software-only storage. Adapter dependencies are loaded lazily.
 */
function getHsmAdapter() {
  const provider = (process.env.HSM_PROVIDER || "software").toLowerCase();

  switch (provider) {
    case "aws":
      return createAwsHsmAdapter();
    case "azure":
      return createAzureHsmAdapter();
    case "pkcs11":
      return createPkcs11Adapter();
    case "software":
      return null; // Explicit software-only mode
    default:
      throw new Error(`Unsupported HSM_PROVIDER "${provider}". Use aws, azure, pkcs11, or software.`);
  }
}

/**
 * AWS KMS adapter. Requires @aws-sdk/client-kms.
 * KMS key custody and any CloudHSM backing must be configured and verified
 * separately. This adapter does not implement PCI PIN-block operations.
 */
function createAwsHsmAdapter() {
  return {
    name: "AWS KMS / CloudHSM",

    async encrypt(plaintext) {
      // Lazy-load to avoid crashing dev environments without AWS SDK
      const { KMSClient, EncryptCommand } = require("@aws-sdk/client-kms");
      const client = new KMSClient({ region: process.env.AWS_REGION || "us-east-1" });
      const result = await client.send(
        new EncryptCommand({
          KeyId: process.env.AWS_KMS_KEY_ID,
          Plaintext: Buffer.from(plaintext, "utf8"),
          EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
        })
      );
      return Buffer.from(result.CiphertextBlob).toString("base64");
    },

    async decrypt(ciphertext) {
      const { KMSClient, DecryptCommand } = require("@aws-sdk/client-kms");
      const client = new KMSClient({ region: process.env.AWS_REGION || "us-east-1" });
      const result = await client.send(
        new DecryptCommand({
          KeyId: process.env.AWS_KMS_KEY_ID,
          CiphertextBlob: Buffer.from(ciphertext, "base64"),
          EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
        })
      );
      return Buffer.from(result.Plaintext).toString("utf8");
    },
  };
}

/**
 * Azure Key Vault key adapter. Requires @azure/keyvault-keys and @azure/identity.
 * The selected key's HSM protection level must be configured and verified
 * separately. This adapter does not implement PCI PIN-block operations.
 */
function createAzureHsmAdapter() {
  return {
    name: "Azure Key Vault HSM",

    async encrypt(plaintext) {
      const { KeyClient, CryptographyClient } = require("@azure/keyvault-keys");
      const { DefaultAzureCredential } = require("@azure/identity");
      const credential = new DefaultAzureCredential();
      const client = new KeyClient(process.env.AZURE_KEYVAULT_URL, credential);
      const key = await client.getKey(process.env.AZURE_KEY_NAME);
      const cryptoClient = new CryptographyClient(key, credential);
      const result = await cryptoClient.encrypt("RSA-OAEP-256", Buffer.from(plaintext));
      return Buffer.from(result.result).toString("base64");
    },

    async decrypt(ciphertext) {
      const { KeyClient, CryptographyClient } = require("@azure/keyvault-keys");
      const { DefaultAzureCredential } = require("@azure/identity");
      const credential = new DefaultAzureCredential();
      const client = new KeyClient(process.env.AZURE_KEYVAULT_URL, credential);
      const key = await client.getKey(process.env.AZURE_KEY_NAME);
      const cryptoClient = new CryptographyClient(key, credential);
      const result = await cryptoClient.decrypt("RSA-OAEP-256", Buffer.from(ciphertext, "base64"));
      return Buffer.from(result.result).toString("utf8");
    },
  };
}

/**
 * INCOMPLETE PKCS#11 placeholder for vendor-specific HSM integration.
 * This adapter is deliberately non-operational until a vendor-specific
 * session, key selection, and cryptographic mechanism are implemented.
 */
function createPkcs11Adapter() {
  return {
    name: "PKCS#11 HSM",

    async encrypt(plaintext) {
      // graphene-pk11 usage — implementation depends on your HSM vendor.
      // This stub documents the expected interface.
      const graphene = require("graphene-pk11");
      const mod = graphene.Module.load(
        process.env.PKCS11_LIB_PATH,
        process.env.PKCS11_LIB_NAME
      );
      mod.initialize();
      // ... (full PKCS#11 session / key derivation logic per vendor)
      mod.finalize();
      throw new Error("PKCS#11 adapter: complete the vendor-specific session logic.");
    },

    async decrypt(ciphertext) {
      throw new Error("PKCS#11 adapter: complete the vendor-specific session logic.");
    },
  };
}

// ─── Core PIN Functions ───────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure 16-digit PIN.
 * Uses crypto.randomInt (CSPRNG) — NOT Math.random.
 * @returns {string} 16-digit numeric string
 */
function generateSecurePin() {
  return Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join("");
}

/**
 * Formats a PIN into groups of 4 for display.
 * e.g. "1234567890123456" → "1234 5678 9012 3456"
 */
function formatPin(pin) {
  return pin.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Hashes and optionally HSM-encrypts a PIN for secure database storage.
 *
 * Storage format (software mode):   "$2b$10$..." (bcrypt hash)
 * Storage format (HSM mode):        "hsm:<provider>:<base64-encrypted-bcrypt-hash>"
 *
 * @param {string} pin  Raw 16-digit PIN
 * @returns {Promise<string>}  Value safe to store in the database
 */
async function hashPin(pin) {
  const bcryptHash = await bcrypt.hash(pin, SALT_ROUNDS);

  const hsm = getHsmAdapter();
  if (!hsm) {
    return bcryptHash; // Software-only mode
  }

  // Configured key-management mode: fail closed if encryption is unavailable.
  // Never store a software-only hash after an operator explicitly selected an adapter.
  try {
    const encrypted = await hsm.encrypt(bcryptHash);
    return `hsm:${hsm.name.split(" ")[0].toLowerCase()}:${encrypted}`;
  } catch (err) {
    console.error(`[HSM] Encryption failed; refusing software fallback: ${err.message}`);
    throw new Error("Configured key-management encryption failed; PIN was not created.");
  }
}

/**
 * Verifies a PIN attempt against its stored hash (handles both HSM and software modes).
 *
 * @param {string} inputPin   The PIN entered by the user
 * @param {string} storedHash The value from the database
 * @returns {Promise<boolean>}
 */
async function verifyPin(inputPin, storedHash) {
  if (!storedHash) return false;

  // Detect HSM-wrapped hash
  if (storedHash.startsWith("hsm:")) {
    const [, , encryptedHash] = storedHash.split(":");
    const hsm = getHsmAdapter();
    if (!hsm) {
      console.error("[HSM] Stored hash is HSM-encrypted but no HSM provider is configured.");
      return false;
    }
    try {
      const decryptedHash = await hsm.decrypt(encryptedHash);
      return bcrypt.compare(inputPin, decryptedHash);
    } catch (err) {
      console.error(`[HSM] Decryption failed during PIN verification: ${err.message}`);
      return false;
    }
  }

  // Standard bcrypt verification
  return bcrypt.compare(inputPin, storedHash);
}

/**
 * Calculates a health score (0–100) for a PIN.
 * Used in the dashboard to surface at-risk PINs to admins.
 *
 * Deductions:
 *   Balance < 10%  → -40    Balance < 25% → -20    Balance < 50% → -10
 *   Uses   > 90%   → -30    Uses   > 70%  → -15
 *   Declines > 3   → -20    Declines > 1  → -10
 */
function calculateHealthScore(pin) {
  if (pin.status !== "active") return 0;
  let score = 100;

  const balancePct = (pin.remaining_amount / pin.amount) * 100;
  if (balancePct < 10) score -= 40;
  else if (balancePct < 25) score -= 20;
  else if (balancePct < 50) score -= 10;

  const usesPct = ((pin.max_uses - pin.uses_left) / pin.max_uses) * 100;
  if (usesPct > 90) score -= 30;
  else if (usesPct > 70) score -= 15;

  const declineCount = parseInt(pin.decline_count || 0);
  if (declineCount > 3) score -= 20;
  else if (declineCount > 1) score -= 10;

  return Math.max(0, Math.min(100, score));
}

module.exports = {
  generateSecurePin,
  formatPin,
  hashPin,
  verifyPin,
  calculateHealthScore,
  getHsmAdapter, // Exported for testing and diagnostics
};
