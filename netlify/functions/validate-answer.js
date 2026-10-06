const { timingSafeEqual } = require("node:crypto");

const TOTAL_LEVELS = 7;
const LEVEL_DOCUMENT_URLS = {
	1: "https://docs.google.com/document/d/1lEfcHXlaRvOR1rbiCkWKRHRk5DmDUN0PEPsmBu5qEZU/edit?usp=sharing",
	2: "https://docs.google.com/document/d/1TxS_QkSSp-zEatYdj7zbPoPxH9ffahXy224khvAoP84/edit?usp=sharing",
	3: "https://docs.google.com/document/d/1l8bL2JbUo75-71edz9ZGCuS6KTMcw8_JZjXxvuk9bl0/edit?usp=sharing",
	4: "https://docs.google.com/document/d/1z_Q13zh15afNsW73830MK0rLqSRLWmtsk2g4ArXUGsY/edit?usp=sharing",
	5: "https://docs.google.com/document/d/1ELovgt-TEzrXYs4xSHDMoen_wp4_otGNeBJrIGskTH4/edit?usp=sharing",
	6: "https://docs.google.com/document/d/1vRLuib6_-ktvnI2WrlNxvWs5-iSWDjL9G1Yi7HHrNVs/edit?usp=sharing",
	7: "https://docs.google.com/document/d/1C2vB6YUs_FqMpzqJKS5ACdShUOu8I5fOVCqqP-BTq1c/edit?usp=sharing"
};

exports.handler = async (event) => {
	if (event.httpMethod !== "POST") {
		return respond(405, { ok: false, error: "Method not allowed." }, { Allow: "POST" });
	}

	let payload;
	try {
		const body = event.isBase64Encoded
			? Buffer.from(event.body || "", "base64").toString("utf8")
			: event.body;
		payload = JSON.parse(body || "{}");
	} catch {
		return respond(400, { ok: false, error: "Invalid request." });
	}

	if (payload.action === "enter") {
		const configuredPassword = process.env.ARG_ENTRY_PASSWORD || "TE9SRQ==";
		if (typeof payload.password !== "string" || !constantTimeMatch(payload.password.trim(), configuredPassword)) {
			return respond(401, { ok: false, error: "That password isn't correct. Please try again." });
		}

		const currentDocumentUrl = getDocumentUrl(1);
		if (!currentDocumentUrl) return respond(503, { ok: false, error: "Level documents are not configured yet." });
		return respond(200, { ok: true, currentDocumentUrl });
	}

	if (payload.action === "hint") {
		if (!Number.isInteger(payload.level) || payload.level < 1 || payload.level > TOTAL_LEVELS) {
			return respond(400, { ok: false, error: "Invalid level." });
		}
		const hint = process.env[`ARG_LEVEL_${payload.level}_HINT`];
		return respond(200, { ok: true, hint: hint || "No hint is available for this level yet." });
	}

	if (payload.action !== "answer" || !Number.isInteger(payload.level) || payload.level < 1 || payload.level > TOTAL_LEVELS || typeof payload.answer !== "string") {
		return respond(400, { ok: false, error: "Invalid level answer request." });
	}

	const configuredAnswer = process.env[`ARG_LEVEL_${payload.level}_ANSWER`];
	if (!configuredAnswer) return respond(503, { ok: false, error: "This level is not configured yet." });
	const submittedAnswer = payload.answer.trim().toUpperCase();
	const expectedAnswer = configuredAnswer.trim().toUpperCase();
	if (!constantTimeMatch(submittedAnswer, expectedAnswer)) {
		return respond(401, { ok: false, error: "That answer isn't correct. Check the level document and try again." });
	}

	if (payload.level === TOTAL_LEVELS) return respond(200, { ok: true, complete: true });

	const nextLevel = payload.level + 1;
	const nextDocumentUrl = getDocumentUrl(nextLevel);
	if (!nextDocumentUrl) return respond(503, { ok: false, error: "The next level document is not configured yet." });
	return respond(200, { ok: true, complete: false, nextLevel, nextDocumentUrl });
};

function getDocumentUrl(level) {
	const value = process.env[`ARG_LEVEL_${level}_DOC`] || LEVEL_DOCUMENT_URLS[level];
	if (!value) return "";
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "docs.google.com" ? url.toString() : "";
	} catch {
		return "";
	}
}

function constantTimeMatch(submitted, expected) {
	const submittedBytes = Buffer.from(submitted);
	const expectedBytes = Buffer.from(expected);
	return submittedBytes.length === expectedBytes.length && timingSafeEqual(submittedBytes, expectedBytes);
}

function respond(statusCode, body, extraHeaders = {}) {
	return {
		statusCode,
		headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
		body: JSON.stringify(body)
	};
}
