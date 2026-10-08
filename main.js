const API_ENDPOINT = "/.netlify/functions/validate-answer";
const TOTAL_LEVELS = 7;
const LEVEL_ONE_PHRASE = "he cheers. I have finally entered the";
const ENCHANTMENT_GLYPHS = "QWERTYUIOPASDFGHJKLZXCVBNM";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentLevel = 1;
let nextDocumentUrl = "";
let currentDocumentUrl = "";
let confettiFrame = 0;
let levelOnePhraseRevealed = false;
let phraseShuffleTimer = 0;
const levelHistory = [];

const entryView = document.querySelector("#entry-view");
const levelView = document.querySelector("#level-view");
const entryForm = document.querySelector("#entry-form");
const passwordHintButton = document.querySelector("#password-hint-button");
const passwordHint = document.querySelector("#password-hint");
const testEnterButton = document.querySelector("#test-enter-button");
const answerForm = document.querySelector("#answer-form");
const entryMessage = document.querySelector("#entry-message");
const answerMessage = document.querySelector("#answer-message");
const hintButton = document.querySelector("#hint-button");
const hintMessage = document.querySelector("#hint-message");
const testNextButton = document.querySelector("#test-next-button");
const backButton = document.querySelector("#back-button");
const successPanel = document.querySelector("#success-panel");
const nextButton = document.querySelector("#next-button");
const answerParts = [...answerForm.querySelectorAll(".level-one-part")];
const levelOnePhrase = document.querySelector("#level-one-phrase");
const testMode = new URLSearchParams(window.location.search).get("testMode") === "1";

if (testMode) {
	testEnterButton.classList.remove("is-hidden");
	testNextButton.classList.remove("is-hidden");
}

passwordHintButton.addEventListener("click", () => {
	const isExpanded = passwordHintButton.getAttribute("aria-expanded") === "true";
	passwordHintButton.setAttribute("aria-expanded", String(!isExpanded));
	passwordHint.classList.toggle("is-hidden", isExpanded);
	passwordHintButton.textContent = isExpanded ? "Show password hint" : "Hide password hint";
});

testEnterButton.addEventListener("click", () => openLevelView(""));

entryForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const submitButton = entryForm.querySelector("button[type='submit']");
	setBusy(submitButton, true);
	entryMessage.textContent = "CHECKING ACCESS…";
	try {
		const result = await postToValidator({ action: "enter", password: entryForm.elements.password.value });
		if (!result.ok) {
			entryMessage.textContent = result.error || "That password isn't correct. Please try again.";
			return;
		}
		openLevelView(result.currentDocumentUrl);
	} catch {
		entryMessage.textContent = "VALIDATION SERVICE UNAVAILABLE. TRY AGAIN SHORTLY.";
	} finally {
		setBusy(submitButton, false);
	}
});

answerForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const submitButton = answerForm.querySelector("button[type='submit']");
	setBusy(submitButton, true);
	answerMessage.textContent = "VERIFYING ANSWER…";
	const answer = currentLevel === 1
		? answerParts.map((part) => part.value.trim()).join(" ")
		: answerForm.elements.answer.value;
	try {
		const result = await postToValidator({ action: "answer", level: currentLevel, answer });
		if (!result.ok) {
			if (currentLevel === 1 && Array.isArray(result.partsCorrect)) {
				setPartFeedback(result.partsCorrect);
				answerMessage.textContent = result.partsCorrect
					.map((isCorrect, index) => `Blank ${index + 1}: ${isCorrect ? "correct" : "wrong"}`)
					.join("; ") + ".";
			} else {
				answerMessage.textContent = result.error || "That answer isn't correct. Check the level document and try again.";
			}
			if (currentLevel !== 1) {
				answerForm.elements.answer.setAttribute("aria-invalid", "true");
				answerForm.elements.answer.select();
			}
			return;
		}
		if (currentLevel === 1) {
			setPartFeedback(result.partsCorrect || answerParts.map(() => true));
			await revealLevelOnePhrase();
		}
		showSuccess(result);
	} catch {
		answerMessage.textContent = "VALIDATION SERVICE UNAVAILABLE. TRY AGAIN SHORTLY.";
	} finally {
		setBusy(submitButton, false);
	}
});

answerForm.elements.answer.addEventListener("input", () => {
	answerForm.elements.answer.removeAttribute("aria-invalid");
	answerMessage.textContent = "";
});

answerParts.forEach((part) => part.addEventListener("input", () => {
	clearPartFeedback();
	answerMessage.textContent = "";
}));

hintButton.addEventListener("click", async () => {
	hintButton.disabled = true;
	hintButton.setAttribute("aria-busy", "true");
	hintMessage.classList.remove("is-hidden");
	hintMessage.textContent = "Loading hint…";
	try {
		const result = await postToValidator({ action: "hint", level: currentLevel });
		hintMessage.textContent = result.hint || "No hint is available for this level yet.";
	} catch {
		hintMessage.textContent = "Hints are temporarily unavailable. Try again shortly.";
	} finally {
		hintButton.disabled = false;
		hintButton.removeAttribute("aria-busy");
	}
});

nextButton.addEventListener("click", () => {
	levelHistory.push({ level: currentLevel, documentUrl: currentDocumentUrl });
	currentLevel += 1;
	currentDocumentUrl = nextDocumentUrl;
	updateLevelView();
});

testNextButton.addEventListener("click", () => {
	if (currentLevel >= TOTAL_LEVELS) return;
	levelHistory.push({ level: currentLevel, documentUrl: currentDocumentUrl });
	currentLevel += 1;
	currentDocumentUrl = "";
	updateLevelView();
});

backButton.addEventListener("click", () => {
	const previousLevel = levelHistory.pop();
	if (!previousLevel) return;
	currentLevel = previousLevel.level;
	currentDocumentUrl = previousLevel.documentUrl;
	updateLevelView();
});

async function postToValidator(payload) {
	const response = await fetch(API_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
	const result = await response.json();
	if (!response.ok && !result.error) throw new Error("Validation request failed");
	return result;
}

function openLevelView(documentUrl) {
	currentDocumentUrl = documentUrl;
	entryView.classList.add("is-hidden");
	levelView.classList.remove("is-hidden");
	levelView.setAttribute("aria-hidden", "false");
	setAnswerMode();
	updateCurrentDocumentLink();
	getActiveAnswerControl().focus();
}

function showSuccess(result) {
	answerForm.classList.toggle("is-hidden", currentLevel !== 1);
	successPanel.classList.remove("is-hidden");
	answerMessage.textContent = "";
	if (currentLevel === 1) {
		answerParts.forEach((part) => { part.disabled = true; });
		answerForm.querySelector("button[type='submit']").disabled = true;
	}
	if (result.complete) {
		document.querySelector("#success-title").textContent = "Congratulations";
		document.querySelector("#success-copy").textContent = "All 7 levels complete.";
		nextButton.classList.add("is-hidden");
		document.querySelector("#level-title").textContent = "Complete";
	} else {
		nextDocumentUrl = result.nextDocumentUrl;
		document.querySelector("#success-title").textContent = "Congratulations.";
		document.querySelector("#success-copy").textContent = `Level ${currentLevel} complete.`;
		nextButton.classList.remove("is-hidden");
		nextButton.href = nextDocumentUrl;
		nextButton.textContent = `Continue to level ${result.nextLevel}`;
	}
	launchConfetti();
	if (result.complete) document.querySelector("#success-title").focus();
	else nextButton.focus();
}

function updateLevelView() {
	answerForm.reset();
	setAnswerMode();
	answerForm.querySelector("button[type='submit']").disabled = false;
	clearPartFeedback();
	hintMessage.classList.add("is-hidden");
	hintMessage.textContent = "";
	answerForm.classList.remove("is-hidden");
	successPanel.classList.add("is-hidden");
	nextDocumentUrl = "";
	const number = String(currentLevel).padStart(2, "0");
	document.querySelector("#level-title").textContent = `Level ${number}`;
	document.querySelector("#progress-label").textContent = `${number} / 07`;
	document.querySelector("#progress-fill").style.width = `${(currentLevel / TOTAL_LEVELS) * 100}%`;
	testNextButton.disabled = currentLevel >= TOTAL_LEVELS;
	backButton.disabled = levelHistory.length === 0;
	updateCurrentDocumentLink();
	getActiveAnswerControl().focus();
}

function setAnswerMode() {
	const isLevelOne = currentLevel === 1;
	const standardAnswer = answerForm.elements.answer;
	const levelOneTemplate = document.querySelector("#level-one-template");
	const answerRow = answerForm.querySelector(".input-row");
	standardAnswer.disabled = isLevelOne;
	standardAnswer.required = !isLevelOne;
	answerRow.classList.toggle("level-one-answer", isLevelOne);
	answerParts.forEach((part) => {
		part.disabled = !isLevelOne;
		part.required = isLevelOne;
	});
	levelOneTemplate.classList.toggle("is-hidden", !isLevelOne);
	levelOneTemplate.setAttribute("aria-hidden", String(!isLevelOne));
	if (isLevelOne && !levelOnePhraseRevealed) {
		startPhraseShuffle();
	} else {
		window.clearInterval(phraseShuffleTimer);
		levelOnePhrase.textContent = LEVEL_ONE_PHRASE;
		levelOnePhrase.setAttribute("aria-label", LEVEL_ONE_PHRASE);
	}
	document.querySelector("#answer-label").textContent = isLevelOne ? "Complete the phrase" : "Answer";
}

function createEnchantmentText() {
	return LEVEL_ONE_PHRASE.replace(/[a-z]/gi, () => ENCHANTMENT_GLYPHS[Math.floor(Math.random() * ENCHANTMENT_GLYPHS.length)]);
}

function startPhraseShuffle() {
	window.clearInterval(phraseShuffleTimer);
	levelOnePhrase.textContent = createEnchantmentText();
	levelOnePhrase.setAttribute("aria-label", "Hidden phrase");
	phraseShuffleTimer = window.setInterval(() => {
		levelOnePhrase.textContent = createEnchantmentText();
	}, 100);
}

async function revealLevelOnePhrase() {
	levelOnePhraseRevealed = true;
	window.clearInterval(phraseShuffleTimer);
	if (reducedMotion.matches) {
		levelOnePhrase.textContent = LEVEL_ONE_PHRASE;
		levelOnePhrase.setAttribute("aria-label", LEVEL_ONE_PHRASE);
		return;
	}
	levelOnePhrase.classList.add("is-enchanting");
	levelOnePhrase.setAttribute("aria-label", "Phrase reveal in progress");
	const revealSteps = 18;
	for (let step = 0; step <= revealSteps; step += 1) {
		const revealedCharacters = Math.floor((step / revealSteps) * LEVEL_ONE_PHRASE.length);
		levelOnePhrase.textContent = [...LEVEL_ONE_PHRASE].map((character, index) => {
			if (index < revealedCharacters || !/[a-z]/i.test(character)) return character;
			return ENCHANTMENT_GLYPHS[Math.floor(Math.random() * ENCHANTMENT_GLYPHS.length)];
		}).join("");
		await new Promise((resolve) => window.setTimeout(resolve, 45));
	}
	levelOnePhrase.textContent = LEVEL_ONE_PHRASE;
	levelOnePhrase.setAttribute("aria-label", LEVEL_ONE_PHRASE);
	levelOnePhrase.classList.remove("is-enchanting");
}

function setPartFeedback(partsCorrect) {
	answerParts.forEach((part, index) => {
		const isCorrect = partsCorrect[index] === true;
		part.classList.toggle("is-correct", isCorrect);
		part.classList.toggle("is-incorrect", !isCorrect);
		part.setAttribute("aria-invalid", String(!isCorrect));
		part.setAttribute("aria-label", `Code part ${index + 1}, ${isCorrect ? "correct" : "wrong"}`);
	});
}

function clearPartFeedback() {
	answerParts.forEach((part, index) => {
		part.classList.remove("is-correct", "is-incorrect");
		part.removeAttribute("aria-invalid");
		part.setAttribute("aria-label", `${["First", "Second", "Third"][index]} code part`);
	});
}

function getActiveAnswerControl() {
	return currentLevel === 1 ? answerParts[0] : answerForm.elements.answer;
}

function updateCurrentDocumentLink() {
	const link = document.querySelector("#current-doc-link");
	link.href = currentDocumentUrl;
	link.textContent = `Open level ${currentLevel} document`;
	link.classList.toggle("is-hidden", !currentDocumentUrl);
}

function setBusy(button, busy) {
	button.disabled = busy;
	button.setAttribute("aria-busy", String(busy));
}

function launchConfetti() {
	cancelAnimationFrame(confettiFrame);
	const canvas = document.querySelector("#confetti");
	const context = canvas.getContext("2d");
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = window.innerWidth * ratio;
	canvas.height = window.innerHeight * ratio;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	const colors = ["#5278f2", "#a8bcff", "#b34468", "#f07691", "#f2eaf0"];
	if (reducedMotion.matches) {
		for (let index = 0; index < 90; index += 1) {
			context.save();
			context.translate(Math.random() * window.innerWidth, Math.random() * window.innerHeight * .78);
			context.rotate(Math.random() * Math.PI);
			context.fillStyle = colors[Math.floor(Math.random() * colors.length)];
			context.fillRect(-3, -5, 6, 10);
			context.restore();
		}
		window.setTimeout(() => context.clearRect(0, 0, window.innerWidth, window.innerHeight), 1800);
		return;
	}
	const pieces = Array.from({ length: 150 }, () => ({
		x: Math.random() * window.innerWidth,
		y: -20 - Math.random() * window.innerHeight * .45,
		width: 4 + Math.random() * 6,
		height: 5 + Math.random() * 9,
		velocityX: (Math.random() - .5) * 3,
		velocityY: 2 + Math.random() * 4,
		rotation: Math.random() * Math.PI,
		spin: (Math.random() - .5) * .14,
		color: colors[Math.floor(Math.random() * colors.length)]
	}));
	const startedAt = performance.now();
	function frame(now) {
		context.clearRect(0, 0, window.innerWidth, window.innerHeight);
		for (const piece of pieces) {
			piece.x += piece.velocityX;
			piece.y += piece.velocityY;
			piece.rotation += piece.spin;
			context.save();
			context.translate(piece.x, piece.y);
			context.rotate(piece.rotation);
			context.fillStyle = piece.color;
			context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
			context.restore();
		}
		if (now - startedAt < 2600) confettiFrame = requestAnimationFrame(frame);
		else context.clearRect(0, 0, window.innerWidth, window.innerHeight);
	}
	confettiFrame = requestAnimationFrame(frame);
}
