import { describe, expect, it } from "vitest";
import { trustedDestination } from "@/lib/security/trusted-destination";

const origin = "https://lms.example.com";

describe("trustedDestination", () => {
  it("accepts same-origin relative paths", () => {
    expect(trustedDestination("/secure/file", { currentOrigin: origin })).toBe("https://lms.example.com/secure/file");
  });

  it("rejects non-HTTPS external destinations", () => {
    expect(trustedDestination("http://zoom.us/example", { currentOrigin: origin })).toBeNull();
  });

  it("rejects lookalike hostnames", () => {
    expect(trustedDestination("https://zoom.us.attacker.example/meeting", { currentOrigin: origin })).toBeNull();
  });

  it("accepts configured parent domains and their subdomains", () => {
    expect(
      trustedDestination("https://files.storage.example.com/proof", {
        currentOrigin: origin,
        allowedHosts: ["storage.example.com"],
      }),
    ).toBe("https://files.storage.example.com/proof");
  });

  it("normalizes YouTube watch links to privacy-enhanced embeds", () => {
    expect(
      trustedDestination("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
        currentOrigin: origin,
        purpose: "youtube_embed",
        allowedHosts: ["youtube.com", "youtube-nocookie.com"],
      }),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
