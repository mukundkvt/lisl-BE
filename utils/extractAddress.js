/**
 * Extracts and formats address information from Digilocker API response
 * Splits the address body (before city/state/pincode) into up to 3 lines,
 * with a max of 4 words per line. The landmark is placed in the next available line.
 * @param {Object} data - The Digilocker API response data
 * @returns {Object} Formatted address object
 */
const extractAddress = (data) => {
    try {
        const { address, splitAddress } = data.result;

        // Remove care-of prefix (e.g., "S/O RAMESH", "C/O SHARMA", etc.)
        const careOfRegex = /(S\/O|C\/O|D\/O|W\/O|H\/O|F\/O),[^ ]+( [A-Z]+)* /i;
        const cleanAddress = address.replace(careOfRegex, "").trim();

        // Tokenise the cleaned address
        const allTokens = cleanAddress.split(/\s+/).filter(Boolean);

        // Build stop-word set: landmark, district, state name, pincode
        // — we don't want these leaking into addressLine fields
        const landmark = (splitAddress.landMark || "").trim();
        const stopWords = new Set([
            landmark.toUpperCase(),
            (splitAddress.district[0] || "").toUpperCase(),
            (splitAddress.state[0][0] || "").toUpperCase(),
            (splitAddress.pincode || "").toUpperCase(),
        ].filter(Boolean));

        // Collect only tokens that appear BEFORE any stop word
        const bodyTokens = [];
        for (const token of allTokens) {
            if (stopWords.has(token.toUpperCase())) break;
            bodyTokens.push(token);
        }

        // ── Split body tokens into chunks of ≤4 words each ──────────────────
        // If a landmark exists, reserve the 3rd line slot for it → only 2 body lines
        const MAX_WORDS = 4;
        const maxBodyLines = landmark ? 2 : 3;
        const bodyLines = [];
        for (let i = 0; i < bodyTokens.length && bodyLines.length < maxBodyLines; i += MAX_WORDS) {
            const chunk = bodyTokens.slice(i, i + MAX_WORDS).join(" ").trim();
            if (chunk) bodyLines.push(chunk);
        }

        // Place the landmark into the next free slot (line2, line3, or appended to line3)
        const allLines = [...bodyLines];
        if (landmark) {
            if (allLines.length < 3) {
                allLines.push(landmark);
            } else {
                // All 3 slots full — append landmark to line3
                allLines[2] = `${allLines[2]} ${landmark}`.trim();
            }
        }

        // Map to schema
        const extractedAddress = {
            addressLine1: allLines[0] || "",
            addressLine2: allLines[1] || "",
            addressLine3: allLines[2] || "",
            city:         (splitAddress.district[0] || "").trim(),
            state:        (splitAddress.state[0][0] || "").trim(),
            stateCode:    (splitAddress.state[0][1] || "").trim(),
            country:      (splitAddress.country[2] || "").trim(),
            countryCode:  (splitAddress.country[0] || "").trim(),
            pincode:      (splitAddress.pincode || "").trim(),
        };

        return extractedAddress;
    } catch (error) {
        console.error("Error extracting address:", error);
        return null;
    }
};

export default extractAddress;