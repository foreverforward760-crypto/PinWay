jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcrypt = require("bcrypt");
const { hashPin, getHsmAdapter } = require("./pinService");

describe("PIN key-management failure behavior", () => {
  const originalProvider = process.env.HSM_PROVIDER;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalProvider === undefined) {
      delete process.env.HSM_PROVIDER;
    } else {
      process.env.HSM_PROVIDER = originalProvider;
    }
  });

  test("uses bcrypt-only storage when software mode is explicitly selected", async () => {
    process.env.HSM_PROVIDER = "software";
    bcrypt.hash.mockResolvedValue("bcrypt-hash");

    await expect(hashPin("1234567890123456")).resolves.toBe("bcrypt-hash");
  });

  test("rejects an unknown provider instead of silently selecting software mode", () => {
    process.env.HSM_PROVIDER = "not-a-provider";

    expect(() => getHsmAdapter()).toThrow(/Unsupported HSM_PROVIDER/);
  });

  test("refuses to create a PIN when configured PKCS#11 encryption is unavailable", async () => {
    process.env.HSM_PROVIDER = "pkcs11";
    bcrypt.hash.mockResolvedValue("bcrypt-hash");

    await expect(hashPin("1234567890123456")).rejects.toThrow(
      /Configured key-management encryption failed/
    );
  });
});
