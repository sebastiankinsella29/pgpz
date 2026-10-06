const { timingSafeEqual } = require("node:crypto");

const TOTAL_LEVELS = 7;

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
			return respond(401, { ok: false, error: "Access phrase not recognized." });
		}

		const currentDocumentUrl = getDocumentUrl(1);
		if (!currentDocumentUrl) return respond(503, { ok: false, error: "Level documents are not configured yet." });
		return respond(200, { ok: true, currentDocumentUrl });
	}

	if (payload.action !== "answer" || !Number.isInteger(payload.level) || payload.level < 1 || payload.level > TOTAL_LEVELS || typeof payload.answer !== "string") {
		return respond(400, { ok: false, error: "Invalid level answer request." });
	}

	const configuredAnswer = process.env[`ARG_LEVEL_${payload.level}_ANSWER`];
	if (!configuredAnswer) return respond(503, { ok: false, error: "This level is not configured yet." });
	const submittedAnswer = payload.answer.trim().toUpperCase();
	const expectedAnswer = configuredAnswer.trim().toUpperCase();
	if (!constantTimeMatch(submittedAnswer, expectedAnswer)) {
		return respond(401, { ok: false, error: "That answer does not open this file." });
	}

	if (payload.level === TOTAL_LEVELS) return respond(200, { ok: true, complete: true });

	const nextLevel = payload.level + 1;
	const nextDocumentUrl = getDocumentUrl(nextLevel);
	if (!nextDocumentUrl) return respond(503, { ok: false, error: "The next level document is not configured yet." });
	return respond(200, { ok: true, complete: false, nextLevel, nextDocumentUrl });
};

function getDocumentUrl(level) {
	const value = process.env[`ARG_LEVEL_${level}_DOC`];
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
